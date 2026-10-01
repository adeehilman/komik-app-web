# Fitur: Update library otomatis (server)

**Halaman:** `pages/Settings.tsx` (More → Settings) · **Komponen:** `components/LibraryUpdate.tsx`
**API:** `api/updates.ts`

Update library **berjalan di server** sesuai jadwal — tetap jalan walau iPhone mati. WebUI hanya mengatur
setelan dan menampilkan progres.

## Setelan (`settings` / `setSettings`, query key `['serverSettings']`, optimistis + rollback)

| UI | Field server | Padanan Mihon |
|---|---|---|
| Update otomatis: Mati / 6 / 12 / 24 / 48 / 72 jam / Mingguan (168) | `globalUpdateInterval` (0 = mati, minimal 6) | `autoUpdateInterval` |
| Lewati: belum dibaca / belum mulai / completed | `excludeUnreadChapters`, `excludeNotStarted`, `excludeCompleted` | `autoUpdateMangaRestrictions` |
| Perbarui info manga | `updateMangas` | `autoUpdateMetadata` |
| Unduh otomatis chapter baru (+ kecuali ada yang belum dibaca, batas per update) | `autoDownloadNewChapters`, `excludeEntryWithUnreadChapters`, `autoDownloadNewChaptersLimit` | pengaturan Download |
| Mode baca default | meta `mihonweb_reader_mode` | `ReadingMode` default |

Default server: interval 12 jam, ketiga exclude `true`, `updateMangas false`, auto-download mati.
Pembatasan perangkat Mihon (hanya Wi-Fi / sedang dicas) **tidak berlaku** — yang update adalah server.
Setelan bertahan setelah restart container (terverifikasi) **selama** tidak ada env `UPDATE_*`/`AUTO_DOWNLOAD_*`.

## Update manual & progres (`useLibraryUpdate`)

- `start()` → `updateLibrary(input:{})`; `start([catId])` → `updateCategoryManga(input:{categories})`.
- Status optimistis langsung `isRunning: true`, lalu polling `libraryUpdateStatus.jobsInfo` **tiap 2 detik
  hanya selama berjalan** (tanpa WebSocket/subscription).
- `LibraryUpdateBar`: progress bar + "Memperbarui x/y" + Batal (`updateStop(input:{})`).
- Saat berubah dari berjalan → selesai: invalidasi `library`, `updates`, `newChapterCount`.
- Dengan exclude default, update bisa menghasilkan 0 job (selesai seketika) — bukan error.
