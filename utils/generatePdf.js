const puppeteer = require("puppeteer");
const ejs = require("ejs");
const fs = require("fs");
const path = require("path");

const encodeImageToBase64 = (relativePath) => {
  const filePath = path.resolve(__dirname, relativePath);
  const ext = path.extname(filePath).slice(1);
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:image/${ext};base64,${base64}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.generatePdf = async (data, template_name) => {
  const assetUrls = {
    logo: encodeImageToBase64("../assets/logo.png"),
    bankQr: encodeImageToBase64("../assets/bank-qr.png"),
    authorizedSign: encodeImageToBase64("../assets/authorized-sign.png"),
  };

  const html = await ejs.renderFile(
    path.join(__dirname, "..", "pdfTemplates", template_name),
    { ...data, assetUrls },
    { async: true }
  );

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let browser = null;
    try {
      console.log(`Starting Chrome (attempt ${attempt}/${maxAttempts})...`);

      browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-background-networking",
          "--enable-features=NetworkService",
        ],
        pipe: true,
        protocolTimeout: 60000,
        timeout: 10000,
      });

      await sleep(1000);
      console.log("Chrome started...");

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        scale: 0.7,
      });

      return pdfBuffer;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxAttempts) {
        console.info("Retrying in 1s...");
        await sleep(1000);
      } else {
        throw new Error("Failed to generate PDF after multiple attempts.");
      }

    } finally {
      if (browser) {
        try {
          await browser.close();
          console.info("Browser closed.");
        } catch (closeErr) {
          console.warn("Error closing browser:", closeErr);
        }
      }
    }
  }
};
