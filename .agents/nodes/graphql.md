# Node: API GraphQL Suwayomi

Endpoint: `POST /api/graphql` (JSON `{ query, variables }`). Server: Suwayomi-Server **v2.4.2366**.
Klien: `webui/src/api/client.ts` → `gql<T>()`, `gqlUpload<T>()`, `toNumber()`.

## Sumber kebenaran

1. **Skema server sendiri lewat introspection** (aktif) — paling akurat untuk versi kita.
2. `github.com/Suwayomi/Suwayomi-Server` → `server/src/main/kotlin/suwayomi/tachidesk/graphql/{queries,mutations,types}`
   (branch `master` bisa lebih baru dari server kita).
3. `github.com/Suwayomi/Suwayomi-WebUI` → `src/lib/graphql/` — **hanya dibaca** sebagai contoh (MPL-2.0).

## Konvensi

- **Semua mutation memakai satu argumen `input`** dan wajib subselection:
  `updateMangas(input: { ids, patch: { inLibrary } }) { clientMutationId }`.
  Bentuk `updateMangas(ids:, patch:)` **salah** (pernah ditebak agent dan gagal).
- `LongString` (id source, timestamp) dikirim/diterima sebagai **string**.
- List memakai pola connection: `{ nodes { … } totalCount pageInfo { hasNextPage } }`, argumen
  `condition` (sama persis), `filter` (operator: `equalTo`, `in`, `greaterThan`, `startsWith`, `and/or/not`),
  `order: [{ by: ENUM, byType: ASC|DESC }]`, `first`, `offset`.
- Beberapa operasi "baca dari source" adalah **mutation**: `fetchSourceManga`, `fetchChapterPages`,
  `fetchChapters`, `fetchManga`, `fetchExtensions`.

## Operasi yang dipakai WebUI (semua tervalidasi)

| Domain | Query | Mutation |
|---|---|---|
| Library | `mangas(condition:{inLibrary:true})`, `categories(order:[{by:ORDER}])` | `updateMangas`, `updateMangasCategories` (`clearCategories`, `addToCategories`) |
| Manga | `manga(id)` | `updateManga`, `fetchManga` |
| Chapter | `chapters(condition/filter/order)`, `chapter(id)` | `updateChapters` (`isRead`, `isBookmarked`, `lastPageRead`), `fetchChapters`, `fetchChapterPages`, `enqueueChapterDownloads`, `deleteDownloadedChapters` |
| Source | `sources`, `source(id)` | `fetchSourceManga(input:{source, type: POPULAR\|LATEST\|SEARCH, page, query})` |
| Extension | `extensions` | `fetchExtensions(input:{})`, `updateExtension(input:{id: pkgName, patch:{install\|update\|uninstall: true}})`; `addExtensionStore(input:{indexUrl})` (setup, belum ada di UI) |
| Meta | `metas(filter:{key:{startsWith}})`, `manga(id){ meta }` | `setGlobalMeta`, `setMangaMeta`, `deleteMangaMeta` |
| Update library | `libraryUpdateStatus { jobsInfo { isRunning totalJobs finishedJobs } }`, `lastUpdateTimestamp` | `updateLibrary(input:{})`, `updateCategoryManga(input:{categories})`, `updateStop(input:{})` |
| Setelan server | `settings { … }` | `setSettings(input:{settings:{…}})` |
| Backup | `validateBackup(input:{backup: Upload})`, `restoreStatus(id)` | `createBackup(input:{flags})` → `url`, `restoreBackup(input:{backup, flags})` → `id` |
| Lain | `aboutServer { name version buildType }` | — |

## Fakta data (terverifikasi ke server)

| Hal | Nilai |
|---|---|
| Satuan waktu | `fetchedAt`, `lastReadAt`, `inLibraryAt`: **detik**. `uploadDate`, `lastUpdateTimestamp`: **milidetik** |
| `sourceOrder` | naik = chapter lama → baru (1 = Chapter 1). "Berikutnya" = `sourceOrder` lebih besar |
| Kategori Default | `id 0`, `isDefaultCategory: true`. Manga tanpa kategori = Default (`categories.nodes` kosong) |
| `updateMangasCategories` | server menjalankan `clearCategories` **sebelum** `addToCategories` (`CategoryMutation.kt`) |
| URL gambar | thumbnail `/api/v1/manga/<id>/thumbnail`; halaman `/api/v1/manga/<m>/chapter/<c>/page/<n>`; ikon extension `/api/v1/extension/icon/<pkg>` — semuanya relatif & same-origin |
| Halaman chapter | `pageCount` = `-1` sebelum `fetchChapterPages` pernah dipanggil |
| Upload | GraphQL multipart: `operations` (variabel file = `null`) + `map {"0":["variables.backup"]}` + part `0` |
| Unduh backup | `createBackup` → `/api/graphql/files/backup/<nama>.tachibk` (GET biasa) |
| Restore status | `BackupRestoreState`: `IDLE SUCCESS FAILURE RESTORING_CATEGORIES RESTORING_MANGA RESTORING_META RESTORING_SETTINGS` |
| Update library | dengan exclude default bisa 0 job (langsung `isRunning:false`, `0/0`) |
| `lastReadAt` | ter-set saat `lastPageRead` diubah; **tidak bisa direset** lewat API |

## Validasi (wajib sebelum memakai query baru)

**Cepat, tanpa efek samping** — mutation divalidasi tapi tidak dieksekusi:
```bash
curl -s -X POST http://127.0.0.1:4567/api/graphql -H "Content-Type: application/json" \
  -d '{"query":"mutation { updateMangas(input:{ids:[1], patch:{inLibrary:true}}) @skip(if:true) { clientMutationId } }"}'
# {"data":{}} = valid; {"errors":[…Validation error…]} = salah
```

**Lengkap** — semua string GraphQL di `webui/src` terhadap skema server (jalankan di folder sementara,
**bukan** di repo; `graphql` bukan dependency proyek):
```bash
mkdir -p /tmp/gqlcheck && cd /tmp/gqlcheck && npm init -y >/dev/null && npm i graphql@16 --silent
node -e 'const {getIntrospectionQuery}=require("graphql");require("fs").writeFileSync("iq.json",JSON.stringify({query:getIntrospectionQuery()}))'
curl -s -X POST http://127.0.0.1:4567/api/graphql -H "Content-Type: application/json" -d @iq.json > schema.json
```
```js
// validate.js — node validate.js "<repo>/webui/src"
const fs=require('fs'),path=require('path'),{buildClientSchema,parse,validate}=require('graphql');
const schema=buildClientSchema(JSON.parse(fs.readFileSync(__dirname+'/schema.json')).data);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):/\.tsx?$/.test(e.name)?[path.join(d,e.name)]:[]);
const files=walk(process.argv[2]),consts={};let bad=0,n=0;
for(const f of files)for(const m of fs.readFileSync(f,'utf8').matchAll(/const (\w+) = [`']([^`']*)[`']/g))consts[m[1]]=m[2];
for(const f of files){const src=fs.readFileSync(f,'utf8');for(const m of src.matchAll(/`([^`]*)`/g)){
  const doc=m[1].replace(/\$\{(\w+)\}/g,(_,k)=>consts[k]??`__${k}__`);if(!/^\s*(query|mutation)\b/.test(doc))continue;n++;
  let errs;try{errs=validate(schema,parse(doc))}catch(e){errs=[e]}
  if(errs.length){bad++;console.log('✗',path.relative(process.argv[2],f));errs.forEach(e=>console.log('  ',e.message))}}}
console.log(`${n} dokumen, ${bad} bermasalah`);process.exit(bad?1:0)
```
Hasil terakhir (2026-10-01): **39 dokumen, 0 bermasalah**.

Mencari tipe tertentu: `{ __type(name:"UpdateChapterPatchInput") { inputFields { name type { name kind ofType { name } } } } }`.
