import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
mkdirSync("docs", { recursive: true });
await build({ entryPoints: ["web/app.js", "web/deploy.js"], bundle: true, format: "esm", target: "es2022", minify: true, outdir: "docs", platform: "browser" });
for (const f of ["index.html", "deploy.html", "style.css"]) copyFileSync("web/" + f, "docs/" + f);
const art = JSON.parse(readFileSync("artifacts-out/AgentInvoice.json", "utf8"));
writeFileSync("docs/abi.json", JSON.stringify(art.abi));
copyFileSync("artifacts-out/AgentInvoice.json", "docs/AgentInvoice.json");
try { readFileSync("docs/config.json"); } catch { writeFileSync("docs/config.json", JSON.stringify({ contract: "" }, null, 2) + "\n"); }
console.log("built docs/");
