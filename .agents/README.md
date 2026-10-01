# .agents — Peta konteks untuk AI

> **Read-only untuk agent eksekutor.** File di folder ini adalah sumber kebenaran proyek.
> Agent membaca, tidak mengubah. Kalau ada yang salah/usang: laporkan di akhir sesi
> (format di `rules.md` §7). Hanya pemilik/senior yang memperbarui folder ini.

## Urutan baca (±5 menit)

1. `../AGENTS.md` — kontrak singkat (peran, larangan, STOP).
2. `recap/` — **recap terbaru** (riwayat sesi terakhir + daftar yang masih terbuka). Indeks: `recap/README.md`.
3. `architecture.md` — sistemnya apa, jalan di mana, data mengalir lewat mana.
4. `rules.md` — scope lock, larangan, protokol per task, format laporan.
5. `status.md` + `decisions.md` — kondisi yang berlaku sekarang (menang bila bertentangan dengan recap).
6. Baru buka file **node** atau **fitur** yang relevan dengan task-mu (tabel di bawah) — jangan membaca semuanya.

## Peta node (per komponen teknis)

| Node | File | Isi |
|---|---|---|
| Server & container | `nodes/infra.md` | `docker-compose.yml`, image, volume `./data`, env, restart, Docker Desktop |
| Akses jaringan | `nodes/access.md` | Tailscale `serve`, model keamanan, kenapa tidak ada auth |
| Backup & restore (ops) | `nodes/backup.md` | `scripts/backup.sh`, auto-backup `.tachibk`, restore, jebakan symlink |
| WebUI (kerangka) | `nodes/webui.md` | stack, struktur folder, routing, styling, cache, build & deploy |
| API GraphQL | `nodes/graphql.md` | konvensi mutation, fakta skema terverifikasi, satuan waktu, cara validasi |
| Setelan WebUI | `nodes/settings.md` | key `mihonweb_*`, penyimpanan di server meta, override per manga |

## Peta fitur (per fungsi yang dilihat pengguna)

| Fitur | File | Halaman → komponen → API |
|---|---|---|
| Library | `features/library.md` | `pages/Library.tsx` → `MangaCard`, `LibrarySheet`, `LibraryUpdate` → `api/library`, `api/chapter` |
| Browse & extension | `features/browse.md` | `pages/Browse.tsx`, `pages/SourceBrowse.tsx` → `api/source`, `api/extension` |
| Detail manga | `features/manga.md` | `pages/Manga.tsx` → `ChapterRow` → `api/manga`, `api/chapter` |
| Reader | `features/reader.md` | `pages/Reader.tsx` → `reader/*` → `api/chapter` |
| Updates & History | `features/updates-history.md` | `pages/Updates.tsx`, `pages/History.tsx` → `EntryRow` → `api/updates`, `api/history` |
| Update otomatis (server) | `features/auto-update.md` | `pages/Settings.tsx`, `LibraryUpdate` → `api/updates` |
| Backup & restore (UI) | `features/backup-ui.md` | `pages/Backup.tsx` → `api/backup` |

## Dokumen lain

| File | Kapan dibaca |
|---|---|
| `recap/` | Awal setiap percakapan baru — mulai dari recap terbaru |
| `tasks/` | Spesifikasi task siap-kerja untuk agent eksekutor (mis. `W-14-…md`); kerjakan hanya task yang diminta |
| `decisions.md` | Sebelum mengusulkan perubahan arsitektur — mungkin sudah pernah diputuskan |
| `best-practices.md` | Sebelum menulis kode WebUI atau menyentuh ops |
| `workflows/runbook.md` | Operasi harian, deploy WebUI, troubleshooting |
| `workflows/agy-session.md` | Template prompt untuk sesi agent baru |

## Istilah

- **Suwayomi-Server** — server JVM yang menjalankan extension Mihon/Tachiyomi (APK → JAR) dan menyajikan GraphQL + WebUI.
- **WebUI kita / Mihon-style** — frontend React di `webui/`, menggantikan WebUI resmi lewat `WEB_UI_FLAVOR: Custom`.
- **Tailnet** — jaringan privat Tailscale milik pemilik. Hanya perangkat yang login ke sana yang bisa mengakses server.
- **Meta** — penyimpanan key/value string di server (global / per manga). Dipakai untuk setelan WebUI.
- `<tailnet-host>` — placeholder nama host Tailscale (`tailscale serve status` di mesin host untuk nilai aslinya).
