#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "install.sh must run as root" >&2
  exit 1
fi

ts=$(date +%Y%m%d%H%M%S)
bak="/root/scratch-bak-${ts}"
mkdir -p "$bak"

if [ -d /opt/maotaiworks/scratch-account ]; then
  cp -a /opt/maotaiworks/scratch-account "$bak/scratch-account"
fi

if [ -d /var/lib/maotaiworks/scratch/data ]; then
  cp -a /var/lib/maotaiworks/scratch/data "$bak/data"
fi

src=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
install -d /opt/maotaiworks/scratch-account
rsync -a --delete \
  --exclude node_modules \
  "$src/" /opt/maotaiworks/scratch-account/
rm -rf /opt/maotaiworks/scratch-account/node_modules
chown -R www-data:www-data /opt/maotaiworks/scratch-account

if [ -f /opt/maotaiworks/scratch-account/maotaiworks-scratch.service ]; then
  cp /opt/maotaiworks/scratch-account/maotaiworks-scratch.service /etc/systemd/system/maotaiworks-scratch.service
  systemctl daemon-reload
fi

systemctl restart maotaiworks-scratch
echo "scratch-account installed; backup at $bak"
