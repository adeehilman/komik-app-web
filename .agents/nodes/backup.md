# Node: Backup & restore (ops)

Dua lapis (decisions D-10):

| Lapis | Isi | Kapan dibuat | Restore lewat |
|---|---|---|---|
| `.tachibk` (Suwayomi) | Library, kategori, chapter (status baca), tracking, history, **client data (meta `mihonweb_*`)**, setelan server | Otomatis harian di `data/backups/` (simpan 14 hari) + manual dari WebUI More → Backup | WebUI (`features/backup-ui.md`) |
| Arsip disk `scripts/backup.sh` | Seluruh `./data` (DB H2, extension, cache, `server.conf`) | Manual | Ekstrak tar (`workflows/runbook.md`) |

## `scripts/backup.sh`

```
set -euo pipefail
docker compose stop suwayomi            # gagal stop = berhenti; jangan tar H2 yang sedang ditulis
trap '… docker compose start suwayomi' EXIT   # server selalu dinyalakan lagi walau tar gagal
tar czf backups/suwayomi-YYYY-MM-DD-HHMM.tar.gz data/
docker compose start suwayomi
ls -1t backups/suwayomi-*.tar.gz | tail -n +8 | xargs -r rm -f   # simpan 7 terakhir
```

- Ukuran ±90 MB, server mati ±1 menit.
- Batasan desain: satu file shell, tanpa Python, cron daemon custom, upload cloud, enkripsi, notifikasi.
- Jadwal otomatis belum ada (bisa lewat Windows Task Scheduler — butuh keputusan pemilik).

## Restore — jebakan yang sudah terjadi

- `tar xzf` di **Git Bash** gagal membuat 4 symlink KCEF (`data/bin/kcef → /opt/kcef/jcef`,
  `data/cache/kcef/Singleton*`) dan keluar dengan status gagal. **Aman**: KCEF membuat ulang tautannya saat
  server start (terbukti dengan boot server dari data hasil restore). Error lain tetap berarti arsip rusak.
- Uji restore selalu di folder/port terpisah:
  `docker run --rm -d --name suwayomi-restore-test -p 127.0.0.1:4568:4567 -v <restore>/data:/home/suwayomi/.local/share/Tachidesk ghcr.io/suwayomi/suwayomi-server:latest`
  (di Git Bash: `MSYS_NO_PATHCONV=1` dan path Windows dari `cygpath -w`).
- Restore `.tachibk` ke server yang sedang dipakai = STOP, minta izin manusia.
