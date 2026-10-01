# webui

WebUI ala Mihon untuk Suwayomi-Server. Dokumentasi: [`../README.md`](../README.md) dan
[`../.agents/nodes/webui.md`](../.agents/nodes/webui.md) (struktur, routing, komponen),
[`../.agents/features/`](../.agents/features/) (per fitur).

```bash
npm ci
npx vite --host 127.0.0.1   # dev, /api diproksikan ke http://127.0.0.1:4567
npm run build               # → dist/, disajikan Suwayomi (perlu docker compose restart)
npm run lint
```
