"use strict";
const fs = require("fs");
const path = require("path");

const MAPIRON_BASE = "https://api.mapiron.com/v1/google";
const SKIP_DIRS = new Set(["node_modules", ".git", ".hg", ".svn", "dist", "build", ".next", ".nuxt", "vendor", "target", "__pycache__", ".venv", "venv", "coverage", ".turbo", ".cache"]);
const EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro", ".html", ".htm", ".php", ".py", ".rb", ".go",
  ".java", ".kt", ".kts", ".cs", ".swift", ".dart", ".rs", ".json", ".yaml", ".yml", ".toml", ".xml", ".erb", ".twig", ".liquid", ".md", ".txt", ".sh"];
const MAX_BYTES = 2 * 1024 * 1024;

// Supported: the JSON Geocoding API and the Static Maps API. Everything else on the host is reported only.
const URL_RE = /(?:https?:)?\/\/maps\.googleapis\.com\/maps\/api\/([A-Za-z0-9_/]+)/g;
const SUPPORTED = { "geocode/json": "Geocoding API", "staticmap": "Static Maps API" };
const KEY_RE = /AIza[0-9A-Za-z_-]{35}/g;

function note(api) {
  if (api === "geocode/xml") return "XML output isn't supported; switch to geocode/json";
  if (api === "js" || api.startsWith("js/")) return "Maps JavaScript API: use MapLibre or Leaflet with MapIron tiles";
  if (api.startsWith("place")) return "Places API has no MapIron equivalent";
  if (api.startsWith("directions") || api.startsWith("distancematrix")) return "use MapIron /v1/route or /v1/matrix (different format)";
  if (api.startsWith("streetview")) return "Street View has no MapIron equivalent";
  if (api.startsWith("timezone") || api.startsWith("elevation")) return "no MapIron equivalent";
  return "not covered by the compatible endpoints";
}

function walk(p, out) {
  let st;
  try { st = fs.lstatSync(p); } catch (_) { return; }
  if (st.isSymbolicLink()) return;
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(p))) return;
    let names = [];
    try { names = fs.readdirSync(p); } catch (_) { return; }
    for (const n of names.sort()) walk(path.join(p, n), out);
  } else if (st.isFile() && st.size <= MAX_BYTES) {
    const lower = p.toLowerCase();
    if (EXTS.some((e) => lower.endsWith(e))) out.push(p);
  }
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Scan files; returns {files, hits:[{file,line,api,supported,note}], keys:[{file,line}]}. Key values are never kept. */
function scan(paths) {
  const files = [];
  for (const p of paths) walk(path.resolve(p), files);
  const hits = [], keys = [];
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, "utf8"); } catch (_) { continue; }
    if (text.includes("\u0000")) continue;
    const rel = path.relative(process.cwd(), f) || f;
    for (const m of text.matchAll(URL_RE)) {
      const api = m[1].replace(/\/+$/, "");
      const supported = Object.prototype.hasOwnProperty.call(SUPPORTED, api);
      const h = { file: rel, line: lineOf(text, m.index), api: supported ? SUPPORTED[api] : api, supported, note: supported ? "" : note(api) };
      Object.defineProperty(h, "abs", { value: f, enumerable: false });
      hits.push(h);
    }
    for (const m of text.matchAll(KEY_RE)) keys.push({ file: rel, line: lineOf(text, m.index) });
  }
  return { files: files.length, hits, keys };
}

/** Rewrite supported URLs in the files that have them; returns the files changed. */
function rewrite(found, base) {
  const files = [...new Set(found.hits.filter((h) => h.supported).map((h) => h.abs))];
  const changed = [];
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    const next = text
      .replace(/(?:https?:)?\/\/maps\.googleapis\.com\/maps\/api\/geocode\/json/g, `${base}/maps/api/geocode/json`)
      .replace(/(?:https?:)?\/\/maps\.googleapis\.com\/maps\/api\/staticmap/g, `${base}/maps/api/staticmap`);
    if (next !== text) {
      fs.writeFileSync(f, next);
      changed.push(path.relative(process.cwd(), f) || f);
    }
  }
  return changed;
}

module.exports = { scan, rewrite, MAPIRON_BASE, note };
