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

exports.generatePdf = async (data, template_name) => {
  const assetUrls = {
    logo: encodeImageToBase64("../assets/logo.png"),
    bankQr: encodeImageToBase64("../assets/bank-qr.png"),
    authorizedSign: encodeImageToBase64("../assets/authorized-sign.png"),
  };

  const html = await ejs.renderFile(
    path.join(__dirname,"..","pdfTemplates", template_name),
    { ...data, assetUrls },
    { async: true }
  );

const browser = await puppeteer.launch({
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
  protocolTimeout: 60000, // increase to 60 seconds
});

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

  await browser.close();
  return pdfBuffer;
};
