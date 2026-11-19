# mapiron-migrate

Find every Google **Geocoding API** and **Static Maps API** call in your code, and point it at
[MapIron](https://mapiron.com)'s Google-compatible endpoints by changing one host.

```bash
npx -y github:Software-Consulting/mapiron-migrate ./src            # list what would change
npx -y github:Software-Consulting/mapiron-migrate ./src --write    # change the host
```

| Google | MapIron |
|---|---|
| `https://maps.googleapis.com/maps/api/geocode/json` | `https://api.mapiron.com/v1/google/maps/api/geocode/json` |
| `https://maps.googleapis.com/maps/api/staticmap` | `https://api.mapiron.com/v1/google/maps/api/staticmap` |

Same paths, parameters and JSON shape (`results`, `status`, `formatted_address`, `geometry.location`, …).
Then use a MapIron key where the Google key went: free at <https://mapiron.com/dashboard>, no card.

## What it does

- Walks the paths you give (default `.`), skipping `node_modules`, `.git`, build folders and files over 2 MB.
- Lists each Google Maps URL with file and line. Geocoding (JSON) and Static Maps can move; everything else
  (Maps JavaScript API, Places, Directions, Street View) is listed as **by hand** with a pointer.
- Warns when a Google API key is written in a file, **without printing it**, so you can rotate it.
- With `--write`, changes only the host of the two supported URLs. Keys and other code are left alone.
- Makes no network calls and sends nothing anywhere.

Options: `--write`, `--check` (exit 1 while anything is left, for CI), `--json`, `--base URL`, `--help`.

## Before you switch

- Try your own addresses on MapIron's free plan first. Results come from OpenStreetMap and US public address
  records: strong in most places, but not identical to Google.
- Don't copy coordinates you got from Google into MapIron: Google's terms limit caching them to 30 days.
  Geocode again with MapIron; on paid plans you may keep those indefinitely.
- What's supported and what isn't: <https://mapiron.com/migrate/google-maps>.

Requires Node 18+. No dependencies. Tests: `npm test`.

Google Maps Platform is a trademark of Google LLC. This project isn't affiliated with or endorsed by Google.

MIT licence. © 2026 Wells Software Consulting LLC (MapIron).
