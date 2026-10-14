# RefTech Portal: Docker and Nginx VPS Deployment

This guide deploys the Vite/React frontend in Docker. VPS Nginx remains the public reverse proxy and HTTPS endpoint.

## Architecture

    Internet HTTPS :443
        |
        v
    VPS Nginx
        |-- /api/* -> 127.0.0.1:8080 (reftech_core)
        +-- /*     -> 127.0.0.1:8081 (frontend container)

Docker Compose binds the frontend only to localhost, not the public network.

## 1. Requirements

Use an Ubuntu or Debian VPS with a domain such as portal.example.com, a DNS A record pointing to the VPS, ports 22/80/443 open, the backend on 127.0.0.1:8080, and a sudo user. At least 2 GB RAM is recommended for building.

Confirm DNS:

    dig +short portal.example.com
    curl -4 ifconfig.me

Both addresses must match.

## 2. Install Docker

    sudo apt update
    sudo apt install -y ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"

Log out and back in, then verify:

    docker version
    docker compose version

On Debian, replace linux/ubuntu with linux/debian in the Docker repository URL.

## 3. Install Nginx and firewall

    sudo apt install -y nginx ufw
    sudo systemctl enable --now nginx
    sudo ufw allow OpenSSH
    sudo ufw allow "Nginx Full"
    sudo ufw enable
    sudo ufw status

Do not expose ports 8080 or 8081 through the VPS firewall.

## 4. Put the project on the VPS

    sudo mkdir -p /opt/reftech
    sudo chown "$USER":"$USER" /opt/reftech
    cd /opt/reftech
    git clone YOUR_REPOSITORY_URL reftech_portal
    cd reftech_portal

Do not copy node_modules, dist, or the local .env.

## 5. Configure Docker

    cd /opt/reftech/reftech_portal
    cp deploy/docker/.env.example deploy/docker/.env
    nano deploy/docker/.env

Recommended same-domain values:

    IMAGE_TAG=2026-10-15
    FRONTEND_PORT=8081
    API_UPSTREAM=http://host.docker.internal:8080
    VITE_API_URL=
    VITE_MAP_PROVIDER=osm
    VITE_GOOGLE_MAPS_API_KEY=
    VITE_GOOGLE_MAPS_EMBED_KEY=
    VITE_OSM_TILE_URL=

VITE variables are compiled into the frontend. Rebuild after changing them. Keep VITE_API_URL empty when public Nginx serves both the site and /api on one domain. Never put secrets in a VITE variable.

Build and start:

    docker compose --env-file deploy/docker/.env build --pull frontend
    docker compose --env-file deploy/docker/.env up -d frontend
    docker compose --env-file deploy/docker/.env ps

Verify locally:

    curl -fsS http://127.0.0.1:8081/healthz
    curl -I http://127.0.0.1:8081/
    docker inspect --format='{{.State.Health.Status}}' reftech-portal

The health response must be ok and the container should become healthy.

## 6. Configure public Nginx

    sudo cp deploy/nginx/reftech-docker.conf /etc/nginx/sites-available/reftech-portal
    sudo nano /etc/nginx/sites-available/reftech-portal

Replace portal.example.com with the real domain.

    sudo ln -sfn /etc/nginx/sites-available/reftech-portal /etc/nginx/sites-enabled/reftech-portal
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx

Test HTTP:

    curl -I http://portal.example.com/
    curl -I http://portal.example.com/login
    curl -I http://portal.example.com/api/health

The login route must return the SPA, not 404. Use the correct backend health path if it differs.

## 7. Enable HTTPS

    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d portal.example.com

Choose redirect to HTTPS, then test renewal:

    sudo certbot renew --dry-run
    systemctl status certbot.timer
    curl -I https://portal.example.com/
    curl -I https://portal.example.com/login

HTTPS is required for service workers, notifications, and browser location.

## 8. Backend requirements

The backend should listen on 127.0.0.1:8080. Same-origin routing normally removes the need for CORS. Configure the backend to trust X-Forwarded-Proto, X-Forwarded-Host and X-Forwarded-For when it generates absolute links or secure cookies.

If the backend also runs in Docker, connect services through a Docker network. Remember that 127.0.0.1 inside a container means that container, not another container or the VPS.

## 9. Deploy an update

Use a unique image tag for each release:

    cd /opt/reftech/reftech_portal
    git pull --ff-only
    sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=2026-10-15-2/' deploy/docker/.env
    docker compose --env-file deploy/docker/.env build --pull frontend
    docker compose --env-file deploy/docker/.env up -d --no-deps frontend
    curl -fsS http://127.0.0.1:8081/healthz
    docker compose --env-file deploy/docker/.env ps

Nginx does not need to restart for a normal frontend update.

## 10. Roll back

List retained images:

    docker image ls reftech-portal

Set IMAGE_TAG in deploy/docker/.env to the previous tag, then run:

    docker compose --env-file deploy/docker/.env up -d --no-deps frontend
    curl -fsS http://127.0.0.1:8081/healthz

Do not prune old images until the release is verified.

## 11. Logs and troubleshooting

    docker compose --env-file deploy/docker/.env logs -f --tail=200 frontend
    sudo tail -f /var/log/nginx/reftech-portal.access.log
    sudo tail -f /var/log/nginx/reftech-portal.error.log
    sudo nginx -t
    sudo ss -lntp | grep -E ':(80|443|8080|8081)'
    curl -v http://127.0.0.1:8081/healthz
    curl -vk https://portal.example.com/

Common issues:

- 502 on the site: frontend container stopped or FRONTEND_PORT differs from the Nginx upstream.
- 502 on /api: backend is not listening on 127.0.0.1:8080.
- Nested route returns 404: traffic is bypassing the container SPA fallback.
- Old UI remains: hard refresh; index.html and sw.js use no-cache.
- Wrong API address: rebuild after changing VITE variables.
- Certificate failure: verify DNS and ports 80/443.
- Upload failure: verify the 30 MB limit in both Nginx layers and the backend.

## 12. Security and release checklist

- Patch Docker, Nginx and the OS.
- Use SSH keys and disable password root login.
- Publicly expose only ports 22, 80 and 443.
- Keep backend and frontend ports on localhost.
- Never put secrets in VITE variables because browsers can read them.
- Back up backend data and uploads; the frontend container is disposable.
- After every release test /, /login, a direct nested route, /healthz, and one authenticated API request.