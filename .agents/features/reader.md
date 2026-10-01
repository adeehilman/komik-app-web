# Fitur: Reader

**Route:** `/reader/:chapterId` · **Halaman:** `pages/Reader.tsx` (`ReaderRoute` me-remount `Reader` per chapter)
**Modul:** `reader/PagedViewer.tsx`, `reader/WebtoonViewer.tsx`, `reader/PageImage.tsx`, `reader/preload.ts`
**API:** `api/chapter.ts` · **Setelan:** `mihonweb_reader_*` (`nodes/settings.md`)

## Mode

| Mode | Viewer | Navigasi |
|---|---|---|
| `rtl` (default) | Paged | tap kiri = berikutnya, kanan = sebelumnya; swipe kanan = berikutnya |
| `ltr` | Paged | tap kanan = berikutnya; swipe kiri = berikutnya |
| `vertical` | Paged | tap bawah = berikutnya, atas = sebelumnya; swipe atas = berikutnya |
| `webtoon` | Webtoon (scroll panjang, jarak antar halaman = setelan gap) | tap atas/bawah = gulir 75% layar |

- Sepertiga tengah layar = tampil/sembunyikan menu. Tap zones bisa dimatikan (semua tap = menu).
- Swipe diabaikan saat sedang di-pinch-zoom (`visualViewport.scale > 1`); swipe yang diikuti `click` ditelan sekali.
- Fit (paged): `screen` (contain), `width` (lebar penuh, gulir vertikal), `height` (tinggi penuh).
- Latar: hitam / abu-abu / putih.

## Alur

1. `['readerChapter', id]` → `fetchReaderChapter` (`lastPageRead`, `isRead`, `manga { id title }`).
2. `['chapterPages', id]` → `fetchChapterPages` (mutation; `staleTime: Infinity`). URL relatif ke server.
3. `['chapters', mangaId]` → urutan untuk prev/next (`sourceOrder`).
4. Halaman awal = `lastPageRead` (kecuali chapter sudah dibaca → 0). Untuk webtoon nilainya **dibekukan**
   (`startIndex`) dan posisi "dikunci" ke halaman itu sampai pengguna menyentuh layar, karena gambar di atasnya
   yang selesai dimuat menggeser konten.
5. Progres: debounce 500 ms → `updateChapters([id], {lastPageRead})`; mencapai halaman terakhir →
   `{lastPageRead, isRead: true}` sekali.
6. Halaman transisi setelah halaman terakhir: "Selesai / Berikutnya" + tombol ke chapter berikutnya
   (`navigate(…, {replace:true})`) atau kembali ke detail.
7. Keluar reader: invalidasi `chapters`, `library`, `history`, `updates`, `readerChapter`.

## Preload (meniru Mihon `HttpPageLoader`)

- **Muat seluruh chapter** (W-16, setelan `mihonweb_reader_preload_all`, default nyala): `reader/useChapterPreloader.ts`
  mengunduh semua halaman chapter yang dibuka via `fetch` (masuk cache service worker), urutan dari `startIndex + 1`
  sampai akhir lalu sisanya, 3 sekaligus, coba ulang 1/3/8 detik, antre ulang saat event `online`. Garis progres 2px
  (`.reader-preload-bar`) + "dimuat x/y · n gagal" di menu. Saat aktif, `preloadAround()` dimatikan (hindari unduh dobel).
- Bila muat-seluruh mati: 6 gambar ke depan via `new Image()` (`PRELOAD_AHEAD = 6`, maks 24 in-flight).
- Sisa ≤ 3 halaman → `prefetchQuery(['chapterPages', next.id])` + 6 gambar pertama chapter berikutnya.
- Cache = service worker `public/sw.js` (W-15): halaman yang pernah dimuat/di-preload disimpan di iPhone ±30 hari.

## Menu & setelan

- Atas: kembali (ke detail manga), judul manga + chapter, tombol setelan.
- Bawah: chapter sebelumnya, slider halaman (arah dibalik untuk `rtl`), chapter berikutnya.
- Sheet setelan: mode (+ "Berlaku untuk judul ini saja" → `useMangaSetting` / meta manga), skala, gap webtoon,
  latar, tap zones.

## Jebakan

- Nilai `initialIndex` webtoon jangan diikat ke `index` yang berubah — menyebabkan layar melompat balik.
- Gambar gagal → `PageImage` menampilkan "Coba lagi" (menambah `?retry=n`).
- `pageCount` = `-1` sebelum halaman pernah diambil; pakai panjang array `pages`.
