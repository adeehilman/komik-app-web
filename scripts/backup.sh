#!/usr/bin/env bash
# Backup ./data (H2 DB + extension + setelan) ke backups/, simpan 7 terakhir. Detail: .agents/nodes/backup.md
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups

BACKUP_NAME="backups/suwayomi-$(date +%F-%H%M).tar.gz"

echo "[1/4] Menghentikan container suwayomi..."
# Gagal stop = berhenti di sini. Jangan men-tar database H2 yang sedang ditulis.
docker compose stop suwayomi

# Apa pun yang terjadi setelah ini (tar gagal, Ctrl+C), server dinyalakan lagi.
trap 'echo "[3/4] Menyalakan kembali suwayomi..."; docker compose start suwayomi' EXIT

echo "[2/4] Membuat arsip $BACKUP_NAME..."
tar czf "$BACKUP_NAME" data/

trap - EXIT
echo "[3/4] Menyalakan kembali suwayomi..."
docker compose start suwayomi

echo "[4/4] Merotasi backup (menyimpan 7 arsip terakhir)..."
ls -1t backups/suwayomi-*.tar.gz | tail -n +8 | xargs -r rm -f

echo "Backup selesai: $BACKUP_NAME ($(du -h "$BACKUP_NAME" | cut -f1))"
