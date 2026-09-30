const puppeteer = require("puppeteer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

// One shared Chrome for all PDFs, one PDF at a time. The server is a small shared box: a Chrome per request
// (with --single-process) leaked and grew to 2.6 GB, which took the whole server down (OOM, 30 Sep 2026).
const JOB_TIMEOUT_MS = 45000; // whole job: render + pdf
const MAX_JOBS_PER_BROWSER = 50; // recycle Chrome regularly so memory never creeps up
const IDLE_CLOSE_MS = 2 * 60 * 1000; // close Chrome when no PDF was made for 2 minutes

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--renderer-process-limit=1",
  "--js-flags=--max-old-space-size=256",
];

const encodeImageToBase64 = (relativePath) => {
  const filePath = path.resolve(__dirname, relativePath);
  const ext = path.extname(filePath).slice(1);
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:image/${ext};base64,${base64}`;
};

let assetUrls = null;
const getAssetUrls = () => {
  if (!assetUrls) {
    assetUrls = {
      logo: encodeImageToBase64("../assets/logo.png"),
      bankQr: encodeImageToBase64("../assets/bank-qr.png"),
      authorizedSign: encodeImageToBase64("../assets/authorized-sign.png"),
    };
  }
  return assetUrls;
};

let browser = null;
let jobsOnBrowser = 0;
let idleTimer = null;
let queue = Promise.resolve();

const killBrowser = async () => {
  const b = browser;
  browser = null;
  jobsOnBrowser = 0;
  if (!b) return;
  try {
    await Promise.race([b.close(), new Promise((_, reject) => setTimeout(() => reject(new Error("close timeout")), 5000))]);
  } catch (err) {
    console.warn("Chrome did not close cleanly, killing it:", err.message);
    const proc = b.process();
    if (proc && !proc.killed) proc.kill("SIGKILL");
  }
};

const getBrowser = async () => {
  if (browser && browser.connected && jobsOnBrowser < MAX_JOBS_PER_BROWSER) return browser;
  await killBrowser();
  browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS, pipe: true, protocolTimeout: 30000, timeout: 15000 });
  browser.on("disconnected", () => {
    if (browser && !browser.connected) {
      browser = null;
      jobsOnBrowser = 0;
    }
  });
  return browser;
};

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`PDF job timed out after ${ms} ms`)), ms))]);

const render = async (html) => {
  const b = await getBrowser();
  jobsOnBrowser += 1;
  const page = await b.newPage();
  try {
    // Everything is inline (images are base64), so "load" is enough; networkidle0 only adds waiting.
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      scale: 0.7,
      timeout: 30000,
    });
  } finally {
    await page.close().catch(() => {});
  }
};

const runJob = async (html) => {
  clearTimeout(idleTimer);
  try {
    return await withTimeout(render(html), JOB_TIMEOUT_MS);
  } catch (err) {
    // A stuck or crashed Chrome is thrown away, so the next PDF starts clean.
    await killBrowser();
    throw err;
  } finally {
    idleTimer = setTimeout(() => {
      killBrowser().catch(() => {});
    }, IDLE_CLOSE_MS);
    idleTimer.unref();
  }
};

exports.generatePdf = async (data, template_name) => {
  const html = await ejs.renderFile(
    path.join(__dirname, "..", "pdfTemplates", template_name),
    { ...data, assetUrls: getAssetUrls() },
    { async: true }
  );

  // Serialise: requests wait for the previous PDF instead of starting another Chrome.
  const job = queue.then(async () => {
    try {
      return await runJob(html);
    } catch (firstErr) {
      console.error("PDF generation failed, retrying once with a fresh Chrome:", firstErr.message);
      return runJob(html);
    }
  });
  queue = job.catch(() => {});
  try {
    return await job;
  } catch (err) {
    console.error("PDF generation failed:", err.message);
    throw new Error("Failed to generate PDF after multiple attempts.");
  }
};
