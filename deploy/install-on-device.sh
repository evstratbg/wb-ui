#!/bin/sh
# Run on the controller as root after copying dist/ and wb-ui.conf to staging.
set -eu

staging=${1:?Usage: install-on-device.sh /path/to/staging}
base=/mnt/data/wb-ui
config=/etc/nginx/conf.d/wb-ui.conf
release=$(date -u +%Y%m%dT%H%M%SZ)

test -f "$staging/dist/index.html"
test -f "$staging/wb-ui.conf"
if [ -e "$config" ] && ! grep -q 'Wiren Board UI concept' "$config"; then
    echo "Refusing to replace an unrelated nginx configuration: $config" >&2
    exit 1
fi
if [ ! -e "$config" ] && ss -ltn | awk '{print $4}' | grep -q ':8080$'; then
    echo 'Port 8080 is already in use.' >&2
    exit 1
fi

mkdir -p "$base/releases/$release"
cp -R "$staging/dist/." "$base/releases/$release/"
chmod -R a+rX "$base/releases/$release"
previous=$(readlink "$base/current" || true)
had_config=false
if [ -e "$config" ]; then
    cp "$config" "$base/nginx.previous.conf"
    had_config=true
fi
if [ -n "$previous" ]; then
    printf '%s\n' "$previous" > "$base/previous-release"
fi
ln -s "releases/$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
cp "$staging/wb-ui.conf" "$config"

if nginx -t && systemctl reload nginx; then
    :
else
    if [ "$had_config" = true ]; then
        cp "$base/nginx.previous.conf" "$config"
    else
        rm -f "$config"
    fi
    if [ -n "$previous" ]; then
        ln -s "$previous" "$base/current.rollback"
        mv -Tf "$base/current.rollback" "$base/current"
    else
        rm -f "$base/current"
    fi
    if nginx -t && systemctl reload nginx; then
        echo 'nginx validation or reload failed; the previous configuration was restored and reloaded.' >&2
    else
        echo 'Previous files restored, but nginx could not reload. Check systemctl status nginx.' >&2
    fi
    exit 1
fi

curl --fail --silent --show-error --max-time 10 --retry 5 --retry-delay 1 --retry-connrefused http://127.0.0.1:8080/ > /dev/null
curl --fail --silent --show-error --max-time 10 --retry 5 --retry-delay 1 --retry-connrefused http://127.0.0.1:8080/device/info > /dev/null
printf '\nInstalled %s on port 8080.\n' "$release"
