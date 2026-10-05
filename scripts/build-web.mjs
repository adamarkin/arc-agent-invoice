import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
mkdirSync("docs", { recursive: true });
for (const f of readdirSync("docs")) if (f !== "config.json") rmSync("docs/" + f, { recursive: true, force: true });
writeFileSync("docs/.nojekyll", ""); // Pages/Jekyll would drop underscore-prefixed chunk files
await build({ entryPoints: ["web/app.js", "web/deploy.js"], bundle: true, splitting: true, format: "esm", define: { __REOWN_PROJECT_ID__: JSON.stringify(process.env.REOWN_PROJECT_ID || "") }, target: "es2022", minify: true, outdir: "docs", platform: "browser" });
for (const f of ["index.html", "deploy.html", "style.css"]) copyFileSync("web/" + f, "docs/" + f);
const art = JSON.parse(readFileSync("artifacts-out/AgentInvoice.json", "utf8"));
writeFileSync("docs/abi.json", JSON.stringify(art.abi));
copyFileSync("artifacts-out/AgentInvoice.json", "docs/AgentInvoice.json");
try { readFileSync("docs/config.json"); } catch { writeFileSync("docs/config.json", JSON.stringify({ contract: "" }, null, 2) + "\n"); }
console.log("built docs/");
