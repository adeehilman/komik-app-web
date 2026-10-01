# Status (per 2026-10-01)

## Ringkas

Server Suwayomi v2.4.2366 berjalan di Docker Desktop, diakses dari iPhone lewat Tailscale, dan
menyajikan WebUI ala Mihon. Semua task teknis selesai dan terverifikasi lewat build, validasi skema,
dan uji API ujung-ke-ujung. Yang tersisa adalah uji yang butuh manusia/perangkat.

## Selesai & terverifikasi

| Area | Bukti |
|---|---|
| Container jalan, bind `127.0.0.1:4567` saja | `docker compose ps`; `netstat` → `127.0.0.1:4567`; dari IP LAN → `000` |
| Extension repo keiyoushi + 2 extension (Shinigami, Ainz Scans ID) | `settings { extensionRepos }`, `extensions(condition:{isInstalled:true})` |
| Akses Tailscale `serve` (tailnet only), TLS valid | `curl https://<tailnet-host>.ts.net/` → 200, `<title>Mihon</title>` |
| WebUI ter-deploy (`WEB_UI_FLAVOR: Custom`) | `settings { webUIFlavor }` → `CUSTOM`; asset JS `text/javascript` |
| Semua GraphQL WebUI valid | validator skema: 39 dokumen, 0 bermasalah |
| Alur data WebUI ke server asli | E2E 29/29: browse, search, install/uninstall extension, detail, tambah library, tandai dibaca, halaman chapter, simpan progres, History, Updates, meta global & per manga, update library + polling, `setSettings`, backup → unduh → validasi → restore |
| Setelan update bertahan setelah restart container | `globalUpdateInterval` 24 → restart → 24 (dikembalikan ke 12) |
| `scripts/backup.sh` | arsip 91 MB / 1600 file, server nyala lagi |
| Restore | ekstrak arsip → server kedua di port 4568 boot dari data hasil restore, data utuh |
| Restart container | `docker compose restart` → 200, `restart: unless-stopped` |
| Bottom nav menempel ke tepi bawah di PWA iPhone (W-13, status bar `black`) | screenshot iPhone: warna nav menerus sampai tepi layar, pita 47pt hilang |
| Prasyarat reboot | Docker Desktop `AutoStart: true` + terdaftar di startup Windows |

## Menunggu manusia

- [x] Add to Home Screen → buka dari ikon: tanpa bar Safari, bottom nav menempel ke bawah (W-13).
- [ ] Library: ganti 4 mode tampilan, filter tri-state, sort, tekan lama 2 manga → aksi.
- [ ] Browse → source → cari → buka judul → Tambah ke library.
- [ ] Baca 1 chapter sampai akhir (RTL & webtoon) → keluar → buka lagi → lanjut di halaman terakhir.
- [ ] Ubah mode reader → hapus data situs Safari → buka lagi → mode tetap.
- [ ] More → Backup & restore: buat & unduh `.tachibk`.
- [ ] Reboot Windows sekali → server nyala tanpa perintah manual.
- [ ] Bersihkan sisa jalur lama: port forward 80/443 di router, rule firewall "Caddy HTTP/HTTPS", DNS A record lama.

## Known issues / catatan

- Cover beberapa manga gagal dimuat karena CDN sumber (HTTP 404/522, rantai sertifikat tidak lengkap) —
  terlihat di `docker logs` sebagai `fetchHttpSourceMangaThumbnail`. Bukan bug deploy; UI menampilkan placeholder.
- Dengan setelan default server ("lewati manga yang punya chapter belum dibaca / belum mulai"), update library
  bisa menghasilkan 0 job. Perilaku sama seperti Mihon; ubah di More → Settings bila perlu.
- `tar` di Git Bash tidak bisa membuat symlink saat restore (4 pesan KCEF) — aman, lihat runbook #3.
- Sisa uji E2E: satu entri History (`lastReadAt` tidak bisa direset lewat API).
- `.env` lokal masih berisi `AUTH_USERNAME/AUTH_PASSWORD` lama yang tidak dipakai (`AUTH_MODE: none`).
- WebUI belum punya menu tambah/hapus repo extension. Instalasi baru: `addExtensionStore` lewat curl (README).
- `src/api/library.ts` `coverUrl()` tidak dipakai (sisa, aman dihapus pada task WebUI berikutnya).
- Lint: 9 warning (fast-refresh, `set-state-in-effect`), 0 error.
