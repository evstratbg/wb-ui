#!/bin/sh
# Package an already built frontend with the controller installer and notices.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output=${1:-"$root/wb-ui-static.tar.gz"}
case "$output" in
    /*) ;;
    *) output="$(pwd)/$output" ;;
esac

test -f "$root/frontend/dist/index.html"
staging=$(mktemp -d "${TMPDIR:-/tmp}/wb-ui-package.XXXXXX")
trap 'rm -rf "$staging"' EXIT HUP INT TERM
cp -R "$root/frontend/dist" "$staging/dist"
cp "$root/deploy/wb-ui.conf" "$root/deploy/install-on-device.sh" \
   "$root/deploy/remove-on-device.sh" "$root/LICENSE" \
   "$root/THIRD_PARTY_NOTICES.md" "$staging/"
cp -R "$root/licenses" "$staging/licenses"
revision=$(git -C "$root" rev-parse HEAD)
printf 'wb-ui commit: %s\nupstream: homeui v2.208.1-wb100 (0546d10e7ade2894baa5a828549900b708ca52a8)\n' \
    "$revision" > "$staging/BUILD_INFO.txt"
tar -czf "$output" -C "$staging" .
printf 'Created %s\n' "$output"
