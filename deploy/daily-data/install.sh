#!/bin/bash
# Install the daily data job. Does not start or enable the timer.
# Run from this directory: sudo ./install.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo ./install.sh" >&2
  exit 1
fi

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET=/opt/maotaiworks-daily
ENV_FILE=/etc/maotaiworks/daily.env
NODE_BIN="$(command -v node || true)"

if [[ -z "${NODE_BIN}" ]]; then
  echo "node is not on PATH. Install Node.js 20 or newer, then re-run." >&2
  exit 1
fi

NODE_MAJOR="$("${NODE_BIN}" -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Node ${NODE_MAJOR} is too old. Need Node.js 20 or newer (${NODE_BIN})." >&2
  exit 1
fi

mkdir -p "${TARGET}"
rsync -a \
  --exclude node_modules \
  --exclude .env \
  --exclude daily.env \
  --exclude '*.log' \
  "${SRC}/" "${TARGET}/"
chown -R root:root "${TARGET}"
chmod 755 "${TARGET}/bin/run.mjs"

cd "${TARGET}"
npm ci --omit=dev

install -d -m 755 /etc/maotaiworks /var/log/maotaiworks
chown www-data:www-data /var/log/maotaiworks

if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 600 -o root -g root "${TARGET}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE} from the example. Put a real LLM_API_KEY in it before relying on summaries."
else
  chmod 600 "${ENV_FILE}"
  chown root:root "${ENV_FILE}"
  echo "Kept existing ${ENV_FILE}."
fi

DIST_DIR="$(
  awk -F= '
    $0 ~ /^[[:space:]]*DIST_DIR=/ {
      value=$2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^["'\'']|["'\'']$/, "", value)
      print value
    }
  ' "${ENV_FILE}" | tail -n 1
)"
if [[ -z "${DIST_DIR}" ]]; then
  DIST_DIR=/var/www/maotaiworks/dist
fi

if [[ -d "${DIST_DIR}" ]]; then
  for rel in ai-daily ai-skills arena-data arena-data/v; do
    install -d -o www-data -g www-data -m 755 "${DIST_DIR}/${rel}"
  done
else
  echo "DIST_DIR does not exist yet (${DIST_DIR}). Create the site root, then re-run this script so www-data can write the three data directories."
fi

sed "s|NODE_BIN|${NODE_BIN}|" "${TARGET}/maotaiworks-daily.service" > /etc/systemd/system/maotaiworks-daily.service
install -m 644 "${TARGET}/maotaiworks-daily.timer" /etc/systemd/system/maotaiworks-daily.timer
systemctl daemon-reload

cat <<EOF

Installed to ${TARGET} using ${NODE_BIN}.
The timer is not enabled yet.

Edit the key file (mode 600, not in git):
  sudoedit ${ENV_FILE}

Dry-run (writes a temp directory, prints that path):
  sudo -u www-data ${NODE_BIN} ${TARGET}/bin/run.mjs --dry-run

Manual run into DIST_DIR:
  sudo -u www-data ${NODE_BIN} ${TARGET}/bin/run.mjs --all

Enable the 07:30 Asia/Shanghai timer:
  sudo systemctl enable --now maotaiworks-daily.timer

Logs:
  journalctl -u maotaiworks-daily.service
  /var/log/maotaiworks/daily.log
EOF
