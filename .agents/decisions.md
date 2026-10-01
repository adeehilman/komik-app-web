# Keputusan (ADR ringkas)

Format: **keputusan** — alasan — konsekuensi. Yang masih berlaku di atas; yang sudah diganti di bawah.

## Berlaku

### D-01 Deploy Suwayomi-Server, bukan membangun ulang (2026-09-30)
Extension Mihon butuh runtime Android; Suwayomi sudah menyediakannya (AndroidCompat).
→ Kita hanya mengelola konfigurasi, volume, dan frontend.

### D-02 Akses lewat Tailscale `serve`, bukan port forwarding (2026-09-30, pemilik)
ISP memakai **CGNAT**: WAN IP router (privat, `10.x`) ≠ IP publik; challenge Let's Encrypt
ditolak. Port forwarding mustahil.
→ `tailscale serve --bg 4567` (tailnet only). Tidak ada port terbuka. Caddy & Caddyfile dihapus.

### D-03 `AUTH_MODE: none` (2026-09-30, pemilik)
Kontrol akses = keanggotaan tailnet + bind loopback. Login di setiap buka aplikasi dianggap tidak perlu.
→ **Jangan pernah** membuka jalur selain Tailscale. Kalau suatu saat perlu akses publik, D-03 harus dibatalkan dulu.

### D-04 Host = Windows 11 + Docker Desktop (2026-09-30)
Mesin yang tersedia adalah Windows. Shell kerja: Git Bash (perintah POSIX) atau PowerShell.
→ "reboot" = reboot Windows; Docker Desktop `AutoStart: true` wajib menyala.

### D-05 WebUI custom ala Mihon (2026-09-30, pemilik)
WebUI resmi terasa kurang seperti Mihon di iPhone. `WEB_UI_FLAVOR: Custom` + mount `./webui/dist`
ke `…/Tachidesk/webUI` (read-only). Server menyalin folder ini saat start → **perubahan perlu restart**.
Rollback: hapus mount + env → `docker compose up -d`.

### D-06 Stack WebUI dikunci (2026-09-30)
Vite + React + TypeScript + React Router (HashRouter) + TanStack Query + CSS biasa (CSS variables).
Tanpa Apollo/codegen, tanpa UI library, tanpa state manager global, tanpa Tailwind.
Alasan: dependency minimal, hasil build statis murni, mudah dikerjakan model kecil.

### D-07 Setelan WebUI disimpan di server (global meta), bukan localStorage (2026-09-30)
Storage Safari/PWA iPhone bisa terhapus dan terpisah antara tab & Home Screen.
→ Meta `mihonweb_*`; localStorage hanya cache. Ikut backup `.tachibk`.

### D-08 Skema GraphQL dari introspection server sendiri (2026-10-01, senior)
Introspection ternyata aktif (klaim awal "kosong" keliru). Skema server v2.4.2366 lebih akurat
daripada README/GitHub `master`. Semua query divalidasi ke skema (lihat `nodes/graphql.md`).

### D-09 Update library berjalan di server, diatur lewat `setSettings` (2026-10-01)
Env `UPDATE_*` / `AUTO_DOWNLOAD_*` **menimpa** setelan tiap container start, sehingga perubahan dari UI hilang.
→ Jangan tambahkan env tersebut ke compose.

### D-12 Status bar `black-translucent` + koreksi `--vh-gap` (2026-10-01, pemilik) — menggantikan D-11
Pemilik ingin konten sampai ke belakang jam/baterai dan terlihat di belakang bottom nav (seperti Instagram).
Bug viewport D-11 dikoreksi dengan `src/viewportFix.ts` → CSS variable `--vh-gap` untuk semua elemen bawah;
bottom nav semi-transparan + blur. Konsekuensi: teks status bar selalu putih (tidak terbaca di atas panel putih).
Rollback: meta kembali ke `black`. Status: ter-deploy, **uji iPhone menunggu** (`status.md`).

### D-11 Status bar PWA `black`, bukan `black-translucent` (2026-10-01) — *diganti D-12*
Bug WebKit: pada web app Home Screen dengan `black-translucent`, viewport kurang setinggi status bar → bottom nav
melayang 47pt dari tepi bawah. Dengan `black`, konten mulai di bawah status bar dan semua elemen `bottom: 0` menempel.
Konsekuensi: status bar hitam pekat (`#000`). Diuji di iPhone 13 Pro.

### D-10 Dua lapis backup (2026-10-01)
`.tachibk` (data logis; harian otomatis di server + manual dari UI) dan `scripts/backup.sh`
(arsip `./data` utuh, 7 terakhir).

## Diganti / usang (jangan dihidupkan lagi tanpa keputusan baru)

| Dulu | Diganti oleh | Catatan |
|---|---|---|
| Fase 4-A: router port forward 80/443 + Caddy + Let's Encrypt | D-02 | CGNAT |
| Fase 4-B: Cloudflare Tunnel | D-02 | Pemilik memilih Tailscale |
| Fase 3: basic auth / simple login wajib | D-03 | — |
| Host Linux, `sudo reboot`, `ufw` | D-04 | — |
| Opsi B `EXTENSION_REPOS` env | — | Nama env sebenarnya `EXTENSION_STORES`; repo ditambah lewat UI |
| "Introspection kosong, skema tidak bisa diambil" | D-08 | — |
| `scripts/healthcheck.sh` | — | Tidak pernah dibutuhkan |
| D-11 status bar `black` | D-12 | Bug 47pt kini dikoreksi `--vh-gap`; `black` tetap jadi jalur rollback |
