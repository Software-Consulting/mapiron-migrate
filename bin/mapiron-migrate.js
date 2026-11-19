#!/usr/bin/env node
"use strict";
// mapiron-migrate: find Google Geocoding API and Static Maps API URLs in a code base and, with --write,
// point them at MapIron's Google-compatible endpoints. Reads files on this machine only; makes no network calls.
const { scan, rewrite, MAPIRON_BASE } = require("../lib/migrate");

const HELP = `mapiron-migrate [paths...] [--write] [--check] [--json] [--base URL]

Lists every Google Geocoding API and Static Maps API URL under the given paths (default: .) and,
with --write, changes the host to MapIron's Google-compatible endpoints:

  https://maps.googleapis.com/maps/api/geocode/json -> ${MAPIRON_BASE}/maps/api/geocode/json
  https://maps.googleapis.com/maps/api/staticmap    -> ${MAPIRON_BASE}/maps/api/staticmap

Keys are never changed or printed: put your MapIron key where the Google key went.
Other Google APIs (Maps JavaScript, Places, Directions, ...) are listed but not changed.

  --write      rewrite the supported URLs in place
  --check      exit with code 1 if anything is left to migrate (for CI)
  --json       machine-readable output
  --base URL   a different MapIron base (default ${MAPIRON_BASE})
  --help       this text

Guide: https://mapiron.com/migrate/google-maps`;

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return 0; }
  const opt = { write: false, check: false, json: false, base: MAPIRON_BASE, paths: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--write") opt.write = true;
    else if (a === "--check") opt.check = true;
    else if (a === "--json") opt.json = true;
    else if (a === "--base") opt.base = String(args[++i] || "").replace(/\/+$/, "");
    else if (a.startsWith("--")) { console.error(`Unknown option ${a}. Try --help.`); return 2; }
    else opt.paths.push(a);
  }
  if (!/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(opt.base)) { console.error("--base must be an https:// URL."); return 2; }
  if (!opt.paths.length) opt.paths.push(".");

  const found = scan(opt.paths);
  const changed = opt.write ? rewrite(found, opt.base) : [];
  const supported = found.hits.filter((h) => h.supported);
  const other = found.hits.filter((h) => !h.supported);
  if (opt.json) {
    console.log(JSON.stringify({ files_scanned: found.files, supported, other, hardcoded_keys: found.keys, changed }, null, 2));
  } else {
    console.log(`Scanned ${found.files} files.`);
    if (!found.hits.length) console.log("No Google Maps API URLs found.");
    for (const h of supported) console.log(`${opt.write ? "changed " : "can move"}  ${h.file}:${h.line}  ${h.api}`);
    for (const h of other) console.log(`by hand   ${h.file}:${h.line}  ${h.api} (${h.note})`);
    for (const k of found.keys) console.log(`warning   ${k.file}:${k.line}  a Google API key is written in this file (value hidden). Rotate it and load keys from configuration.`);
    if (supported.length && !opt.write) console.log(`\n${supported.length} URL(s) can move. Run again with --write to change the host, then use your MapIron key.`);
    if (opt.write) console.log(`\nChanged ${changed.length} file(s). Next: put your MapIron key where the Google key went (https://mapiron.com/dashboard).`);
    if (other.length) console.log("Maps JavaScript API: see https://mapiron.com/docs/maplibre or https://mapiron.com/docs/leaflet. Places, Street View and traffic have no MapIron equivalent.");
  }
  if (opt.check && (opt.write ? other.length : found.hits.length)) return 1;
  return 0;
}

process.exitCode = main(process.argv);
