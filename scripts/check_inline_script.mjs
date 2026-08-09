import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
let checked = 0;
for (const [, code] of blocks) {
  if (!code.trim()) continue;
  new vm.Script(code, { filename: `inline-script-${checked}` });
  checked += 1;
}
if (checked === 0) {
  console.error("FAIL: no inline script blocks matched — the gate is blind");
  process.exit(1);
}
console.log(`OK: ${checked} inline script block(s) parsed without syntax errors`);
