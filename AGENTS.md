# AGENTS.md

> Dibaca otomatis oleh agent (Antigravity `agy`, Codex, Claude Code, dll.). Kontrak singkat;
> konteks lengkap ada di **`.agents/README.md`** — baca itu sebelum aksi apa pun.
>
> **Percakapan baru:** baca `.agents/README.md`, lalu recap terbaru di `.agents/recap/`, lalu `.agents/status.md`,
> lalu hanya file `.agents/` yang dibutuhkan task.

## Proyek

Server **Suwayomi-Server** (image Docker resmi) di Windows + Docker Desktop, diakses dari iPhone lewat
**Tailscale** (tailnet only), dengan **WebUI custom ala Mihon** (`webui/`, React + Vite) yang disajikan oleh
Suwayomi sendiri. Ini proyek ops + frontend; source Suwayomi **tidak** dimodifikasi.

## Peranmu

Eksekutor task. Kerjakan satu task, buktikan dengan output asli, laporkan, berhenti.
Arsitektur sudah diputuskan (`.agents/decisions.md`) — kalau tidak setuju, laporkan; jangan ubah sendiri.

## Aturan inti (detail: `.agents/rules.md`)

- `.agents/`, `AGENTS.md`, `README.md` = **read-only** untuk agent.
- Jangan pernah menyentuh `./data/`, `./backups/`, `.env`.
- Ubah hanya path di `.agents/rules.md` §2.
- Jangan menebak field GraphQL — validasi ke skema server (`.agents/nodes/graphql.md`).
  Semua mutation memakai `input: { … }`.
- Dilarang: patch Suwayomi, service tambahan, monitoring, CI/CD, test framework, dependency di luar stack
  terkunci, port forwarding / `tailscale funnel` / bind `0.0.0.0`, auth di frontend, env `UPDATE_*`.
- Repo **publik**: jangan tulis kredensial, IP publik, email, atau nama host tailnet.
- **STOP dan tanya** sebelum: menghapus/menimpa `./data`, restore, firewall/router/DNS/Tailscale,
  install software di host.

## Verifikasi minimum

```bash
cd webui && npm run build && npm run lint      # + validasi GraphQL bila query berubah
```

Build lolos ≠ fitur jalan. Yang butuh iPhone/manusia ditandai "menunggu manusia", bukan dicentang.

## Format laporan

```
✅ [selesai] — [bukti: perintah + hasil]
❌ [gagal] — [error asli] / Sudah dicoba / Butuh keputusan
⏳ [menunggu manusia] — [langkah]
📝 [usulan perubahan .agents/] — [file, alasan]
```
