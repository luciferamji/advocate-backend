const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");

exports.generatePdf = async (data) => {
  const html = await ejs.renderFile(
    path.join(__dirname, "invoiceTemplate.ejs"),
    data,
    { async: true }
  );    

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

  await browser.close();
  return pdfBuffer;
};
