# komik-app-web

Server manga pribadi berbasis **[Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server)** dengan
**WebUI ala [Mihon](https://github.com/mihonapp/mihon)** untuk dibaca di iPhone — tanpa membuka port ke internet.

- Extension Mihon/Tachiyomi (repo [keiyoushi](https://github.com/keiyoushi/extensions)) dijalankan oleh Suwayomi di server.
- Akses hanya dari perangkat di tailnet **Tailscale** milik pemilik (`tailscale serve`, HTTPS).
- WebUI React (`webui/`) disajikan langsung oleh Suwayomi (`WEB_UI_FLAVOR: Custom`), bisa dipasang ke
  Home Screen iPhone sebagai PWA layar penuh.

```
iPhone (Safari/PWA) ──Tailscale HTTPS──▶ tailscale serve ──▶ 127.0.0.1:4567
                                                          └─ container suwayomi (image resmi)
                                                              ├─ /api/graphql   ← data & aksi
                                                              ├─ /api/v1/...    ← gambar
                                                              └─ /              ← webui/dist
                                                             ./data ← H2 DB, extension, setelan
```

## Fitur WebUI

| Layar | Isi |
|---|---|
| **Library** | 4 mode tampilan (compact, comfortable, cover only, list), tab kategori, filter tri-state, 8 mode sort, badge, tekan lama untuk aksi massal, tarik untuk update |
| **Updates** | Chapter baru per hari, badge di bottom nav, update library di server dengan progres |
| **History** | Riwayat baca per manga, lanjut baca |
| **Browse** | Source per bahasa (Popular / Latest / cari, infinite scroll), kelola extension |
| **Detail manga** | Info, tambah ke library, daftar chapter, tandai dibaca/bookmark/unduh |
| **Reader** | Kanan→kiri, kiri→kanan, vertikal, webtoon; tap zone & swipe; lanjut dari halaman terakhir; mode per judul; preload 4 halaman + chapter berikutnya |
| **More** | Setelan update otomatis & download (berjalan di server), backup & restore `.tachibk` |

Semua setelan WebUI disimpan di server (meta `mihonweb_*`), jadi tidak hilang saat data Safari dihapus
dan ikut ter-backup.

## Persyaratan

- Windows 11 dengan **Docker Desktop** (nyala otomatis saat login)
- **Tailscale** di host dan iPhone (akun yang sama), MagicDNS + HTTPS Certificates aktif
- **Node.js 24** + npm (hanya untuk build WebUI)

## Menjalankan

```bash
cp .env.example .env                     # TZ (opsional)
cd webui && npm ci && npm run build && cd ..
docker compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567   # 200
tailscale serve --bg 4567                # sekali; https://<tailnet-host>.ts.net (tailnet only)
```

Instalasi baru belum punya repo extension (WebUI ini belum punya menu untuk menambahkannya). Tambahkan sekali
lewat API — tersimpan permanen di `data/server.conf`:

```bash
curl -s -X POST http://127.0.0.1:4567/api/graphql -H "Content-Type: application/json" \
  -d '{"query":"mutation { addExtensionStore(input:{indexUrl:\"https://github.com/keiyoushi/extensions/raw/repo/index.pb\"}) { clientMutationId } }"}'
```

Di iPhone: buka `https://<tailnet-host>.ts.net` → Share → **Add to Home Screen**.
Pasang extension di Browse → Extensions, lalu mulai membaca.

## Pengembangan WebUI

```bash
cd webui
npx vite --host 127.0.0.1                # http://127.0.0.1:5173, /api diproksikan ke server (data nyata)
npm run build && npm run lint
cd .. && docker compose restart          # server menyalin webUI hanya saat start
```

Stack: Vite · React 19 · TypeScript · React Router (HashRouter) · TanStack Query · CSS biasa.
Tanpa UI library, state manager global, atau codegen GraphQL.

## Operasi

```bash
bash scripts/backup.sh                   # arsip ./data ke backups/, simpan 7 terakhir
docker compose ps
docker logs suwayomi --tail 100
```

Panduan lengkap (restore, update image, troubleshooting): [`.agents/workflows/runbook.md`](.agents/workflows/runbook.md).

## Struktur

```
├── AGENTS.md              kontrak singkat untuk agent AI
├── .agents/               konteks proyek untuk AI: arsitektur, keputusan, aturan, peta node & fitur, runbook
├── docker-compose.yml     satu service: suwayomi
├── scripts/backup.sh      backup arsip ./data
├── webui/                 WebUI React (src/api, pages, components, reader, settings)
├── data/                  volume runtime (gitignored)
└── backups/               arsip backup (gitignored)
```

## Keamanan

Server berjalan dengan `AUTH_MODE: none`. Keamanan bergantung sepenuhnya pada port 4567 yang hanya bind
`127.0.0.1` dan akses lewat Tailscale `serve` (tailnet only). **Jangan** memakai port forwarding,
`tailscale funnel`, atau bind `0.0.0.0`. Pasang extension hanya dari repo tepercaya — Suwayomi tidak
memverifikasi tanda tangan extension.

## Untuk agent AI

Mulai dari [`AGENTS.md`](AGENTS.md) lalu [`.agents/README.md`](.agents/README.md).

## Lisensi & atribusi

Proyek ini hanya konfigurasi dan frontend; tidak menyertakan kode Suwayomi atau Mihon.
Palet warna dan nama setelan mengikuti Mihon (Apache-2.0). Suwayomi-Server & Suwayomi-WebUI berlisensi MPL-2.0.
