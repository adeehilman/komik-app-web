# Arsitektur

## Tujuan

Membaca manga dari extension Mihon/Tachiyomi (repo **keiyoushi**) di **iPhone**, dengan pengalaman seperti
aplikasi Mihon, tanpa membuka port apa pun ke internet. Satu pengguna, satu mesin, biaya Rp0.

Extension Mihon adalah APK Android dan tidak bisa jalan di browser (DEX bukan JS, CORS, API Android).
**Suwayomi-Server** menjalankannya di server; browser hanya menjadi frontend.

## Diagram

```
iPhone (Safari / PWA Home Screen)
   │  HTTPS, hanya jika iPhone login ke tailnet pemilik
   ▼
Tailscale  ── `tailscale serve` (tailnet only, sertifikat TLS dari Tailscale)
   │  https://<tailnet-host>.ts.net  →  http://127.0.0.1:4567
   ▼
Windows 11 host ── Docker Desktop (AutoStart)
   │
   ▼  port 127.0.0.1:4567 (loopback saja, tidak ada di LAN/internet)
Container `suwayomi`  (ghcr.io/suwayomi/suwayomi-server:latest, restart: unless-stopped)
   ├── /api/graphql          ← GraphQL API (semua data & aksi)
   ├── /api/v1/...           ← gambar: thumbnail, halaman chapter, ikon extension
   └── /  (WebUI)            ← isi ./webui/dist (WEB_UI_FLAVOR: Custom, mount read-only)
   │
   ▼
./data  → /home/suwayomi/.local/share/Tachidesk
   ├── database.mv.db        ← H2 embedded (library, chapter, meta, setelan)
   ├── server.conf           ← setelan server
   ├── extensions/           ← extension terpasang (JAR)
   ├── backups/              ← auto-backup .tachibk harian
   ├── downloads/ cache/ bin/kcef/ ...
   └── webUI/                ← WebUI resmi (tertutup oleh mount ./webui/dist)
```

## Komponen & tanggung jawab

| Komponen | Tanggung jawab | Bukan tanggung jawabnya |
|---|---|---|
| Suwayomi-Server (image resmi) | Extension, scraping source, DB, download, update library terjadwal, backup `.tachibk` | Tidak pernah di-fork/patch/compile |
| WebUI `webui/` | Tampilan & interaksi ala Mihon, simpan setelan ke meta server | Tidak menyimpan data sendiri, tidak ada auth |
| Tailscale | Satu-satunya jalur masuk dari luar mesin, TLS | — |
| `scripts/backup.sh` | Arsip `./data` utuh (cadangan level disk) | Bukan pengganti `.tachibk` |
| Docker Desktop | Menjalankan container, nyala otomatis saat login Windows | — |

## Aliran data utama

- **Membaca:** Reader → `fetchChapterPages(chapterId)` → daftar URL `/api/v1/manga/<m>/chapter/<c>/page/<n>`
  → `<img>` mengambil gambar lewat server (server yang mengambil dari situs sumber) → progres disimpan
  dengan `updateChapters({lastPageRead, isRead})`.
- **Setelan WebUI:** `useSetting` → global meta `mihonweb_*` di DB server → ikut backup `.tachibk`
  (`includeClientData`). localStorage hanya cache baca-cepat.
- **Update library:** berjalan **di server** sesuai `globalUpdateInterval`, walau iPhone mati. WebUI hanya
  mengatur dan melakukan polling progres.

## Batasan yang mengikat

- Hanya image Docker resmi. Tidak build image sendiri, tidak patch source Suwayomi.
- Port 4567 hanya bind `127.0.0.1`. Tidak ada port forwarding, tidak ada `tailscale funnel`.
- `AUTH_MODE: none`. Keamanan bergantung pada dua hal di atas (lihat `nodes/access.md`).
- Satu service di `docker-compose.yml`. Tanpa monitoring, CI/CD, orchestration, DB eksternal.
- iOS: status bar & home indicator tidak bisa disembunyikan; Fullscreen API tidak tersedia untuk gambar.

## Non-goals

Multi-user/RBAC, high availability, monitoring stack, aplikasi mobile native, offline mode penuh (service worker
hanya untuk cache gambar & app shell — D-13),
push notification, i18n, tema terang, menyalin kode Mihon (Kotlin) atau Suwayomi-WebUI (MPL-2.0).
