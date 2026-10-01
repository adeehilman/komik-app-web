# Best practice

## WebUI — kode

- **Satu domain API = satu file** di `src/api/` (`library`, `manga`, `chapter`, `source`, `extension`,
  `updates`, `history`, `backup`). Halaman tidak menulis string GraphQL sendiri (kecuali `More.tsx` untuk
  `aboutServer` dan `settings/useSetting.ts` untuk meta).
- **Semua request lewat `gql()` / `gqlUpload()`** di `src/api/client.ts`. Error GraphQL dilempar sebagai `Error`.
- **Mutation selalu `input: { … }`** dan selalu punya subselection (mis. `{ clientMutationId }`).
- **`LongString` = string.** Ubah dengan `toNumber()`. Ingat satuannya (`nodes/graphql.md` §Satuan).
- **Query key TanStack konsisten** — dipakai untuk invalidasi lintas halaman:
  `['library']`, `['manga', id]`, `['chapters', mangaId]`, `['readerChapter', id]`, `['chapterPages', id]`,
  `['history']`, `['updates']`, `['newChapterCount', lastSeen]`, `['libraryUpdateStatus']`,
  `['lastUpdateTimestamp']`, `['serverSettings']`, `['sources']`, `['source', id]`,
  `['sourceManga', id, type, q]`, `['extensions']`, `['globalMeta']`, `['mangaMeta', mangaId]`, `['aboutServer']`.
  Setelah mutation, invalidasi key yang menampilkan data itu (contoh: tandai dibaca → `chapters`, `library`).
- **Setelan baru** = tambah ke `SettingsSchema` + `SETTINGS_DEFAULTS` di `settings/schema.ts` (prefix `mihonweb_`),
  baca/tulis lewat `useSetting`. Jangan simpan setelan hanya di localStorage.
- **Gestur sentuh:** pakai `useLongPress` (membatalkan diri saat scroll). Tombol di dalam elemen yang punya
  long-press harus `stopPropagation` + `preventDefault` di `onClick` dan `stopPropagation` di `onTouchStart`.
- **Scroll container = `#root`**, bukan `window`. Pull-to-refresh & pemulihan posisi scroll bergantung pada ini.
  Layar penuh (Reader) memakai `position: fixed` dengan scroll sendiri.
- **Elemen menempel bawah (`position: fixed`)** wajib `bottom: calc(-1 * var(--vh-gap, 0px))`; tinggi layar penuh
  `calc(100dvh + var(--vh-gap, 0px))`. Tanpa ini elemen melayang 47pt di PWA iPhone (`nodes/webui.md`, D-12).
- **Safe area iPhone:** top bar `padding-top: env(safe-area-inset-top)`, elemen bawah
  `env(safe-area-inset-bottom)`. Input teks ≥ 16px agar iOS tidak auto-zoom.
- **Warna hanya dari token** `src/theme/tokens.css` (palet dark Mihon). Kelas umum ada di `src/index.css`
  (`.list-item`, `.chip`, `.tab`, `.btn`, `.icon-btn`, `.section-title`, `.empty-state`, `.spinner`, `.progress-bar`).
- **Ikon:** tambahkan path Material Icons ke `components/Icon.tsx`; jangan menyebar SVG inline.
- **Bahasa UI:** label campuran mengikuti Mihon (judul layar Inggris: Library/Updates/…), pesan & aksi Bahasa Indonesia.
- Gambar sumber bisa gagal (CDN 404/522) — `onError` sembunyikan gambar, tampilkan placeholder.

## WebUI — verifikasi

1. `cd webui && npm run build` — wajib lolos (TypeScript strict, `noUnusedLocals`).
2. `npm run lint` — 0 error (warning fast-refresh boleh).
3. Validasi semua GraphQL ke skema server (`nodes/graphql.md`).
4. Uji alur data ke server asli bila menyentuh mutation (dev server `npx vite --host 127.0.0.1` memproksikan `/api`).
5. Uji sentuh/visual di iPhone = manusia. Tulis sebagai "menunggu manusia".
6. Deploy: `npm run build` lalu `docker compose restart` (lihat `workflows/runbook.md`).

## Ops

- Backup **sebelum** update image atau eksperimen apa pun: `bash scripts/backup.sh`.
- Uji restore di folder/port terpisah, jangan menimpa `./data` yang dipakai.
- Data uji di server asli wajib dikembalikan (library, status baca, setelan). `lastReadAt` tidak bisa direset
  lewat API — hindari membaca chapter sungguhan saat menguji.
- Setelan server diubah lewat UI / `setSettings`, bukan dengan menyunting `data/server.conf`.
- Perintah di runbook hanya yang pernah dijalankan; yang belum ditandai ⚠️.

## Dokumentasi

- `.agents/` = kondisi **sekarang**, bukan log. Riwayat ada di git.
- Repo publik: pakai placeholder `<tailnet-host>`, jangan tulis IP publik / email / domain pribadi.
