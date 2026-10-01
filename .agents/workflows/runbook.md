# Runbook (operasi)

> **Hanya perintah yang sudah pernah dijalankan betulan**, kecuali yang ditandai ⚠️ *belum pernah dijalankan*. Host: **Windows 11 + Docker Desktop**, shell **Git Bash**.
> Akses: **Tailscale** `https://<tailnet-host>.ts.net` (tailnet only) — bukan port forwarding.

---

## Operasi harian

```bash
cd "/d/Clean Folder/Gabut/suwayomi"

docker compose up -d          # start / terapkan perubahan docker-compose.yml
docker compose restart        # restart (setelan & library tetap)
docker compose ps             # status → harus "Up", port 127.0.0.1:4567
docker logs suwayomi --tail 100

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567   # 200 = hidup
tailscale serve status        # harus: https://<tailnet-host>… (tailnet only) → http://127.0.0.1:4567
```

Setelah reboot Windows tidak perlu apa-apa: Docker Desktop `AutoStart: true` dan container
`restart: unless-stopped` (dicek 2026-10-01; uji reboot sungguhan masih menunggu manusia).

## WebUI (Mihon-style) — build ulang & deploy

```bash
cd "/d/Clean Folder/Gabut/suwayomi/webui"
npm run build                 # hasil ke webui/dist (di-mount read-only ke container)
cd ..
docker compose restart        # WAJIB: server menyalin webUI ke folder serve hanya saat start
curl -s http://127.0.0.1:4567/ | grep -o "<title>[^<]*</title>"   # → <title>Mihon</title>
```

Rollback ke WebUI resmi: hapus baris mount `./webui/dist:…/webUI:ro` dan `WEB_UI_FLAVOR: Custom` di
`docker-compose.yml`, lalu `docker compose up -d`. ⚠️ *Rollback belum pernah dijalankan.*

Mengembangkan WebUI tanpa deploy: `cd webui && npx vite --host 127.0.0.1` → `http://127.0.0.1:5173`
(proxy `/api` ke server).

## Backup

```bash
bash scripts/backup.sh        # stop → tar data/ → start → simpan 7 arsip terakhir (~91 MB, ±1 menit server mati)
ls -lh backups/
tar tzf backups/<file>.tar.gz | head
```

Selain itu server membuat backup `.tachibk` harian sendiri di `data/backups/` (default Suwayomi), dan
backup `.tachibk` bisa dibuat/unduh/restore dari WebUI: **More → Backup & restore**.

## Restore

Yang **sudah diuji** (2026-10-01) — ekstrak ke folder sementara lalu boot server kedua di port 4568:

```bash
mkdir -p /tmp/restore-test-20261001
tar xzf backups/<file>.tar.gz -C /tmp/restore-test-20261001     # 4 pesan symlink KCEF = normal, lihat #3
WR=$(cygpath -w /tmp/restore-test-20261001/data)
MSYS_NO_PATHCONV=1 docker run --rm -d --name suwayomi-restore-test -p 127.0.0.1:4568:4567 \
  -v "$WR:/home/suwayomi/.local/share/Tachidesk" ghcr.io/suwayomi/suwayomi-server:latest
curl -s -X POST http://127.0.0.1:4568/api/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ extensions(condition:{isInstalled:true}) { nodes { name } } mangas { totalCount } }"}'
docker stop suwayomi-restore-test
```

Mengganti `./data` yang dipakai — ⚠️ *belum pernah dijalankan pada data asli*:

```bash
docker compose stop
mv data data.broken-$(date +%F)
tar xzf backups/<file>.tar.gz
docker compose up -d
```

Jangan hapus `data.broken-*` sampai dipastikan restore-nya benar.

## Update Suwayomi — ⚠️ belum pernah dijalankan

```bash
bash scripts/backup.sh        # backup DULU, selalu
docker compose pull
docker compose up -d
docker compose ps
```

Kalau update bikin rusak → restore dari backup terbaru (lihat di atas).

---

## Troubleshooting

### 1. Port forwarding & sertifikat Let's Encrypt gagal — CGNAT
**Gejala:** dari iPhone (data seluler) "unexpectedly closed connection"; log Caddy:
`challenge failed … "<IP publik>: Connection refused"` (tls-alpn-01 dan http-01).
**Penyebab:** ISP memakai CGNAT. WAN IP router (privat `10.x`) ≠ IP publik; hop ke-2
traceroute sudah privat (`10.x`). Gate awal hanya mengecek `100.64.0.0/10` sehingga lolos keliru.
**Perbaikan:** jalur 4-A ditinggalkan. Akses lewat Tailscale: `tailscale serve --bg 4567` (tailnet only),
`caddy stop`. Sisa yang masih harus dihapus manusia: port forward 80/443, rule firewall Caddy, DNS A record lama.
**Tanggal ketemu:** 2026-09-30

### 2. WebUI/API tidak menjawab (`curl` → `000`) — Docker Desktop tidak jalan
**Gejala:** `curl http://127.0.0.1:4567` → `000`; `docker ps` →
`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
**Penyebab:** Docker Desktop belum dibuka setelah login Windows, jadi container ikut mati.
**Perbaikan:** buka Docker Desktop; container nyala sendiri (`restart: unless-stopped`), tidak perlu
`docker compose up`. Pencegahan: Docker Desktop → Settings → General → *Start Docker Desktop when you sign in*
(sudah aktif: `"AutoStart": true` di `%APPDATA%\Docker\settings-store.json`).
**Tanggal ketemu:** 2026-10-01

### 3. `tar xzf` di Git Bash: `Cannot create symlink … Exiting with failure status`
**Gejala:** saat ekstrak backup muncul 4 error untuk `data/cache/kcef/Singleton*` dan
`data/bin/kcef -> /opt/kcef/jcef`; `tar` keluar dengan status gagal.
**Penyebab:** Git Bash di Windows tidak bisa membuat symlink. Keempatnya symlink milik KCEF (Chromium untuk
source ber-Cloudflare): tiga file lock runtime dan satu tautan ke binary di dalam image.
**Perbaikan:** tidak perlu tindakan. Uji boot dari data hasil restore: server jalan dalam ±3 detik, extension,
repo, setelan, meta utuh, dan KCEF membuat ulang tautannya sendiri (`…/bin/kcef/libcef.so` termuat di log).
Abaikan exit code tar untuk 4 pesan ini saja; error lain tetap berarti arsip rusak.
**Tanggal ketemu:** 2026-10-01

---

## Cek cepat kalau tiba-tiba tidak bisa diakses dari iPhone

Urut dari dalam ke luar:

```bash
# 1. Docker hidup? (penyebab #2)
docker compose ps

# 2. Server jawab di loopback?
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567

# 3. Tailscale meneruskan?
tailscale serve status
curl -s -o /dev/null -w "%{http_code}\n" https://<tailnet-host>.ts.net/

# 4. iPhone ada di tailnet?
tailscale status              # perangkat iPhone harus terdaftar, bukan offline
```

Kalau 1–3 hijau tapi iPhone tetap gagal → aplikasi Tailscale di iPhone mati / belum login. Bukan Suwayomi.

---

## Yang TIDAK boleh dilakukan

- `docker compose down -v` → menghapus volume, library hilang
- Edit isi `./data/` dengan tangan → database H2 bisa korup
- Buka port `4567` (atau 80/443) ke internet / port forwarding → server tanpa auth (`AUTH_MODE: none`)
- `tailscale funnel` → membuka ke internet publik; yang dipakai hanya `tailscale serve` (tailnet only)
- Menambah env `UPDATE_*` / `AUTO_DOWNLOAD_*` di compose → menimpa setelan dari WebUI tiap restart
- Commit `.env` ke git
