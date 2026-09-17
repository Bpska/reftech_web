# RefTech Portal
Vite + React + TypeScript public website and ERP starter.

## Media
The supplied RefTech video is the home hero background. The supplied reefer-truck and warehouse photos are under `public/media` and are used as the hero poster and ERP/warehouse visuals.

## Run
```bash
npm install
cp .env.example .env
npm run dev
```
Open `/` for the public site, `/login` for Employee/Partner login, and `/dashboard` for the starter ERP dashboard.

## Production
Set `VITE_API_URL=https://api.yourdomain.example`. The Netlify `_redirects` file keeps SPA routes working. Replace demo dashboard metrics with authenticated API data.
