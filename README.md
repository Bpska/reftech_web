<!--
RefTech Technology Company
CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
company. Copying it, or sharing it with anyone outside the company without written permission, is a
violation of law.
-->
# RefTech Portal

Web front end of the RefTech cold-chain ERP: the public company website plus the ERP screens used by RefTech
staff, drivers, transporters and customers (partners). All data comes from the backend
[`reftech_core`](https://github.com/prakashmahali/reftech_core).

**Version:** 0.2.3. **Stack:** React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6, lucide-react icons and
Vitest. The interface is available in English, Hindi and Odia.

## What it contains

| Part | Where | Main pages |
|---|---|---|
| Public website | `src/website/` | `/` (home, services, industries, technology, contact) |
| Sign-in and account | `src/modules/auth/` | `/login`, `/forgot-password`, `/account/password`, `/me` |
| Dashboard and operations | `dashboard`, `trip`, `partload`, `dispatch` | `/dashboard`, `/operations`, `/trips/:id`, `/loads`, `/part-load`, `/dispatch/...`, `/delays` |
| Cold chain and compliance | `coldchain`, `compliance` | `/cold-chain/...`, `/excursions`, `/temperature-profiles`, `/device-events`, `/compliance`, `/quality-holds` |
| Tracking | `tracking` | `/tracking`, `/control-tower`, `/gps`, `/tracking/...` (geofences, playback, reefers, e-way watch) |
| Proof of delivery | `pod` | `/pod/check`, `/pod/review` |
| Warehouse | `warehouse`, `inventory` | `/warehouse/...` (inbound, putaway, stock, outbound, transfers, returns, billing, reports) |
| Transporters and tenders | `transporter`, `tender`, `allocation`, `transporterportal` | `/transporters/...`, `/tenders`, `/vehicle-requests`, `/fleet-calendar`, `/transporter` (transporter's own portal) |
| C&F operations | `cnf` | `/cnf` |
| Fleet and maintenance | `fleet`, `maintenance` | `/admin/vehicles`, `/maintenance`, `/expenses` |
| Billing and finance | `billing` | `/billing/...` (per-ton, rate contracts, payments, GST, Tally, payables, profitability), `/admin/finance` |
| Government data | `gov` | `/gov/...` (alerts, tolls, vehicles, challans, licences, GST, FSSAI) |
| HR and access | `hr`, `admin` | `/admin/hr`, `/admin/access`, `/hr/...` (attendance, leave, payroll, letters, documents, driver safety) |
| Driver mobile screens | `driver` | `/driver`, `/driver/:tripId`, `/driver/me` |
| Customer links (no sign-in) | `tracking`, `pod` | `/track/:token`, `/share-location/:token` |
| Platform administration | `platform` | `/platform/...` (companies, plans, audit, privacy, backups, health, jobs, notifications, files, API keys) |

Shared code is in `src/shared/`. It holds the API client (`services/api.ts`), the map (`services/liveMap.ts`),
common components, translations (`i18n/`) and accessibility settings (`a11y/`). Routes are defined in `src/App.tsx`.
Import modules with the `@/` alias, which points to `src/`.

## Prerequisites

- **Node.js 20** or newer (with npm)
- A running **reftech_core** backend (default `http://localhost:8080`). Without it, only the public website works.

## 1. Configure

The portal has **one settings file: `.env`** in the project root. It is not committed to git. Copy the example
and edit it:

```bash
cp .env.example .env
```

| Variable | Required | What |
|---|---|---|
| `VITE_API_URL` | **yes** | address of `reftech_core`, without a trailing slash. Local: `http://localhost:8080`. Production: e.g. `https://api.yourdomain.com` |
| `VITE_GOOGLE_MAPS_API_KEY` | no | Google Maps on Live Tracking (enable "Maps JavaScript API"). Empty = OpenStreetMap, which needs no key |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | no | Google Maps Embed API key for the trip detail map. Empty = keyless embed |
| `VITE_MAP_PROVIDER` | no | `osm` forces OpenStreetMap even when a Google key is set |
| `VITE_OSM_TILE_URL` | no | your own map tile server. The default public OpenStreetMap server is for development and light use only |

Vite builds these values **into the JavaScript bundle**. After changing `.env`, restart `npm run dev` or run
`npm run build` again. Anything in `.env` is visible to whoever opens the site, so never put a server secret there.
For Google keys, restrict them to your domain in the Google Cloud console.

The backend has to accept the portal's address (CORS). Today `reftech_core` allows only
`http://localhost:5173` and `http://127.0.0.1:5173`, so keep the dev server on port 5173. For any other address,
see the "Portal address (CORS)" note in the `reftech_core` README.

## 2. Run for development

```bash
npm install
cp .env.example .env      # first time only, then edit it
npm run dev
```

Open <http://localhost:5173>.

- `/`: public website
- `/login`: sign in as **Employee** or **Partner**. With the backend's test data loaded, `test.staff` /
  `Test@12345` works (see the `reftech_core` README)
- `/dashboard`: the ERP, after signing in

## 3. Build for production

```bash
npm ci
npm run build             # output in dist/
npm run preview           # optional: serve dist/ locally to check it
npm run package           # build + reftech-portal-<version>.tar.gz, for deploy/install.sh
```

**Our server setup (nginx under `/opt/reftech`):**
- `deploy/install.sh reftech-portal-<version>.tar.gz` unpacks the build into `/opt/reftech/portal/releases/<version>`,
  points `/opt/reftech/portal/current` at it and reloads nginx. To roll back, point `current` at an older release.
- `deploy/nginx/reftech.conf` is the nginx site. It serves the portal and forwards `/api/` to `reftech_core` on
  `127.0.0.1:8080`, so portal and API share one address. Build with `VITE_API_URL` set to that same address,
  e.g. `https://erp.yourdomain.com`.
- Full steps and the folder structure are in the `reftech_core` repository: `docs/DEPLOYMENT.md`.

**Any other static host** (Netlify, S3 + CloudFront, IIS and so on) works too. The app uses browser routing, so
every unknown path must return `index.html`:

- **Netlify:** already handled by `public/_redirects`.
- **Nginx:** `location / { try_files $uri /index.html; }`
- **Other hosts:** configure a single-page-app fallback to `index.html`.

Serve the site over HTTPS. Push notifications (`public/sw.js`) and the driver's location sharing need it.

## 4. Check and test

| Command | What |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | unit tests (Vitest), 73 tests |

## Notes

- `node_modules/` and `dist/` are not committed. Run `npm install` after cloning.
- Media for the website hero (video, truck and warehouse photos) is in `public/media/`.
