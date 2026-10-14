# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_API_URL=
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_GOOGLE_MAPS_EMBED_KEY=
ARG VITE_MAP_PROVIDER=
ARG VITE_OSM_TILE_URL=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_EMBED_KEY=$VITE_GOOGLE_MAPS_EMBED_KEY
ENV VITE_MAP_PROVIDER=$VITE_MAP_PROVIDER
ENV VITE_OSM_TILE_URL=$VITE_OSM_TILE_URL

RUN npm run build

FROM nginx:stable-alpine AS runtime
ENV API_UPSTREAM=http://host.docker.internal:8080

COPY deploy/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]