# Deploying

The site is the `app/` folder: static files, no server code, no environment variables. About 4 MB, of which 3.5 MB is data.

## Options

**GitHub Pages (set up already).** Push the repository to GitHub, then Settings › Pages › Source: _GitHub Actions_. `.github/workflows/deploy-pages.yml` publishes `app/` on every push to `main` that touches it. The site appears at `https://<user>.github.io/<repo>/`. All paths in the app are relative, so a sub-path works.

**Netlify, Cloudflare Pages, Vercel.** Connect the repository and set:

| Setting                    | Value    |
| -------------------------- | -------- |
| Build command              | _(none)_ |
| Publish / output directory | `app`    |

**Any web server or object storage** (S3, a university web space, nginx): upload the contents of `app/`.

## Recommended headers

Not required, but good practice if your host lets you set them:

| Path                    | Header                                                                                                                                                                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/data/manifest.json`   | `Cache-Control: no-cache`                                                                                                                                                                                                                                                                                                                                                                           | Always check for a new data release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/data/*` (other files) | `Cache-Control: public, max-age=31536000, immutable`                                                                                                                                                                                                                                                                                                                                                | Safe: the app requests them with a checksum query string, so a new release has new URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/*`                    | `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: https://cyberjapandata.gsi.go.jp; connect-src 'self' https://api.open-meteo.com https://nominatim.openstreetmap.org https://mreversegeocoder.gsi.go.jp https://msearch.gsi.go.jp https://photon.komoot.io` | Limits what the page can load to what it actually uses. `'unsafe-inline'` for styles is needed because the app sets inline styles. `connect-src` lists the live forecast, place-name and place-search services; without them the app still works, minus those features. The odds' live forecast is off by default (a checkbox turns it on), is only requested for trips within a week and only for the regions passing the filters, and each point is fetched at most once an hour and cached in `localStorage`, to stay inside Open-Meteo's free limits, which are shared by everyone behind one IP address. |

## Checklist before going public

- [ ] Choose a licence (see README).
- [ ] Keep the data credits in the About dialog.
- [ ] Map tiles come from 地理院タイル (GSI); their [terms](https://maps.gsi.go.jp/development/ichiran.html) ask for the attribution the app already shows.
- [ ] Fonts load from Google Fonts. To avoid the third-party request, self-host them in `app/fonts/` and update the `<link>` in `index.html`.
- [ ] Run `npm run check` and `cd pipeline && pytest && hoshimachi check`.

## Offline copy

`npm run build:single` writes `dist/hoshimachi.html`, a single 5 MB file with the data inside. It opens from disk with no server. Road and terrain base maps and web fonts still need an internet connection; everything else works offline.
