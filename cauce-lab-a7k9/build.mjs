import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
for (const f of [
  "src/app.js",
  "src/engine.js",
  "src/store.js",
  "src/worker.js",
])
  execFileSync(process.execPath, ["--check", f]);
const html = await readFile("index.html", "utf8");
for (const path of [...html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)].map(
  (x) => x[1],
))
  await readFile(path);
console.log(
  "OK: módulos JavaScript y recursos estáticos. Publicación estática sin dependencias.",
);
