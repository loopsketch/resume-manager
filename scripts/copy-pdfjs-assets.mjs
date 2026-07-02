// pdfjs-dist の CJK CMap / 標準フォントを public/ へコピーする。
// vite は public/ を dev で直接配信し、build で dist へコピーするため、
// 開発・本番の両方で /pdfjs/... が確実に解決できる。
// (postinstall / predev / prebuild で実行される)
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "pdfjs-dist");
const dest = path.join(root, "public", "pdfjs");

mkdirSync(dest, { recursive: true });
for (const dir of ["cmaps", "standard_fonts"]) {
  cpSync(path.join(src, dir), path.join(dest, dir), { recursive: true });
}
console.log(`[copy-pdfjs-assets] copied cmaps / standard_fonts -> ${dest}`);
