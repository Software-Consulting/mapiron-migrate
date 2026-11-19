"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { scan, rewrite, MAPIRON_BASE } = require("../lib/migrate");

const KEY = "AIza" + "S".repeat(35);
function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "mim-"));
  fs.mkdirSync(path.join(d, "src"));
  fs.mkdirSync(path.join(d, "node_modules", "x"), { recursive: true });
  fs.writeFileSync(path.join(d, "src", "geo.ts"),
    `const u = "https://maps.googleapis.com/maps/api/geocode/json?address=" + q + "&key=" + process.env.KEY;\n` +
    `const img = \`//maps.googleapis.com/maps/api/staticmap?center=\${c}&zoom=14&size=600x400&key=\${k}\`;\n`);
  fs.writeFileSync(path.join(d, "src", "page.html"),
    `<script src="https://maps.googleapis.com/maps/api/js?key=${KEY}"></script>\n<p>https://maps.googleapis.com/maps/api/place/autocomplete/json</p>\n`);
  fs.writeFileSync(path.join(d, "node_modules", "x", "i.js"), `"https://maps.googleapis.com/maps/api/geocode/json"`);
  fs.writeFileSync(path.join(d, "logo.png"), Buffer.from([0, 1, 2]));
  return d;
}

test("finds supported and other Google URLs, skips node_modules, hides keys", () => {
  const d = fixture();
  const r = scan([d]);
  const sup = r.hits.filter((h) => h.supported).map((h) => h.api).sort();
  assert.deepStrictEqual(sup, ["Geocoding API", "Static Maps API"]);
  const other = r.hits.filter((h) => !h.supported).map((h) => h.api).sort();
  assert.deepStrictEqual(other, ["js", "place/autocomplete/json"]);
  assert.strictEqual(r.keys.length, 1);
  assert.ok(!JSON.stringify(r).includes(KEY), "key value never appears in results");
  assert.ok(r.hits.every((h) => !h.file.includes("node_modules")));
});

test("rewrite changes only the two supported hosts and keeps keys", () => {
  const d = fixture();
  const r = scan([d]);
  const changed = rewrite(r, MAPIRON_BASE);
  assert.strictEqual(changed.length, 1);
  const geo = fs.readFileSync(path.join(d, "src", "geo.ts"), "utf8");
  assert.ok(geo.includes(MAPIRON_BASE + "/maps/api/geocode/json?address="));
  assert.ok(geo.includes(MAPIRON_BASE + "/maps/api/staticmap?center="));
  assert.ok(geo.includes("process.env.KEY"));
  const html = fs.readFileSync(path.join(d, "src", "page.html"), "utf8");
  assert.ok(html.includes("https://maps.googleapis.com/maps/api/js?key=" + KEY), "unsupported APIs untouched");
  assert.strictEqual(scan([d]).hits.filter((h) => h.supported).length, 0);
});

test("CLI: --check fails while there is work, --json is clean, keys never printed", () => {
  const d = fixture();
  const bin = path.join(__dirname, "..", "bin", "mapiron-migrate.js");
  let code = 0, out = "";
  try { out = execFileSync(process.execPath, [bin, d, "--check"], { encoding: "utf8" }); } catch (e) { code = e.status; out = e.stdout; }
  assert.strictEqual(code, 1);
  assert.ok(out.includes("can move") && out.includes("by hand") && out.includes("value hidden"));
  assert.ok(!out.includes(KEY));
  const j = JSON.parse(execFileSync(process.execPath, [bin, d, "--json"], { encoding: "utf8" }));
  assert.strictEqual(j.supported.length, 2);
  assert.ok(!JSON.stringify(j).includes(KEY));
  assert.ok(!("abs" in j.supported[0]));
  const w = execFileSync(process.execPath, [bin, d, "--write"], { encoding: "utf8" });
  assert.ok(w.includes("Changed 1 file"));
  let bad = 0;
  try { execFileSync(process.execPath, [bin, d, "--base", "http://evil"], { encoding: "utf8", stdio: "pipe" }); } catch (e) { bad = e.status; }
  assert.strictEqual(bad, 2);
});
