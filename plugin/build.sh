#!/usr/bin/env bash
# Packages the built admin console as a Filestash plugin: admin/dist/admin_svelte.zip.
# Drop the zip into data/state/plugins/ on a stock Filestash and restart; /admin then
# runs this console. Remove the zip to get the built-in admin back.
#
# The zip carries a patch for upstream's public/assets/boot/ctrl_boot_backoffice.js
# that puts takeover.js at the top of that file. The patch is made from the file at
# $UPSTREAM (default origin/master) and only depends on its first three lines.
#
# Run through `npm run plugin`, which builds the console first.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HERE="$ROOT/admin/plugin"
UPSTREAM="${UPSTREAM:-origin/master}"
TARGET="public/assets/boot/ctrl_boot_backoffice.js"
OUT="$ROOT/admin/dist/admin_svelte.zip"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT

ORIGINAL="$(git -C "$ROOT" show "$UPSTREAM:$TARGET")"

# the patch, in git's diff format: upstream's file -> takeover.js + upstream's file
git -C "$W" init -q p
mkdir -p "$W/p/$(dirname "$TARGET")"
printf '%s\n' "$ORIGINAL" > "$W/p/$TARGET"
git -C "$W/p" add -A
git -C "$W/p" -c user.name=build -c user.email=build@localhost commit -qm upstream
{ cat "$HERE/takeover.js"; echo; echo "// ---- the built-in admin's boot code, never reached ----"; printf '%s\n' "$ORIGINAL"; } > "$W/p/$TARGET"
mkdir -p "$W/zip"
git -C "$W/p" diff > "$W/zip/boot.patch"

mkdir -p "$W/zip/admin" "$W/zip/locales"
cp -R "$ROOT/public/assets/admin/." "$W/zip/admin/"
cp -R "$ROOT/public/assets/locales/admin" "$W/zip/locales/admin"
# the server prefers .br/.gz siblings only for its own files; keep the zip lean
find "$W/zip" \( -name '*.br' -o -name '*.gz' \) -delete

VERSION="$(git -C "$ROOT" rev-parse --short HEAD)"
git -C "$ROOT" diff --quiet HEAD -- admin public/assets/admin public/assets/locales/admin || VERSION="$VERSION-dirty"
cat > "$W/zip/manifest.json" <<JSON
{
  "author": "admin_svelte",
  "version": "$VERSION",
  "modules": [{ "type": "patch", "entrypoint": "boot.patch" }]
}
JSON

mkdir -p "$(dirname "$OUT")"; rm -f "$OUT"
(cd "$W/zip" && zip -qr -X "$OUT" .)
echo "$OUT ($VERSION, patch made from $UPSTREAM:$TARGET)"
