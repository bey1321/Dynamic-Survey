import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export async function parsePdf(base64Content) {
  const buffer = Buffer.from(base64Content, "base64");
  const pdfData = await pdfParse(buffer);
  return pdfData.text;
}
