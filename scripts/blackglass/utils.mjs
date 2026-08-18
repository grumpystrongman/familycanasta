import fs from "node:fs";
import path from "node:path";

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
export function exists(file) { return fs.existsSync(file); }
export function readJson(file, fallback = null) {
  if (!exists(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
export function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
export function imageDataUrl(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}
export function escapeXml(text) {
  return String(text ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
export function parseJsonObject(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last < first) throw new Error(`No JSON object in model output: ${raw.slice(0, 200)}`);
  return JSON.parse(raw.slice(first, last + 1));
}
