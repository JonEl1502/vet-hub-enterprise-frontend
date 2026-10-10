# Phone-sized browser tests (farmer portal)

These drive the real farmer portal in a 400×781 mobile browser against a **fake API** —
no backend, database or login needed. They exist because the individual-animal record
buttons (Weight / Feeding / Produce) once did nothing at all and no one could tell
without tapping them.

| File | Covers |
|---|---|
| `test-wheel.mjs` | The farm bottom bar, the centre "C" quick-record dial, its three actions deep-linking into the record forms (`?record=`), recording an expense end to end, the More menu |
| `test-animals.mjs` | Recording a weight, a feeding and produce against one animal: payloads, shortcuts, validation, dates, tap-target size, species-aware produce options |

## Run

```bash
npm i --no-save playwright-core     # once; --no-save keeps package.json and the lockfile untouched
npm run dev                         # in another terminal (port 3000)
node e2e/test-wheel.mjs
node e2e/test-animals.mjs
```

Uses your installed Chrome (`CHROME_PATH` to override). `E2E_BASE` if the dev server is elsewhere.
Screenshots land in `e2e/shots/` (git-ignored). Exit code is non-zero if any check fails.
