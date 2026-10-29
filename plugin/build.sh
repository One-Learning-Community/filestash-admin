#!/usr/bin/env bash
# Packages the built console as a Filestash plugin: dist/admin_svelte.zip.
# Drop the zip into data/state/plugins/ on a stock Filestash and restart; /admin then
# runs this console. Remove the zip to get the built-in admin back.
#
# The zip carries a patch for Filestash's public/assets/boot/ctrl_boot_backoffice.js
# that puts takeover.js at the top of that file. The patch is made from upstream's
# copy of the file at $UPSTREAM (a branch, tag or commit; default master), read from
# a local Filestash checkout when $FILESTASH_REPO is set, otherwise from GitHub. It
# only depends on the file's first three lines.
#
# Run through `npm run plugin`, which builds the console first.
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
UPSTREAM="${UPSTREAM:-master}"
TARGET="public/assets/boot/ctrl_boot_backoffice.js"
OUT="$ROOT/dist/admin_svelte.zip"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT

if [ -n "${FILESTASH_REPO:-}" ]; then
  ORIGINAL="$(git -C "$FILESTASH_REPO" show "$UPSTREAM:$TARGET")"
  FROM="$FILESTASH_REPO@$UPSTREAM"
else
  ORIGINAL="$(curl -fsSL "https://raw.githubusercontent.com/mickael-kerjean/filestash/$UPSTREAM/$TARGET")"
  FROM="github.com/mickael-kerjean/filestash@$UPSTREAM"
fi
[ -n "$ORIGINAL" ] || { echo "couldn't read $TARGET from $FROM" >&2; exit 1; }

VERSION="$(git -C "$ROOT" describe --tags --always --dirty)"
# goes on the end of the console's file addresses, so browsers fetch them again
# whenever they change (the server caches plugin files for 30 days)
BUST="$(cat "$ROOT"/build/index.* "$ROOT"/locales/*.json | shasum | cut -c1-12)"

# the patch, in git's diff format: upstream's file -> takeover.js + upstream's file
git -C "$W" init -q p
mkdir -p "$W/p/$(dirname "$TARGET")"
printf '%s\n' "$ORIGINAL" > "$W/p/$TARGET"
git -C "$W/p" add -A
git -C "$W/p" -c user.name=build -c user.email=build@localhost commit -qm upstream
{ sed "s/^const VERSION = \"dev\";/const VERSION = \"$BUST\";/" "$ROOT/plugin/takeover.js"; echo; echo "// ---- the built-in admin's boot code, never reached ----"; printf '%s\n' "$ORIGINAL"; } > "$W/p/$TARGET"
mkdir -p "$W/zip"
git -C "$W/p" diff > "$W/zip/boot.patch"

mkdir -p "$W/zip/admin" "$W/zip/locales/admin"
cp -R "$ROOT/build/." "$W/zip/admin/"
cp "$ROOT"/locales/*.json "$W/zip/locales/admin/"
cat > "$W/zip/manifest.json" <<JSON
{
  "author": "filestash-admin",
  "version": "$VERSION",
  "modules": [{ "type": "patch", "entrypoint": "boot.patch" }]
}
JSON

mkdir -p "$(dirname "$OUT")"; rm -f "$OUT"
(cd "$W/zip" && zip -qr -X "$OUT" .)
echo "$OUT ($VERSION, patch made from $FROM)"
