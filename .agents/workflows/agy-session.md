# Template sesi agent (Antigravity `agy` / agent lain)

## Memulai

```bash
cd "<path repo>"
agy --model "<model-id dari 'agy models'>"
```

Mode yolo (`--dangerously-skip-permissions`) **hanya** untuk task WebUI murni (`webui/**`). Jangan untuk task
yang menyentuh Docker, `./data`, backup/restore, Tailscale, firewall, atau router.

## Blok prompt (satu task, satu sesi)

```
Baca AGENTS.md lalu .agents/README.md. Semua aturannya mengikat. Folder .agents/ read-only.

Task sesi ini: <deskripsi task / ID>. Hanya ini.
Definition of Done: <tulis DoD yang bisa dibuktikan dengan output>.

Langkah:
1. Baca file .agents/ yang relevan (node & fitur di tabel .agents/README.md).
2. Query/mutation GraphQL baru atau berubah → validasi ke skema server dulu (.agents/nodes/graphql.md).
3. Kerjakan, hanya di path yang diizinkan .agents/rules.md §2.
4. Verifikasi: cd webui && npm run build && npm run lint, plus validasi GraphQL; untuk ops, perintah di task.
5. Laporkan dengan output ASLI. Yang butuh iPhone/manusia → tandai ⏳, jangan diklaim selesai.
6. Berhenti.

STOP dan tanya sebelum: Docker volume/./data, restore, firewall/router/Tailscale, install software host.
Format laporan: .agents/rules.md §7.
```

## Kalau agent melebar (scope creep)

```
Stop. Kamu keluar dari scope task ini.
Kembalikan semua perubahan di luar path yang diizinkan .agents/rules.md §2.
Kerjakan ulang HANYA Definition of Done task ini. Laporkan file yang kamu kembalikan.
```

## Kalau agent mengaku selesai tanpa bukti

```
Tempel output ASLI perintah verifikasi (build, lint, validasi GraphQL), bukan ringkasan.
"Build lolos" bukan bukti fitur jalan — sebutkan apa yang sudah dan belum diuji ke server.
```

## Review oleh senior

```
Review hasil sesi agent untuk proyek ini.
Terlampir: laporan agent + `git diff`.
Cek:
1. DoD terbukti dari output, bukan klaim.
2. Ada perubahan di luar .agents/rules.md §2?
3. Ada field GraphQL yang tidak divalidasi ke skema?
4. Perlu update .agents/ (node/fitur/status)?
Jawab: TERIMA atau ULANG + alasan.
```
