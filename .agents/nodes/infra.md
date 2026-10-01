# Node: Server & container

**File:** `docker-compose.yml`, `.env.example`, `.gitignore`

## Konfigurasi saat ini

```yaml
services:
  suwayomi:
    image: ghcr.io/suwayomi/suwayomi-server:latest
    container_name: suwayomi
    restart: unless-stopped
    ports:
      - "127.0.0.1:4567:4567"          # loopback saja
    volumes:
      - ./webui/dist:/home/suwayomi/.local/share/Tachidesk/webUI:ro   # WebUI kita
      - ./data:/home/suwayomi/.local/share/Tachidesk
    environment:
      TZ: ${TZ:-Asia/Jakarta}
      AUTH_MODE: none                  # akses = tailnet (decisions D-03)
      WEB_UI_FLAVOR: Custom            # sajikan webUI/ apa adanya, auto-update WebUI mati
```

## Fakta terverifikasi

| Hal | Nilai | Sumber |
|---|---|---|
| Image | `ghcr.io/suwayomi/suwayomi-server` (`:latest` = `:stable`; `:preview` bisa buggy) | README `github.com/Suwayomi/docker-tachidesk` |
| Data dir di container | `/home/suwayomi/.local/share/Tachidesk` | README docker-tachidesk |
| WebUI dir | `$dataRoot/webUI`, **disalin** ke folder serve saat start → perubahan butuh restart | `ServerSetup.kt`, `WebInterfaceManager.kt` (Suwayomi-Server) |
| Env menimpa setelan | Nilai env diterapkan tiap container start, menimpa perubahan dari UI | README docker-tachidesk |
| Password via file | Akhiran `_FILE`, mis. `AUTH_PASSWORD_FILE=/path` | README docker-tachidesk |
| Versi server | `v2.4.2366` Stable | `aboutServer` |

## Env var yang relevan (README docker-tachidesk, tabel "Environment Variables")

| Env | Default | Catatan proyek |
|---|---|---|
| `TZ` | `Etc/UTC` | dipakai: `Asia/Jakarta` |
| `AUTH_MODE` | `none` | `none` \| `basic_auth` \| `simple_login` \| `ui_login`; dipakai `none` |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | kosong | tidak dipakai |
| `WEB_UI_FLAVOR` | `WebUI` | `WebUI` \| `Custom`; dipakai `Custom` |
| `EXTENSION_STORES` | `[]` | JSON array URL index. **Tidak dipakai** — repo ditambah lewat UI dan tersimpan di `server.conf` |
| `BIND_IP` / `BIND_PORT` | `0.0.0.0` / `4567` | di dalam container; pembatasan ada di `ports:` compose |
| `UPDATE_*`, `AUTO_DOWNLOAD_*` | — | **Dilarang** (menimpa setelan UI) |
| `FLARESOLVERR_*` | mati | hanya bila ≥2 source gagal karena Cloudflare; KCEF (`KCEF_ENABLED` default `true`) dicoba dulu |
| `BACKUP_INTERVAL` / `BACKUP_TTL` | `1` hari / `14` hari | default dipakai (auto `.tachibk`) |

Daftar lengkap env: README docker-tachidesk; default semua setelan: `server-reference.conf` di Suwayomi-Server.

## Isi `./data` (jangan disunting tangan)

`database.mv.db` (H2), `server.conf`, `extensions/`, `backups/` (`.tachibk` otomatis), `downloads/`,
`cache/` (±150 MB, termasuk KCEF), `bin/kcef` (symlink ke binary di image), `android-compat/`, `logs/`, `webUI/`.

## Docker Desktop (host Windows)

- Harus menyala agar container hidup. `AutoStart: true` di `%APPDATA%\Docker\settings-store.json`.
- Gejala bila mati: `curl 127.0.0.1:4567` → `000`; `docker ps` → `failed to connect to the docker API at npipe:…`.
- Container nyala sendiri saat Docker Desktop hidup (`restart: unless-stopped`).

## Git

`.gitignore` root: `.env`, `data/`, `backups/`, `webui/dist/`, `webui/node_modules/`
(`webui/.gitignore` juga mengabaikan `dist`, `node_modules`).
