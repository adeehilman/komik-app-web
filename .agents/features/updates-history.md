# Fitur: Updates & History

## Updates — `/updates`, `pages/Updates.tsx`

- Chapter manga di library, terbaru dulu: `chapters(filter:{inLibrary:{equalTo:true}}, order:[FETCHED_AT DESC, SOURCE_ORDER DESC])`,
  50 per halaman (`useInfiniteQuery(['updates'])`, offset), tombol "Muat lebih banyak".
- Dikelompokkan per hari dari `fetchedAt` (**detik**) — "Hari ini", "Kemarin", "N hari lalu", tanggal.
- Baris (`EntryRow`): cover → detail manga; teks → reader; tombol unduh. Chapter terbaca diredupkan.
- Subjudul top bar: "Terakhir diperbarui: …" dari `lastUpdateTimestamp` (**ms**).
- Tombol refresh & tarik ke bawah → update seluruh library (`features/auto-update.md`).
- Membuka tab = set `mihonweb_updates_last_seen` ke sekarang → badge bottom nav hilang.

### Badge bottom nav (`components/BottomNav.tsx`)

`countNewChapters(lastSeen)`: chapter library dengan `fetchedAt > lastSeen` dan belum dibaca.
Refetch tiap 5 menit. **Mati bila `lastSeen === 0`** (belum pernah membuka Updates) supaya tidak menampilkan
ratusan chapter lama sebagai "baru".

## History — `/history`, `pages/History.tsx`

- `chapters(filter:{lastReadAt:{greaterThan:"0"}}, order:[LAST_READ_AT DESC], first:300)`, lalu **satu baris
  per manga** (chapter terakhir dibaca) seperti Mihon.
- Dikelompokkan per hari dari `lastReadAt` (**detik**); subjudul: nama chapter • "Hal. N" (bila belum selesai) • jam.
- Cari (filter judul di klien). Tombol ▶ lanjut baca.
- Tidak ada hapus riwayat: API tidak bisa mereset `lastReadAt`.

## Data & invalidasi

Query key `['updates']`, `['history']`, `['lastUpdateTimestamp']`, `['newChapterCount', lastSeen]`.
Reader menginvalidasi `history` & `updates` saat keluar; selesai update library menginvalidasi `updates` & `newChapterCount`.
