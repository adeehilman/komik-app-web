# Fitur: Backup & restore di WebUI

**Route:** `/backup` (More → Backup & restore) · **Halaman:** `pages/Backup.tsx` · **API:** `api/backup.ts`

## Buat backup

- Checkbox per flag `PartialBackupFlags` (semua default `true`): manga, kategori, chapter, tracking, history,
  **client data** (meta `mihonweb_*` = setelan WebUI), setelan server.
- `createBackup(input:{flags})` → `url` (`/api/graphql/files/backup/<nama>.tachibk`) → unduh otomatis lewat
  `<a download>`; di iPhone Safari muncul dialog simpan ke Files. Tautan cadangan ditampilkan bila unduhan tidak mulai.

## Restore

1. Pilih file (`<input type="file">` tanpa `accept`, supaya `.tachibk` tidak abu-abu di picker iOS).
2. `validateBackup` (multipart upload) → dialog menampilkan source yang belum terpasang & tracker yang belum login,
   plus flag restore.
3. Konfirmasi → `restoreBackup(input:{backup, flags})` → `id`.
4. Polling `restoreStatus(id)` tiap 1 detik sampai `SUCCESS` / `FAILURE` (tampilkan state + progres manga).
5. `SUCCESS` → `queryClient.invalidateQueries()` (semua) supaya library & setelan dimuat ulang.

Upload memakai `gqlUpload()` (GraphQL multipart: `operations` + `map` + file) — format terverifikasi.

## Catatan

- Server juga membuat `.tachibk` otomatis harian (`data/backups/`, simpan 14 hari) — jangan diubah.
- Restore ke server yang sedang dipakai mengubah data nyata: agent wajib minta izin (`rules.md` §4).
- Terverifikasi E2E: buat → unduh → validasi → ubah setelan → restore → setelan kembali, library utuh.
