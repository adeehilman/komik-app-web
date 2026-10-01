# Node: Akses jaringan (Tailscale)

## Jalur

```
perangkat di tailnet ──HTTPS──▶ tailscale serve (host Windows) ──HTTP──▶ 127.0.0.1:4567 (container)
```

- Setup (sudah dijalankan sekali, persisten): `tailscale serve --bg 4567`
- Cek: `tailscale serve status` → `https://<tailnet-host>.ts.net (tailnet only)` `|-- / proxy http://127.0.0.1:4567`
- MagicDNS + HTTPS Certificates aktif di admin console Tailscale (sertifikat TLS dari Tailscale).
- Perangkat: PC host (Windows) dan iPhone pemilik, login ke akun Tailscale yang sama.

## Model keamanan

`AUTH_MODE: none`, jadi siapa pun yang **bisa mencapai** port 4567 punya kendali penuh atas server
(pasang extension = menjalankan kode di server). Keamanan bertumpu pada:

1. Port 4567 hanya bind `127.0.0.1` → tidak terjangkau dari LAN maupun internet.
2. Satu-satunya proxy adalah `tailscale serve` (tailnet only) → hanya perangkat di tailnet pemilik.
3. Tidak ada port forwarding di router (CGNAT juga membuatnya tidak mungkin).

Konsekuensi:
- **Jangan** `tailscale funnel`, port forwarding, reverse proxy publik, atau bind `0.0.0.0`.
- Membagikan akses tailnet ke orang lain = memberi kendali penuh server.
- Extension menjalankan kode di server: pasang hanya dari repo tepercaya (keiyoushi). Suwayomi
  **tidak** memverifikasi tanda tangan extension (berbeda dengan Mihon).

## Cek cepat

```bash
netstat -ano | grep ":4567 " | grep LISTEN          # → 127.0.0.1:4567 saja
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://<IP-LAN-host>:4567   # → 000
curl -s -o /dev/null -w "%{http_code}\n" https://<tailnet-host>.ts.net/    # → 200 (dari perangkat tailnet)
tailscale status                                     # perangkat iPhone harus terdaftar
```

## Riwayat singkat

Jalur awal (router port forward 80/443 + Caddy + Let's Encrypt) gagal karena CGNAT — lihat `decisions.md` D-02.
Sisa konfigurasi lama di router/firewall/DNS perlu dihapus manusia (`status.md`).
