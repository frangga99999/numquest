#!/usr/bin/env bash
# Pasang ulang NumQuest di VPS: tarik kode, bangun frontend, nyalakan servis.
# Dipakai manual maupun dari Telegram (lihat skill numquest-vps).
#
#   ./scripts/deploy-vps.sh              # tarik dari git lalu bangun
#   SKIP_PULL=1 ./scripts/deploy-vps.sh  # bangun apa adanya (kode diedit langsung)
#   SKIP_INSTALL=1 ./scripts/deploy-vps.sh  # lompati npm ci (package.json tidak berubah)

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
PORT="$(sed -n 's/^PORT=//p' .env 2>/dev/null | tail -1)"
PORT="${PORT:-8790}"
SERVICE="numquest.service"

echo "==> NumQuest deploy di $ROOT"

if [[ "${SKIP_PULL:-0}" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "!! Ada perubahan lokal yang belum di-commit:" >&2
    git status --short >&2
    echo "!! Commit dulu, atau jalankan dengan SKIP_PULL=1 untuk memakai kode apa adanya." >&2
    exit 1
  fi
  echo "==> git pull"
  git pull --ff-only
fi

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  echo "==> npm ci"
  npm ci --no-fund --no-audit --silent
fi

echo "==> build (VITE_API=/api — satu asal, tanpa domain)"
VITE_API=/api npm run build

echo "==> restart $SERVICE"
systemctl --user restart "$SERVICE"
sleep 2

systemctl --user is-active "$SERVICE" || {
  echo "!! Servis tidak aktif. 200 baris terakhir log:" >&2
  journalctl --user -u "$SERVICE" -n 200 --no-pager >&2
  exit 1
}

CODE="$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo 000)"
echo "==> sehat: HTTP $CODE di http://127.0.0.1:${PORT}/"
[[ "$CODE" == "200" ]] || { echo "!! Frontend tidak menjawab 200" >&2; exit 1; }

echo "==> selesai. Publik: http://43.134.180.13:${PORT}/"
