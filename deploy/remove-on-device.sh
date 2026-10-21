#!/bin/sh
# Disable only the additional UI server; keep release files for recovery.
set -eu
config=/etc/nginx/conf.d/wb-ui.conf
test -e "$config" || exit 0
grep -q 'Wiren Board UI concept' "$config"
mv "$config" /mnt/data/wb-ui/nginx.disabled.conf
if nginx -t && systemctl reload nginx; then
    echo 'Additional UI on port 8080 disabled. Release files retained.'
else
    mv /mnt/data/wb-ui/nginx.disabled.conf "$config"
    if nginx -t && systemctl reload nginx; then
        echo 'nginx validation or reload failed; configuration restored and reloaded.' >&2
    else
        echo 'Configuration restored, but nginx could not reload. Check systemctl status nginx.' >&2
    fi
    exit 1
fi
