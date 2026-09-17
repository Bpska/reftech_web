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

## Home hero media rotation
The home hero now rotates all three supplied media assets one at a time every 7 seconds:
1. `/public/media/reftech_video.mp4`
2. `/public/media/reftech_truck.jpeg`
3. `/public/media/reftech_warehouse.jpeg`

The three dots near the bottom of the hero can also be clicked to switch media manually.
