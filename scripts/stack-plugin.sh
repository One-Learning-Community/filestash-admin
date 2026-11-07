#!/usr/bin/env bash
# Installs dist/admin_svelte.zip into the dev server from compose.yaml and
# restarts it, so /admin runs the plugin. Run through `npm run stack:plugin`,
# which builds the zip first.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
ZIP=dist/admin_svelte.zip
DEST=/app/data/state/plugins

[ -f "$ZIP" ] || { echo "no $ZIP: run npm run plugin first" >&2; exit 1; }
docker compose up -d --wait filestash
docker compose exec -T filestash mkdir -p "$DEST"
docker compose cp "$ZIP" "filestash:$DEST/admin_svelte.zip"
# docker cp writes the file as root; the image refuses to start otherwise
docker compose exec -T -u root filestash chown filestash:filestash "$DEST/admin_svelte.zip"
docker compose restart filestash
docker compose up -d --wait filestash
echo "Plugin installed: http://localhost:${FILESTASH_PORT:-18334}/admin (password: admin)"
