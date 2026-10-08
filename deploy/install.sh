#!/usr/bin/env bash
# RefTech Technology Company - CONFIDENTIAL.
# Installs a portal release on the server and switches to it.
#   sudo deploy/install.sh reftech-portal-0.2.3.tar.gz
# Result:
#   /opt/reftech/portal/releases/0.2.3/   the built files (index.html, assets/, media/ ...)
#   /opt/reftech/portal/current           -> releases/0.2.3   (what nginx serves)
# Roll back: sudo ln -sfn releases/<older version> /opt/reftech/portal/current && sudo systemctl reload nginx
set -euo pipefail

ARCHIVE="${1:?Usage: install.sh reftech-portal-<version>.tar.gz}"
BASE="${REFTECH_PORTAL_HOME:-/opt/reftech/portal}"
VERSION="$(basename "$ARCHIVE" | sed -E 's/^reftech-portal-(.+)\.tar\.gz$/\1/')"
[ "$VERSION" != "$(basename "$ARCHIVE")" ] || { echo "File name must be reftech-portal-<version>.tar.gz" >&2; exit 1; }

TARGET="$BASE/releases/$VERSION"
mkdir -p "$BASE/releases" "$BASE/logs"
rm -rf "$TARGET.tmp"
mkdir -p "$TARGET.tmp"
tar -xzf "$ARCHIVE" -C "$TARGET.tmp"
[ -f "$TARGET.tmp/index.html" ] || { echo "No index.html in $ARCHIVE" >&2; rm -rf "$TARGET.tmp"; exit 1; }
rm -rf "$TARGET"
mv "$TARGET.tmp" "$TARGET"
ln -sfn "releases/$VERSION" "$BASE/current"
echo "Portal $VERSION installed: $BASE/current -> releases/$VERSION"

if command -v nginx >/dev/null 2>&1; then
  nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload) && echo "nginx reloaded."
fi
