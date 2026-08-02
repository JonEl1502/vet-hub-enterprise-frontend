# Changelog

Product changelog for the VetHub Enterprise **frontend**. Every notable change —
pages, components, and data-shape expectations — gets an entry.

The frontend almost never touches database rows directly, so most entries are
🟢 None on **record impact**. The thing that *does* bite here is the other
direction: a page that reads or writes a field which **doesn't exist in the
backend DB yet**. So every entry also carries a **Data dependency** line — the
backend schema/migration that must already be live for the change to work.

This is documentation only — no runtime/UI component. Read it before you deploy
a page that touches new fields. The companion backend changelog (with the full
schema migration history) lives at
`vet-hub-enterprise-backend/CHANGELOG.md`.

---

## How record impact is rated

Shared scale with the backend changelog. For the frontend it usually answers:
_when this page reads/writes data, does it change rows that already exist?_

| Badge | Meaning (frontend) | Example |
|-------|--------------------|---------|
| 🟢 **None** | UI only, or reads/writes brand-new optional fields | New page, restyle, a new optional input that defaults empty. Existing records untouched. |
| 🔵 **Low** | Writes a value into a field on records users edit | Editing a client now also sets a previously-empty column. Only rows the user actively saves change. |
| 🟡 **Medium** | Bulk/derived writes across many existing rows | An import, a "recompute all", or a save path that rewrites linked records. |
| 🔴 **High** | Triggers destructive backend behaviour | A page that deletes/merges records or drops data. |

And the frontend-specific axis:

| Data dependency | Meaning | Risk if ignored |
|-----------------|---------|-----------------|
| **None** | Uses only columns that already exist | Safe to deploy anytime. |
| **Requires migration NNN** | Reads/writes a column added by a backend migration | If the page ships **before** the migration is applied, requests 404 / throw Prisma `P2022` (column does not exist). **Apply the migration first.** |
| **Graceful fallback** | Tolerates the column being absent (renders `null`/`[]`) | Safe to ship ahead of the migration; the feature just stays dark until the column lands. |

---

## Adding an entry

Prepend under `[Unreleased]`. Template:

```md
### <area>: <short title>  —  <YYYY-MM-DD>
- **What changed:** one or two lines.
- **Record impact:** 🟢/🔵/🟡/🔴 — what (if anything) it does to existing rows.
- **Data dependency:** None / Requires migration NNN / Graceful fallback.
- **Rollback:** revert the commit and rebuild (note anything extra).
- ⚠️ **Watch out:** sharp edges (omit if none).
```

Areas: `page` (a view/route), `component` (shared UI), `flow` (multi-step
journey), `data-shape` (a change in the API response the UI consumes), `config`
(build/env, e.g. `VITE_API_URL`).

---

## [Unreleased]

### frontend: report shows diagnostic RESULTS; tracker labels  —  2026-08-02
- **What changed:** (user) The Medical Report's §4 Diagnostics now prints the visit's
  actual lab + imaging records (modality/panel, status, findings/notes, external
  source) — including partner-performed work mirrored onto a transfer visit; wizard
  prose alone left a completed X-ray reading "Not recorded". Outsourced-services
  tracker: the collapsed pin toggle is now a labelled "Track / Hide tracking" button
  and the item-type select gains a "What's moving" label + tooltip.
- **Record impact:** 🟢 — read-path UI.

### frontend: complete & send partner result from the imaging study page  —  2026-08-02
- **What changed:** (user) When an imaging study belongs to a visit we PROVIDE for a
  partner (accepted job on this provider visit, IMAGING category), the study page's
  side rail gains "Complete & send result to <clinic>" — completes the visit job,
  which mirrors the record back to the requester and queues the escrow payout. No
  round-trip to the jobs inbox.
- **Record impact:** 🟢 — UI; uses the existing job-completion endpoint.

### frontend: day editors — consumables + photo + record-as time with Now button  —  2026-08-02
- **What changed:** (user) Boarding day editor gains: inventory search + quantity
  (ConsumablePicker, rows recorded AS the chosen datetime), meal-photo upload, and a
  **Time** datetime picker with a **Now** button (defaults noon of that day) driving
  logDate and the consumable timestamps. Inpatient chart mirrors it: Add-to-daily-sheet
  gets a record-as Time + Now control with a "Back-filling…" chip, blank day rows get
  "✎ Fill this day" (pre-sets the time, scrolls to the form), and MAR/consumable
  logging carries the back-fill timestamp. Stock always moves at log time — only the
  record's date is historical.
- **Record impact:** 🟢 — UI + optional field on existing endpoints.

### frontend: complete diagnostics in place; avatars +40%  —  2026-08-02
- **What changed:** (user) Diagnostics request rows gain a **Complete** button — the
  clinic's plan may not include the full imaging/lab/surgery workflow pages, and a
  returned partner job left the local task stuck at "requested"; every request is now
  completable from the row (task → COMPLETED, hidden once paid). `PetAvatar` renders
  40% larger globally (all call sites scale together). Boarding care log: every day
  line opens a collapsible editor (same fields as Log today's care) — blank days
  back-fill via addLog with that logDate, existing lines PATCH in place — for stays
  recorded on paper.
- **Record impact:** 🟢 — UI; task status update uses the existing endpoint.

### frontend: partner requests reach B2B Stats + Clinic Today; staff tallies card  —  2026-08-02
- **What changed:** (user) The NEW cross-clinic visit-job system now surfaces beyond the
  Partners page: **B2B Stats tab** gains a "Partner Requests" band (total/incoming/
  outgoing/awaiting action + earned/paid from completed jobs, date-range filtered);
  **Clinic Today** gains a "Partner requests" card (incoming jobs awaiting price/accept,
  top 3, Open → Partners) and a "Staff activity · 7 days" card (§0f #4 — tallies BOTH
  visit_encounter_staff and visit_task_staff; fees labelled internal, never billed).
  Jobs inbox: the module-page shortcut (Imaging/Laboratory page) now hides until the
  provider visit has actually STARTED. Transfer-visit fixes (user, visit 134): App's
  cache-miss visit fetch dropped `visitType`/`encounterType` (mapper footgun) so a
  CLINICAL_TRANSFER visit rendered the full standard consultation — fields added;
  PatientRail gains `transferVisit` flag skipping pet snapshot/timeline calls (the
  shared patient lives at the requester clinic → "Pet not found" toasts); the
  Follow-Up & Reminders tab is hidden on transfer visits (requester's job); the
  movement tracker derives its stage from the logged events, so the provider now
  sees "Dispatched" highlighted and gets its "Mark received" action (the
  deprecated movement_stage mirror lagged/nulled provider-side). Tagline
  updated to "The operating system for veterinary practice." (index.html, seo.ts,
  landing).
- **Record impact:** 🟢 — UI + read-path only.

### frontend: boarding/inpatient per-day reconciliation sheet + daily costs  —  2026-08-02
- **What changed:** (user) Boarding care log and inpatient daily sheet now render EVERY
  calendar day of the stay, check-in→checkout (or today), newest first. A day with
  nothing logged shows its blank fields ("Fed AM: — · Stool: — …" / vitals/MAR/feeding
  dashes) with an amber "Nothing recorded" chip. Every day carries its charges — even
  zero: nights-based stay rate (final calendar day shows stay KES 0, matching the
  accrual) + that day's billable consumables as itemized rows. Purpose: manual
  reconciliation of a stay against its bill.
- **Record impact:** 🟢 — read-path UI; consumables fetched per visit.

### frontend: follow-up data split per encounter kind  —  2026-08-02
- **What changed:** (board §0f #3) the Follow Up step's professional judgments
  (currentOutcome, closeOutcome, outcomeNotes, carePlan, monitoring) now write to
  `data['followUp:<ENCOUNTER_TYPE>']` keyed on the selected encounter — the vet visit's
  outcome and the groom's outcome no longer stamp each other. Reminders stay SHARED at
  visit level (one animal, one owner — no double-messaging). Reads fall back to the
  legacy `data.followUp` slot (mandatory — old records must not look wiped);
  MedicalReport reads the vet-visit slot with the same fallback.
- **Record impact:** 🟢 — additive keys in `consultation_records.data`; legacy slot
  still read everywhere.

### frontend: boarding-stay page — one care card  —  2026-08-02
- **What changed:** (board §0f #2) Log Today's Care, the consumables search, and the
  care-log history merged into ONE card with dividers; consumables sit right under the
  meal-photo row instead of three scroll-lengths away. No API change.
- **Record impact:** 🟢 — layout only.

### frontend: ONE shared quantity+unit control (sell-unit drift fix)  —  2026-08-02
- **What changed:** new `QtyUnitControl` (components/clinic/shared) — canonical value in
  SELL units, unit choices DERIVED from packSize (sell ×1, ¼/½ stock, stock ×packSize),
  bounds ≥¼ unit and ≤ one purchase unit. Wired into: procedure editor item rows
  (price label now "Price / <sell unit>"), catalog service product chips (margin math
  now uses cost-per-SELL-unit — kills the KES −435 gloves lie), emergency billables
  chips, Add Service modal chips, and the visit-side applied-procedure line editor.
  Attach handlers now store the SELL unit label, not the stock unit.
- **Record impact:** 🟢 — UI only; stored quantities were already sell-unit denominated.

### frontend: gate-check expected discharge + patient-checkout dashboard  —  2026-08-02
- **What changed:** Inpatient admit modal gains an "Expected discharge" field (mirrors
  boarding's "Expected pickup"); inpatient chart header gets an inline editable
  "Release:" date chip. Clinic Today: Checkouts stat in the Conversion Pulse band
  (today / soon / overdue) + a "Patient checkouts" card listing due boarding pickups
  and inpatient discharges with a one-tap "Call reminder" (creates a FOLLOW_UP
  reminder due at the expected release time, phone in notes).
- **Record impact:** 🟢 — UI only; backend column is migration 173.

### page: client Payment Account + Collect lands on Payments; house dialog on Procedures  —  2026-08-02
- **What changed:**
  - The Clients-page **Collect** button now opens the client profile's **Payments tab**
    (was: Visits with unpaid filter).
  - The Payments tab gains a **Payment account** figure (the client's derived credit) and
    **+ Record advance**: amount + method, recorded via `POST /clients/:id/advance` —
    clients can pay ahead; the balance is drawn automatically on future collections.
  - Procedures delete confirm switched from the browser's native popup to the house
    dialog (`dialog.confirmDelete`).
- **Record impact:** 🟢 None beyond the advance transaction the user records.
- **Data dependency:** same-day backend deploy (`/clients/:id/advance`).
- **Rollback:** revert.

### page: wizard resolves from the SELECTED ENCOUNTER (172)  —  2026-08-02
- **What changed:** `useVisitWizard` now loads `GET /visits/:id/encounters` and derives
  the step sequence from the **selected encounter row** (its encounterType / visitType /
  templateId) instead of `appointments.visit_type`. Chips are the rows: switching selects
  a row; *Transfer/add encounter* now also **creates the row** (`POST /encounters`);
  removing an encounter also **deletes the row** (`DELETE /encounters/:id`) — fixing both
  reported bugs (clinical chip on a VACCINATION visit rendered the vaccination stepper;
  the chip's × removed nothing and it came straight back). Template resolution runs for
  the selected encounter's types, so a default template (clinic 3's `Vaccination (copy)`)
  can no longer hijack a clinical chip; a row's own `templateId` wins outright.
- **`resolveEntryPoint()` is KEPT as the fallback** whenever the encounter list is empty
  or the fetch fails — a failed fetch renders the legacy flow, never a blank workflow.
- **Record impact:** 🟢 None — rows were backfilled by 172; visits without rows use the
  fallback path unchanged.
- **Data dependency:** backend 172 + encounters API (already live on both stacks).
- **Rollback:** revert; chips go back to task-derived.


### feat: set a patient's photo from the pet profile  —  2026-08-02
- **What changed:** the profile header rendered `pet.species === 'Dog' ? '🐶' : '🐱'` — hardcoded,
  so an uploaded photo never appeared there **and every reptile, bird or rabbit showed as a cat**.
  It now renders `PetAvatar` (real photo, species emoji fallback) and clicking it opens a file
  picker: upload → R2 (`scope: 'pet'`) → `petsAPI.update({ avatarUrl })`.
- **Record impact:** 🔵 Low — writes `avatarUrl` on the pet the user chose.
- **Data dependency:** None new — the `pet` upload scope and `avatarUrl` both already existed.
- **Rollback:** revert the commit. Photos already uploaded stay on the pet and keep rendering
  everywhere else that uses `PetAvatar`.
- ⚠️ The header keeps a **local override** of the new URL so it updates the instant the upload
  finishes, rather than waiting for the parent's pet list to refetch. Navigating away and back
  reads the persisted value.
- ⚠️ Non-image files are rejected client-side; a failed upload leaves the previous photo intact.

### component: patient cards put the avatar left and the details beside it  —  2026-08-02
- **What changed:** the Linked Patient cards stacked avatar → name → species → owner vertically
  and centre-aligned, so a card was four lines tall to say "Rex, dog". Now the avatar sits left
  with name/species/owner stacked to its right, left-aligned. The Add-patient tile matches.
- **Record impact:** 🟢 None — layout only.
- **Data dependency:** None.
- **Rollback:** revert the commit.

### flow: one Track per visit, not one per outsourced service  —  2026-08-02

- **What changed:** every service row in the partner inbox carried its own **Track** button with
  its own movement stage, so a two-service visit showed *"Track"* and *"Track · dispatched"* side
  by side for **one animal making one trip** — two different answers to "where is this patient?".
  Tracking is now a single control on the visit group, driven by the first accepted job.
- **Record impact:** 🟢 None — display and interaction only; the tracker still writes through the
  same `VisitJobTracker`.
- **Data dependency:** None.
- **Rollback:** revert the commit.
- ⚠️ **`movementStage` is still stored PER JOB on the backend.** This makes the UI honest about
  the trip being one thing, but two jobs can still hold different stages in the database — the
  group now shows the first accepted job's. The real fix is moving movement to the visit; until
  then a stage advanced on one job won't visibly move the other.
- ⚠️ The open/closed state is keyed by `visitId`, so both services share one panel.

### page: Past requests section on Partners  —  2026-08-02
- **What changed:** declined partnership requests move out of the main Partnerships grid
  into a **Past requests** section below it — compact muted rows (partner, direction
  "They asked us / We asked them", date, Declined chip) — so history stays visible
  without mixing with live partnerships.
- **Record impact:** 🟢 None.
- **Rollback:** revert; declined cards mix back into the grid.

### page: partner jobs grouped by source visit; sidebar rename  —  2026-08-02
- **What changed:**
  - Partners → Jobs now shows **one card per requester visit** ("N services · one visit ·
    total"), with each outsourced service as a row inside (own status, negotiation,
    tracking, module-page link, complete) and **one Start/Continue-visit action** for the
    shared transfer visit — no more sibling services looking like unrelated jobs.
  - Sidebar group **"Billable Items" → "Inventory & Billables"**.
- **Record impact:** 🟢 None.
- **Rollback:** revert.

### page: split-invoice confirm + "Invoice the stay"  —  2026-08-02 (backend 170)
- **What changed:** on an APPROVED bill whose visit escalated into a boarding/inpatient
  stay, **Generate invoice** first asks: *"Do you want to split invoices for the
  encounters of this visit?"* — Split invoices the clinical work now (the stay keeps
  accruing on the open bill); declining produces one full invoice as before. A violet
  **Invoice the stay** button issues the stay's own document at discharge. Scope chips
  (Clinical split / Stay split) mark split documents. Transfer visits and multi-service
  single-visit referrals never see the prompt.
- **Record impact:** 🟢 None by itself — documents are generated on click.
- **Data dependency:** **backend migration 170** + same-day backend deploy.
- **Rollback:** revert; single full invoices only.

### fix: partnership page opened BLANK when reached from a transfer visit  —  2026-08-02
- **What changed:** `handshake-detail` resolved the handshake only from the Partners
  page's loaded store and rendered `null` on a miss — navigating straight from a transfer
  visit hit exactly that. New `HandshakeDetailPage` wrapper: loose id match against the
  store, then **fetch by id** on cache miss (spinner + not-found fallback with Back).
- **Record impact:** 🟢 None.
- **Rollback:** revert (restores the blank page).

### page: Continue visit, partnership nav from transfers, Partners theme pass  —  2026-08-01
- **What changed:**
  - Incoming job cards say **Continue visit** once the shared transfer visit is going
    (in progress, or a sibling job already shares it) — "Start visit" only for a fresh one.
  - Transfer visits gain **"About <clinic> & our partnership"** (banner + Clinical Transfer
    tab header) → the requester's handshake-detail page.
  - **Clinical Transfer tab is ONE card**: compact header, step list, labelled section
    divider, frameless jobs panel inside (`VisitJobsPanel frameless`).
  - **Partners theme pass** (user: "the theme is old"): HandshakeDetailView, ReferralsView,
    CreatePartnershipPage — fonts reduced (2xl/3xl → lg/sm), `rounded-3xl/2xl → xl`,
    paddings tightened.
- **Record impact:** 🟢 None.
- **Data dependency:** same-day backend deploy (shared transfer visits, providerVisitStatus).
- **Rollback:** revert.

### page: Clinic Today uses the house date-RANGE picker  —  2026-08-01
- **What changed:** the react-datepicker single-date field (buggy overlap in the header)
  is replaced by the same **DateRangePicker** the Visits list uses — defaults to
  today → today, clearing snaps back to today, and the agenda filters reminders /
  appointments / visits across the whole selected range.
- **Record impact:** 🟢 None.
- **Rollback:** revert.

### page: Conversion Pulse placement + themed date picker  —  2026-08-01
- **What changed:** the Clinic Today tab now reads **pulse band → date picker (defaults
  to today) → operational cards → day agenda** (`ClinicTodayView` owns the layout; the
  StaffDashboard cards pass through as children). The agenda's native browser date input
  became the house-themed `react-datepicker` (same control as AdvancedFilters).
- **Record impact:** 🟢 None.
- **Rollback:** revert.

### page: Conversion Pulse band on the Clinic Today dashboard  —  2026-08-01
- **What changed:** Clinic Today opens with a dark pine-gradient stats band (styled like
  the visit header card): **Visits today** (done/total), **Appointments → visits** and
  **Reminders → visits** conversion (x/y + %), **Cross-sell** (visits whose services span
  encounter families, with the top pair, e.g. "vet → grooming"), and a **7-day visits
  mini-trend**. Data from the new `GET /summaries/conversions` endpoint.
- **Record impact:** 🟢 None — read-only aggregation.
- **Data dependency:** same-day backend deploy (`/summaries/conversions`).
- **Rollback:** revert; the band disappears, cards unchanged.

### page: Clinical Transfer becomes a real tab (patient escrow flow)  —  2026-08-01
- **What changed:** on CLINICAL_TRANSFER visits the "🔁 Clinical transfer" **badge**
  (which read as an unclickable tab — same trap as the old Diagnostics badge) becomes a
  real **🔁 Clinical Transfer tab**: a step-by-step escrow guide (receive patient → work
  from the module page → send result [auto-copies the report back to the requester] →
  return patient) plus the jobs panel with the movement tracker. Explicitly states every
  step works **with or without payment** — the payout settles separately.
- **Record impact:** 🟢 None.
- **Data dependency:** same-day backend deploy (result mirror-back on complete/result-sent).
- **Rollback:** revert; the badge returns.

### page: clinic-issued pet Birth & Death certificates  —  2026-08-01
- **What changed:** the pet profile gains **📜 Birth certificate** (always) and **🕊️ Death
  certificate** (once the patient is marked deceased). Each opens a printable document
  (`PetCertificates.tsx`, via `printElementAsPdf`) modeled on the civil-registry
  certificates the user supplied: serial №, boxed field grid (entry no., name, species,
  breed, sex, dates, place), owner as informant, registering officer, certification
  paragraph, "given under the seal of", signature/stamp line and a legal note ("not proof
  of pedigree" / "not a civil-registration document"). Registry-only fields the record
  can't derive — cause of death, place, dam/sire — are editable inline before printing.
- **Record impact:** 🟢 None — a document compiled from the pet record; nothing written.
- **Data dependency:** none (uses existing `dob`, `dateOfDeath`, `isAlive`).
- **Rollback:** revert.

### page: real pet avatars everywhere + partner-transfer visits unmistakable in the list  —  2026-08-01
- **What changed:**
  - New shared **`PetAvatar`** (`components/clinic/shared/PetAvatar.tsx`): the pet's real
    profile photo wherever one exists (never the dicebear placeholder), species-emoji chip
    otherwise. Used in the **visits list** (desktop + mobile), the **New Visit patient
    picker** (both card styles) and the **visit detail header**.
  - The visit payload's embedded pet now carries `avatarUrl` (backend select + DataContext
    mapper + `Visit.pet` type) — essential on CLINICAL_TRANSFER visits where the shared
    patient is NOT in the local pets store.
  - **Visits list tells partner transfers apart**: violet **🔁 Partner Transfer / Shared
    patient** chips replace "Normal Visit · In-Clinic", plus a 🔁 corner badge on the avatar.
- **Record impact:** 🟢 None — display only.
- **Data dependency:** backend `0455bfa` (avatarUrl on visit pet selects), same deploy.
- **Rollback:** revert; emojis and identical-looking rows return.

### page: transfer visits open their module pages + Partner Bill & Receipt  —  2026-08-01
- **What changed:** on a CLINICAL_TRANSFER visit:
  - the banner gains **"Open <category> page"** buttons — one per module the transferred
    services belong to (lab, imaging, surgery, …), so multi-service transfers reach each page.
  - a new **🧾 Partner Bill & Receipt** tab replaces the suppressed Bill & Invoice: an
    invoice-style document whose **client is the requesting clinic** ("Bill to — client:
    ShiVets Clinic"), for *their* patient and *their* client (shown as context), itemised
    at the agreed job prices. Status: "Awaiting settlement" until the escrow payout runs,
    then "Paid" with the payout transaction as the receipt reference (TX-…). The pet owner
    is never billed here.
- **Record impact:** 🟢 None — a projection over visit jobs; nothing written.
- **Data dependency:** same-day backend deploy (payoutTransactionId on job payloads).
- **Rollback:** revert; billing stays fully suppressed on transfer visits.

### page: incoming jobs show the patient and gain "Start visit"  —  2026-08-01
- **What changed:** Partners → Jobs cards show the requester's patient
  (🐾 name · species, tagged "shared" on incoming). Incoming ACCEPTED/COMPLETED cards gain
  **Start visit** — opens the clinical-transfer visit at this clinic, creating it on demand
  for jobs accepted before the transfer-visit era (`ensureProviderVisit`).
- **Record impact:** 🟢 None (the backfill creates the same rows accept now creates).
- **Data dependency:** same-day backend deploy.
- **Rollback:** revert; jobs still open via "Open <category> page".

### page: incoming transfer jobs open their module page; shared-patient banner  —  2026-08-01
- **What changed:**
  - Partners → Jobs, incoming ACCEPTED/COMPLETED cards gain **"Open <category> page"** —
    navigates to the Lab / Imaging / Surgery module page filtered to the transfer visit
    (`openForAppointmentId`), where images and findings are worked. Pairs with the backend
    change that creates the module record on accept.
  - The CLINICAL_TRANSFER visit shows a violet banner: *clinical transfer from <clinic> —
    patient and owner details are shared for this visit only; they stay in the requesting
    clinic's records, not this clinic's patient list.*
- **Record impact:** 🟢 None.
- **Data dependency:** same-day backend deploy (module record on accept); 168/169 live.
- **Rollback:** revert; jobs are still workable from the transfer visit's Records tab.

### page: Running Bill "Add services" opens an inline search  —  2026-08-01
- **What changed:** on the visit wizard's Running Bill card, **Add services** now toggles
  an `InlineServiceSearch` right above the Add services / Invoice buttons (same control as
  the Diagnostics step) instead of jumping to the Add Services panel; the "Opens the Add
  Services panel" tooltip is gone. Falls back to the old panel when the inject context is
  absent. Picked services land in their own category on the bill, exactly like the
  Diagnostics-step search.
- **Record impact:** 🟢 None — same `injectService` path the wizard already used.
- **Data dependency:** none.
- **Rollback:** revert; the button opens the panel again.

### page: sent diagnostic requests show partner + progress dialog  —  2026-08-01
- **What changed:** once a Diagnostics-step request is sent to a partner, its "To partner"
  chip becomes **"partner name · status"** (negotiating / received / in progress / result
  sent / returned / completed). Clicking opens a dialog: who it went to, the price
  negotiation (accept/counter while open), the escrow **movement timeline**
  (`VisitJobTracker` — patient/sample/results between the clinics), and the payout state
  ("Partner paid" once the visit settles). Declined/cancelled jobs free the row to send
  again. New exported `OutsourcedJobChip` in `VisitOutsource.tsx`.
- **Record impact:** 🟢 None — reads the jobs the send already created.
- **Data dependency:** backend 168+169 (already live).
- **Rollback:** revert; the chip stays "To partner" and tracking lives on Records & Reports.

### page: stuck-payment banner is dismissible  —  2026-08-01
- **What changed:** the Billing & Subscription "payment has been pending since…" banner
  gains a **×**. Dismissal is remembered per payment (localStorage, keyed by the
  attempt's reference) — that payment stays closed, a NEW stuck payment still shows.
- **Record impact:** 🟢 None — display state only.
- **Data dependency:** none.
- **Rollback:** revert; the banner becomes permanent again.

### page + data-shape: partner page finished — per-request price negotiation, partner charges, payment measures  —  2026-08-01 (backend 169)
- **What changed:**
  - **Price is discussed on each request** (user: "each service is price discussed well").
    The outsource modal gains an editable price per partner (prefilled from the standing
    category rate when one exists); the partner **accepts or counters** — Accept/Counter
    controls on the visit jobs panel (both sides) and the Partners jobs inbox. Whoever
    didn't propose the current figure accepts it.
  - **Handshake page (Services):** each category row now shows **what the partner
    actually charges** (their catalog prices, clickable to use as your proposal); the
    negotiated category price is labelled as the *default for requests*.
  - **Handshake page (Relationship):** the Partnership Value card is now REAL money —
    settled cross-clinic payouts + owed-now accrual + in-flight jobs, with a
    **Settle now** sweep; plus **Payment measures** (per service / weekly / monthly /
    every N days). "Engangement Note" typo fixed.
- **Record impact:** 🟢 None on render; Settle-now writes the same payout transactions
  the per-service path always wrote, just in one sweep.
- **Data dependency:** **backend migration 169** + same-day backend deploy.
- **Rollback:** revert; old flow (pre-agreed category price required) resumes.

### page: "To partner" button on each diagnostic request row  —  2026-08-01
- **What changed:** the Diagnostics step's request rows (CT Scan, CBC, …) gain a violet
  **To partner** chip next to View result / Full page — opens the existing partner picker
  (partners with an agreed price for the category) and sends the request as a visit job.
  New `chip` variant on `OutsourceServiceButton`; hidden once the visit is paid. A journey
  event is emitted on send.
- **Record impact:** 🟢 None — same createJob path the Records-tab rows use.
- **Data dependency:** backend 168 (already live).
- **Rollback:** revert; the Records & Reports surface still offers the same action.

### fix + page: clinical workflow no longer vanishes on imaging; partner share re-homed  —  2026-08-01 (backend 168)
- **What changed:**
  1. **Bug:** `VisitDetailView` guessed "diagnostics-only" from task categories — a real
     consultation whose only staged service was imaging LOST its Clinical Workflow tab
     (and gained a "🔬 Diagnostics visit" badge that looks like a tab but never was one).
     Now keyed on the explicit `visitType === 'DIAGNOSTICS'` the backend stamps on visits
     auto-created from a lab/imaging record.
  2. **Partner share/request:** the per-service Outsource button + Outsourced-services
     panel lived in the RETIRED Categories & Services tab — the whole surface was
     unreachable (`SHOW_RETIRED_SERVICES_TAB = false`). Re-homed on **Records & Reports**:
     jobs panel + "Send a service to a partner clinic" rows (open visits, requester side).
  3. **CLINICAL_TRANSFER visits** (provider side, auto-created on job accept): violet
     "🔁 Clinical transfer" badge, no clinical wizard, **billing surface suppressed** —
     no Bill & Invoice tab, no Generate-bill/Take-payment (provider is paid via the job's
     escrow payout; billing the client here would double-charge them).
- **Record impact:** 🟢 None on existing rows. Legacy auto-created diagnostics visits
  (CONSULTATION + one lab/imaging task) simply regain the full tab set.
- **Data dependency:** **backend migration 168** (`DIAGNOSTICS`/`CLINICAL_TRANSFER` enum
  values + `visit_jobs.provider_visit_id`) and the same-day backend deploy.
- **Rollback:** revert; the enum values are additive and harmless if unused.

### fix: New Transfer crashed the inventory page on open  —  2026-08-01
- **What changed:** `StockTransfersPanel.openNew` stored the whole `inventoryAPI.getAll`
  envelope (`{ data, meta }`) in `stock` — it read `.items`, which that API never returns
  (every other caller reads `response.data.data`). The `sourceStock` useMemo then threw
  `stock.filter is not a function`, taking down the page the moment "New Transfer" was
  clicked. Hit live on prod. Now unwraps `.data` (`.items` kept as fallback) and guards
  with `Array.isArray`.
- **Record impact:** 🟢 None — read path only; no transfer could even be drafted before.
- **Data dependency:** none.
- **Rollback:** revert (restores the crash).

### fix: vaccinations show under Procedures Performed  —  2026-07-31
- **What changed:** the Treatment step's *Procedures Performed* listed only `ProcedureApplication`
  rows. A vaccination added on the vaccination page creates a **VaccinationRecord + a visit task**,
  never a ProcedureApplication — so the panel read as EMPTY while the running bill already carried
  the charge. Vaccinations on the visit are now listed there, read-only.
- **Record impact:** 🟢 None — one extra read; nothing written.
- **Data dependency:** None — `vaccinations.getByAppointment` already existed.
- **Rollback:** revert the commit.
- ⚠️ **The asymmetry this fixes:** the SAME vaccine showed or didn't depending on which door it
  came through — applied as a recipe it appeared, added on the vaccination page it vanished.
- ⚠️ **Read-only on purpose.** The vaccination page owns editing (batch, administered date,
  certificate), so these rows carry no × — removing one here would have to delete a clinical
  record and its certificate from a panel about billing lines.
- ⚠️ Best-effort fetch: a failure leaves the strip empty rather than blocking the consultation.

### fix: a client message from the notifications card no longer opens a white page  —  2026-07-31
- **What changed:** the notifications hover card sent client messages to the `messaging` route,
  whose handler did `if (!mc) return null` — a literal blank screen whenever the client wasn't in
  the already-loaded list. From a notification that is the COMMON case: the inbox surfaces clients
  the current page never fetched. The card now opens the **client's details page**, which loads the
  client itself and carries the Messaging Portal.
- **Record impact:** 🟢 None — navigation only.
- **Data dependency:** None.
- **Rollback:** revert the commit.
- ⚠️ The `messaging` route's blank render is fixed **at source** too: it now explains the client
  isn't loaded and offers a button through to their profile. Any other caller that hits that route
  with an unloaded client gets an explanation instead of a white page.

### flow: add a vaccination from the vaccination page when none was staged  —  2026-07-31
- **What changed:** the empty state offered only **"Generate from visit services"**, which
  produces nothing if the visit arrived with no vaccination service on it — a dead end that sent
  the vet back to the visit to add a service and return. The clinic's **vaccination recipes** are
  now searchable right there; picking one applies it to the visit and generates the records in
  one motion.
- **Record impact:** 🔵 Low — applying a recipe adds its tasks/products to the visit (and so to
  the bill), then creates the vaccination records.
- **Data dependency:** None new — uses the existing `procedureTemplates.apply` +
  `vaccinations.createFromAppointment`.
- **Rollback:** revert the commit; the empty state returns to the single button.
- ⚠️ **Two writes, not one.** `apply` puts the vaccine, consumables and fees on the VISIT; the
  record generation reads them back. If the second call fails the recipe is still applied — the
  page reloads, so the services are visible and "Generate from visit services" will finish the job.
- ⚠️ Only recipes whose category or name reads as vaccination/immunisation are offered, filtered
  by the patient's species. A recipe with no species set is treated as general and always offered.
- ⚠️ The control hides entirely when the clinic has no matching recipe, rather than showing an
  empty search — nothing to add is not a state worth a search box.

### flow: the visit's reminder opens inline instead of navigating away  —  2026-07-31
- **What changed:** "View reminder" on Follow-up & Reminders called `onNavigateToReminder`, which
  left the visit for the Reminders page to read one date. It now expands an inline panel showing
  title, service type, due date, status, notes, recurrence, and contacted/completed timestamps.
  If the reminder produced a booking, that visit is linked straight from the panel. "Open in
  Reminders" stays as a secondary link for anyone who actually wants the full page.
- **Record impact:** 🟢 None — display only.
- **Data dependency:** None, and **no extra request**: `visitReminder` is already in state, so
  the panel renders from data the view had loaded anyway.
- **Rollback:** revert the commit; the button navigates away again.
- ⚠️ It renders whatever is in `visitReminder` at that moment. Updating the reminder refreshes
  that state, so the panel follows — but a reminder changed in ANOTHER tab won't reflect until
  the visit reloads.

### component: delete confirms use the branded dialog, not the browser's  —  2026-07-31
- **What changed:** deleting an appointment booking used `window.confirm`, which renders as
  *"app.vethubcore.com says — Delete this appointment?"* — raw hostname, browser chrome, reads
  like a security warning rather than the product. Now uses the VHC `dialog.confirm` (logo,
  danger variant) and names the patient and client so it is obvious WHICH booking is going.
  The bill-line delete confirm added earlier today was switched to the same dialog.
- **Record impact:** 🟢 None — presentation of an existing confirmation.
- **Data dependency:** None.
- **Rollback:** revert the commit.
- ⚠️ `dialog.confirm` is async and returns a boolean — a caller that forgets to `await` gets a
  Promise, which is truthy, and the action fires with no confirmation at all.

### flow: the bill's add-item search covers consumables, not just services  —  2026-07-31
- **What changed:** the add-line search read the SERVICE catalogue only, so typing "glove" said
  *"No service matches — add glove as an Other line"* and asked for a price from memory, even
  though Gloves is stocked with a real sell price. Results are now two labelled groups —
  **Services** and **Consumables & stock** — and picking a stock item adds a `CONSUMABLE` line
  carrying its `inventoryItemId` and catalogue price. The Other-line fallback only appears when
  BOTH groups are empty.
- **Record impact:** 🔵 Low — adds a bill line referencing an inventory item.
- **Data dependency:** None; `BillLineInput.inventoryItemId` already existed.
- **Rollback:** revert the commit. Lines already added stay valid.
- ⚠️ **This BILLS the item, it does not DEDUCT it.** Stock moves when a consumable is logged
  against the visit (that creates the `VisitMedication` finalize reads); a line added straight to
  the bill has no such record, so the shelf is unchanged. Log it on the visit when the stock
  must move — otherwise the client is charged and the count still says you have it.
- ⚠️ On-hand quantity is shown in the result row, deliberately: billing an item the shelf hasn't
  got is worth seeing before it reaches the client's bill.

### page (admin): Close action on a subscription payment  —  2026-07-31
- **What changed:** Sub-Payments rows gain a third action, **Close**, beside Reconcile and
  Activate. It marks an attempt CANCELLED so the clinic stops being prompted to raise a support
  ticket about a payment that is never going to land. Confirms first, and states plainly that the
  clinic's current subscription is unaffected.
- **Record impact:** 🔵 Low — sets one attempt to CANCELLED via the API.
- **Data dependency:** **Requires the backend `/cancel` endpoint.** Without it the button 404s.
- **Rollback:** revert the commit.
- ⚠️ Disabled on rows already CANCELLED; the API refuses SUCCESS rows outright.

### page: the medical report groups systemic findings by title  —  2026-07-31
- **What changed:** the report printed every abnormality as one run-on sentence —
  `Abnormalities noted — Eyes: Retina: mild degeneration; Cornea: clear; Ears: …` — which
  nested "title: text" inside "system: findings" and was unreadable by the third system. The
  narrative now names the systems (*"Abnormalities noted on eyes and ears"*) and a grouped
  block prints each system with its findings on their own lines.
- **Record impact:** 🟢 None — rendering only, nothing written.
- **Data dependency:** None. Reads `entries` when present and falls back to the flat `findings`
  string otherwise, so it renders correctly against records from before titled findings.
- **Rollback:** revert the commit.
- ⚠️ **Detail is no longer duplicated.** The narrative deliberately stops listing the findings
  text because the block below carries it — reverting only this file while keeping the exam
  change leaves the report naming systems with no detail.
- ⚠️ A legacy untitled finding prints **bare, with no invented title.** It reads as one entry
  keyed `general`; labelling it "General" in print would assert something the vet never wrote.
- Custom clinic-added `normalAbnormal` fields get the same titled treatment via `factValue`,
  so a clinic-built system card doesn't print as a flat string beside the built-in ones.
- Each system block is `break-inside-avoid` so a system doesn't split across printed pages.

### component: systemic exam findings become a titled list  —  2026-07-31
- **What changed:** each body system had ONE free-text box, so every observation about an eye
  (retina, cornea, PLR, discharge) was mashed into a single string nothing could search or
  trend. A system now holds **any number of titled findings**. "Add description" reveals a row
  of title chips plus a free-text title box; picking one adds an inline row with its own text
  input. New shared `SystemFindingsCard`, used by BOTH the built-in examination step and the
  clinic-built workflow renderer, so custom workflows get it too.
- **Record impact:** 🔵 Low — new exams write an extra `entries` array. Existing records are
  read, never rewritten.
- **Data dependency:** **None, deliberately.** `findings` is still written as the flat string
  (`"Retina: mild degeneration; Cornea: clear"`), derived from the entries on every keystroke.
  `MedicalReport` and every other reader keep working untouched, and no migration is needed —
  wizard state is local.
- **Rollback:** revert. Entries written meanwhile are ignored by the old box, which still shows
  the flat string, so nothing is lost or unreadable.
- ⚠️ **Titles carry a stable `key`, not just a label** — `slugifyTitle('Pupils / PLR')` →
  `pupils-plr`. Free-typed titles would otherwise drift into "Retina" / "retina" / "Retinal
  exam" as three separate things and every cross-exam query would miss two. Same failure the
  category stable-keys work fixed in 069.
- ⚠️ **Chips are seeded per system, not learned.** A fresh clinic needs useful titles on the
  first exam, not after someone invents vocabulary. Twelve seeded lists (Eyes, Ears, Nose,
  Oral cavity, CVS, Respiratory, Abdomen, MSK, Skin & coat, Neuro, Reproductive, Lymph nodes);
  anything unrecognised falls back to a generic list.
- ⚠️ **Ticking Normal clears the findings** — an abnormal note under a Normal tick is a
  contradiction in the clinical record. Same as the old behaviour, now applied to the list.
- A pre-existing record with only the plain string renders as one entry titled **General**, so
  nothing looks lost and the vet can retitle it.

### flow: deleting a bill line asks before destroying recorded work  —  2026-07-31
- **What changed:** the bill's line delete now removes the service from the visit too, so a deleted
  charge stays deleted (it used to reappear on "rebuild from visit"). When the service already has
  work recorded, the API's 409 message — which names the records — becomes a `window.confirm`, and
  the delete is only retried with `force` if the user accepts.
- **Record impact:** 🔴 High — confirming deletes the visit task and cascades its module record.
- **Data dependency:** **Requires the matching backend change.** Against an older API the line still
  deletes but the task survives, i.e. the old resurrect-on-rebuild behaviour.
- **Rollback:** revert the commit.
- ⚠️ `billsAPI.removeLine` gained a `force` argument **before** `options` — a positional change. It
  is the only caller (BillPanel), but check any new call site.
- ⚠️ It now passes `showError: false`; BillPanel reports failures itself, so the 409 shows as a
  prompt rather than a toast the user cannot act on.

### page: "Visit Overview" becomes "Visit Workflow", and gains a Visit Details button  —  2026-07-31
- **What changed:** the workflow page's heading was **"Visit Overview"** — renamed to **"Visit
  Workflow"**, which is what it actually is. Added a right-aligned **Visit Details** button that
  mirrors the "Open Workflow" button on the details page, so the two views are a round trip instead
  of a one-way door. The header was already `justify-between` with an empty right slot.
- **Record impact:** 🟢 None — navigation and labels only.
- **Data dependency:** None.
- **Rollback:** revert the commit.
- New optional prop `onOpenDetails` on `VisitDetailView`, wired in `App.tsx` to
  `navigateTo('view-appointment')`. Optional, so the button simply doesn't render if unwired.
- Routes for reference: `appointment-detail` = Visit Workflow, `view-appointment` = Visit Details.

### flow: registering a visit with no service picked no longer invents one  —  2026-07-31
- **What changed:** a vet visit registered with **nothing picked** seeded a task from the catalog —
  `services.find(name includes 'consultation') || services[0]` — so the bill opened with a service
  the user never chose. On prod that was **"Behavioural Consultation" at KES 2,500**, picked purely
  because it sorts first in the Consultation category. Now the only thing that can seed a line is
  the clinic's **configured entry fee**; with none configured the visit is created with zero services.
- **Record impact:** 🔵 Low — new visits stop getting a phantom task. Existing visits are untouched.
- **Data dependency:** None. Pairs with the backend fix that lets `POST /appointments` accept
  `tasks: []` — without it, a service-less registration 400s.
- **Rollback:** revert the commit.
- ⚠️ **The configured entry fee no longer carries a catalog `serviceId`.** It is a fee, not a
  catalog service (same treatment as the house-call/walk-in extras), so procedure-recipe auto-apply
  will not trigger off it. That path only ever fired off a guessed service anyway.
- ⚠️ **Grooming/boarding still fall back to their category's first catalog service.** Those are
  gate-check encounters with **no service picker at all**, so removing the fallback would mean they
  never bill anything. Deliberately left — revisit if they get a picker.

### component: the signed-in email shows in the profile dropdown  —  2026-07-31
- **What changed:** the account menu now shows the signed-in user's email under their name and
  role.
- **Why:** display names collide — several accounts read "Admin" — and the name isn't what you
  log in with. The email is the one unambiguous answer to "who am I signed in as right now",
  which matters most on the admin and support accounts people switch between.
- **Record impact:** 🟢 None — display only.
- **Data dependency:** None. `user.email` already rides on the auth context.
- **Rollback:** revert the commit.
- ⚠️ Renders only when an email is present, and carries the full address in `title` — a long
  address truncates in an 18rem menu.

### page: Records & Reports goes full-width; the patient rail moves to Follow-Up & Reminders  —  2026-07-30
- **What changed:** Records & Reports now runs full width like the Bill tab, and the
  patient-context cards (Patient & Owner · Behaviour · Clinical Snapshot) move into the
  Follow-Up & Reminders tab beside the visit's reminder and the doctor's staged plan.
- **Why:** a medical report and a line-item table are both worse to read in a 70% column, and
  the rail was sitting mostly empty next to them. In the Follow-Up tab the same cards have
  something to sit alongside — patient history and behaviour are exactly what you want in view
  while deciding a follow-up.
- **Record impact:** 🟢 None — layout only.
- **Data dependency:** None.
- **Rollback:** revert the commit.
- ⚠️ **`patientRail` is still used by the WIZARD** (`sideRail`) — it is not dead code. Don't
  "clean it up" after seeing it disappear from Records.

### config: the repo stops tracking `node_modules` and `dist`  —  2026-07-30
- **What changed:** this repo had **no `.gitignore`** and tracked **27,410 `node_modules`
  files** plus the built `dist/` and stray `.DS_Store`s. Added a `.gitignore` (mirroring the
  backend's, plus `.vite/` and `.claude/`) and untracked those paths. Tracked files: 27,915 → **498**.
- **Record impact:** 🟢 None — index-only, no database and no runtime code touched.
- **Data dependency:** None.
- **Rollback:** `git revert` restores the index entries; nothing was deleted from disk.
- ⚠️ **Nothing consumes the committed `dist/`.** The Dockerfile builds it (`npm run build`) and
  `.dockerignore` already excluded both paths, so the committed copy was only ever stale. Vercel
  builds it too. `package-lock.json` stays tracked — `npm ci` needs it.
- ⚠️ **This is why `git add -A` has eaten work here 3×.** Every `npm install` or build dirtied
  thousands of paths, so real edits were invisible in `git status`. That noise is now gone.
- Other sessions with this repo open will see these deletions arrive on their next pull; the
  files stay on their disk, so no reinstall is needed.

### flow: the follow-up reminder moves off bill generation to just before the receipt  —  2026-07-30
- **What changed:** generating the bill no longer asks for a follow-up reminder — it finalizes
  directly. The reminder is asked ONCE, immediately before the receipt, at settle time.
- **Record impact:** 🟢 None — same reminder, asked at a different moment.
- **Data dependency:** None.
- **Rollback:** revert; `handleFinalize` still accepts `ReminderDraft | null`, so restoring a
  gate at finalize is passing a reminder again rather than rebuilding the path.
- ⚠️ **It no longer BLOCKS the payment.** The old gate refused to finalize without a reminder;
  the new step proceeds with the payment even if the vet cancels. Money must never wait on a
  clinical decision — that coupling is what made settling feel heavy.
- ⚠️ Only asked when the visit has no reminder, so a part payment doesn't re-ask every time.
- The unreachable finalize-gate dialog was **deleted**, not left mounted behind a flag nothing
  sets — an unreachable component that still type-checks is the dead-code trap this repo keeps
  paying for.

### page: "Take payment now" on an open visit  —  2026-07-30
- **What changed:** an open, unpaid visit now shows **Take payment now** in the header, which
  navigates to the Bill tab where the bill can be issued for pay-first and collected.
- **Why:** pay-first already worked end-to-end (verified on staging, 3/3 — payment accepted on
  an `IN_PROGRESS` visit, marked `prepaid`, left clinically open, no receipt for a deposit).
  It was simply **undiscoverable**: "Settle bill" only appears once the visit is finalized, so
  an open visit offered nothing and the working path sat behind a button called "Issue for
  pay-first" two tabs away. This is the missing signpost, not new machinery.
- **Record impact:** 🟢 None — it navigates; it cannot create a bill or take money by itself.
- **Data dependency:** None.
- ⚠️ **`billsAPI.get` is deliberately NOT called to decide the button.** That endpoint RAISES a
  draft bill as a side effect, so probing it for a label would create bills for every visit
  anyone opened.

### page: vaccination visit no longer requires a staged service to create  —  2026-07-30
- **What changed:** `NewVisitView` `isFormValid` no longer demands ≥1 staged service for a
  VACCINATION visit. The vaccine / package / procedure picker stays on the create form
  (now labelled "Optional — can be added in the visit"); the vaccine can instead be added
  later in the visit workflow. RETAIL keeps its requirement — an item sale with no items
  is nothing.
- **Record impact:** 🟢 None — a vaccination visit can now be created with zero tasks,
  which the backend already accepts (no length validation on `data.tasks`; the retired
  `assertServicesComplete` gate returns early on 0 tasks).
- **Data dependency:** none — no API or schema change.
- **Rollback:** revert the `categoriesValid` line.
- ⚠️ **Watch out:** a service-less vaccination visit gets NO seed service (vaccination
  is deliberately excluded from entry-fee seeding), so its bill starts at 0 until a
  vaccine is added in the workflow.

### page: inventory import template matches the Add Product form  —  2026-07-30
- **What changed:** the Import Data → Inventory CSV template (`utils/import/schemas.ts`
  `INVENTORY_SCHEMA`) grew from 10 to 28 columns so it mirrors the Add Product form:
  main category, product details (manufacturer / country of origin / storage /
  prescription-only / species), pack size, billable, reorder controls (max level /
  reorder qty / barcode), **cost & sale price per selected unit** (`cost_unit` /
  `sell_unit`), and the four **service charges** (service / administration / injection
  + injection mL / prescription). Column reference, preview validation and the sample
  rows all follow from the schema, so they picked the new fields up automatically.
- **Record impact:** 🟡 **Medium** in the same sense any import is — committing a file
  creates inventory rows in bulk. The template change itself rewrites nothing.
- **Data dependency:** backend `import.service.ts` update in the same-day backend commit
  (code-only, no migration — all columns already exist).
- **Rollback:** revert; old 10-column files remain valid since every new column is optional.
- ⚠️ **Watch out:** fees are **blank = not applied, number (incl. 0) = applied** — a
  column of zeros applies a zero fee to every imported product, it does not skip it.

### page + data-shape: catalog restructure — one product structure, supplier→clinic  —  2026-07-30
- **What changed:** the reference catalog, supplier listings and clinic stock now share ONE
  product structure, so a product's category / subcategories / units are set once and
  inherited rather than retyped at each hop.
  - New shared `components/shared/common/ProductStructureFields.tsx` — main category +
    ordered, drag-reorderable subcategories, the same controls the clinic Add-Stock form uses.
  - The **supplier product form** now carries that structure, plus **units per pack** and a
    **suggested resale price** clinics may inherit on PO receive.
  - `supplierProducts.api` types gained `metadata` / `packSize` / `suggestedSellPrice`.
- **Record impact:** 🔵 **Low** — a supplier saving a product now also writes its structure.
  No existing listing is rewritten until it is saved.
- **Data dependency:** **Requires migration 155**.
- **Rollback:** revert; the columns are nullable so listings simply carry no structure.
- ⚠️ **Watch out:** `InventoryView` still has its own INLINE copy of these controls. That is
  known and deliberate — it is a ~1,900-line component whose Add-Stock flow works, and
  refactoring it is a separate, testable change. When it moves over, **delete the inline
  block**; do not leave both live and drifting, which is the exact failure this structure
  exists to end.
- ⚠️ **Watch out:** `packSize` is never guessed. Blank means "sold as a single unit" — a wrong
  pack size is what bills a whole box as one tablet.

### page: Payables — the supplier A/P screen  —  2026-07-30
- **What changed:** new `payables` view (Suppliers & Orders → Payables) plus
  `services/modules/supplierAp.api.ts`. Completes the front end of the payable chain
  `PurchaseOrder → SupplierInvoice → SupplierPayment`.
  - Headline split: **Total owed · Invoiced · Received-not-billed (GRNI) · Overdue**. The
    GRNI column is the point of the screen — goods are in and we owe for them, but no
    document has arrived to pay against. Recording the invoice MOVES money between the two
    columns rather than adding to the total, and the copy says so.
  - Suppliers-owed list → per-supplier invoices + un-billed orders. Record an invoice
    (optionally against a received order, which prefills the unbilled amount), pay the
    supplier, void an invoice.
  - The pay modal **previews the allocation before the money is taken** — which invoice/order
    each part clears and what it leaves behind, invoices before GRNI, oldest first.
- **Record impact:** 🟢 None by itself — reads only. The actions it exposes write payments and
  invoices, which is their purpose.
- **Data dependency:** **Requires migration 159** (`supplier_invoices`). The summary tile
  works without it; per-supplier invoice lists need it.
- **Rollback:** revert; remove the `payables` menu entry and route.
- ⚠️ **Watch out:** every figure is derived server-side, so the screen re-reads both the
  summary and the balance after any write. Don't optimise that into a local mutation — a
  stale copy is the only way this screen could show a wrong balance.
- ⚠️ **Watch out:** the allocation shown in the pay modal is a **preview**. The server
  allocates authoritatively; if the two ever disagree, the server is right.
- ⚠️ A duplicate supplier-invoice number is refused by the server on purpose (paying one
  twice is the classic A/P loss). Surface the message — never retry it.

### feat: edit a procedure's copy on the visit, not your saved template  —  no migration
- **What changed:** an applied procedure can now be edited **for that visit only** — its name
  and stage labels — from the applied-procedure panel. Previously a vet adapting a protocol
  for one patient had two bad options: edit the clinic's master template (changing every
  future visit) or leave the checklist wrong.
  `procedure_applications.snapshot` has always frozen a per-visit copy; this is the first
  thing that writes to it. An edited copy carries an **"edited"** badge with the timestamp,
  so a mismatch against the clinic's recipe reads as a deliberate change, not a bug.
- **Record impact:** 🟢 None — writes only to that application's `snapshot`. The template,
  the bill lines and stock are untouched.
- **Migration / rollout:** code-only (`PATCH /procedure-templates/applications/:id`).
- **Rollback:** revert; the copy becomes read-only again.
- ⚠️ **Watch out — deliberately narrow.** Editing the copy does **not** add or delete bill
  lines. Money still moves through the existing endpoints (`materializeItem`, the consumable
  update/remove), so stock and totals stay under one set of rules. Quantities are edited on
  the line, not in the copy.
- ⚠️ **Watch out:** `snapshot` is JSONB, so the service function IS its schema — stage
  labels are trimmed and capped, the list is capped at 20, discount is range-checked, and
  item identity (id/name/kind/price) is **not** writable so the copy can still be reconciled
  against the generated lines.
- ⚠️ **Watch out:** locked once billed, the same gate every other application mutation uses.

### feat: a small inline service search, and no recipe picker at registration  —  no migration
User, 2026-07-29 (screenshots). Two changes, same principle: do the thing where you are.
- **"Add diagnostic service" is now a search box in the panel**, not the right-side Add
  Services drawer. Type, click a match, it's on the visit — the panel you were reading never
  leaves the screen. Whatever is picked lands in **its own category** (imaging adds imaging,
  laboratory adds laboratory), so one control serves every panel and the requests list the
  report is built from picks it up unchanged. The drawer still exists for browsing the whole
  catalogue by category; this is the fast path, not a replacement for browsing.
- **The "Procedure / recipe (optional)" picker is gone from visit registration.**
  Registration should capture who is being seen and why, not stage a protocol before anyone
  has looked at the patient. Recipes are still applied from the visit itself, and the backend
  still auto-applies one whose trigger service is added by name — so nothing is lost, it just
  happens after the clinical decision instead of before it.
- **Record impact:** 🟢 None — UI only. Adding a service goes through the same
  `onInjectTask` path as the drawer, unassigned on purpose (defaulting to the first staff
  member credits work to someone nobody picked).
- **Migration / rollout:** frontend only.
- **Rollback:** revert; the button and the picker come back.
- ⚠️ **Watch out — why a context and not a wizard prop.** `StepProps.injectService` is
  declared, but the plumbing that would forward it lives in `wizard/VisitWizard.tsx`, which
  another session had **uncommitted changes in**. Staging that file would have swept their
  in-flight work into this commit — the accident `SESSION_BOARD.md` rule 2 exists to prevent.
  `ServiceInjectContext` provides the callback from the VisitDetailView side instead. Fold it
  into `StepProps` when the wizard is next refactored.
- ℹ️ Removed with the picker: the `procedureTemplatesAPI.list()` call that ran on every
  registration mount and the species/category filter memo — that select was their only
  consumer.

### feat: Demo Requests page, and clinic email verification in admin  —  2026-07-29
- **Demo Requests** (Platform → Demo Requests). Leads from the public form, which previously
  went only to an inbox. Status tabs with counts (New / Contacted / Converted / Dismissed),
  search across name, email, clinic and phone, click-to-mail and click-to-call, an internal
  note per lead, and a stamp of **who** marked it contacted and **when** — the thing an
  inbox could never tell you.
- **Clinic email verification** on the admin clinic card. The email row now carries a
  **Verified / Unverified** badge with two ways to settle it: *Send code* (to the clinic's
  own address, then enter the 6 digits) or *Vouch* when support has phoned the practice —
  mirroring the bypass that already exists for user accounts. Verified rows can be cleared.
- **Record impact:** 🟢 None — new page + one control.
- **Migration / rollout:** needs backend 145 (clinic email) and 146 (demo requests).
- **Rollback:** revert the commit.
- ⚠️ **Watch out:** the Unverified badge is **not** a warning that anything is restricted.
  Nothing gates on it; its tooltip says so. It is distinct from the clinic's
  `verificationStatus` (business-document approval), which DOES gate portal visibility.

### feat: feeding times you can name — "Evening still owed", not "1 of 2"  —  migration 161
- **What changed:** a feeding plan can now define named slots (Morning 06:00, Evening 17:00).
  The plan card shows a chip per slot — green fed, red overdue, grey not due yet — and each
  chip is a one-tap log for that slot. The owner portal shows the same chips.
- **A slot only turns red once its time has passed.** An evening chip glowing red all
  morning is how an alert earns being ignored.
- **The plain "Log feed" button is unchanged** and still needs no slot picker: the server
  resolves which slot a ration filled at write time. The editor's "Times per day" becomes
  read-only once slots exist, because the count is derived from them.
- **Record impact:** 🟢 None — additive. A plan with no slots looks and behaves exactly as
  before, including the "1 of 2 fed today" line.
- **Migration / rollout:** needs backend migration **161**.
- **Rollback:** revert; plans fall back to the count-only card.
- ℹ️ Optional by design — a farm that never names its times never sees the feature.

### page: the mid-visit workflow picker is hidden  —  2026-07-29
- **What changed:** the workflow dropdown in the visit wizard header (Automatic / every
  preset) is commented out at the user's request. The workflow is already chosen at
  registration and resolved from the entry point, so switching mid-visit let staff re-point a
  half-filled consultation — and the list offered presets for entirely different encounter
  types (Grooming, Surgery, Boarding) on a vaccination visit.
- **Record impact:** 🟢 None — UI only.
- **Data dependency:** None.
- **Rollback:** uncomment the block; `setVisitTemplate` and the resolution logic are
  untouched, so nothing else has to change.
- ⚠️ **Watch out:** `pickableWorkflows` is deliberately still computed — the "Custom · <name>"
  chip beside it depends on it. Don't "clean it up".

### feat: the bill IS the finalize — and Categories & Services becomes Follow-Up & Reminders  —  no migration
User, 2026-07-29, with a screenshot. Four changes to the visit surface, all one idea:
**the bill already carries everything the visit produced**, so it should be the thing you
generate, not a thing you unlock.
- **Categories & Services no longer blocks finalize.** The button was `disabled` until
  every task was ticked, and clicking it bounced you to that tab with the unfinished ones
  highlighted. Both are gone. Finalize completes every task server-side in the same
  transaction anyway — ticking them first only ever changed *who* did the ticking. Staff now
  get a note ("3 services still open — they'll be completed when the bill is generated")
  instead of a refusal.
- **"Finalize → enable billing" is now "Generate bill".** Same action; the label stopped
  describing a gate and started describing what it does.
- **The Bill tab runs FULL WIDTH** — no right rail. Line items, quantities and prices are
  the wrong thing to read in a 70% column. Records & Reports keeps its 7/3 split.
- **Categories & Services → 🔔 Follow-Up & Reminders.** It now holds the visit's reminder,
  the follow-up visits created from it, and the doctor's staged follow-up plan.
- **Record impact:** 🟢 None — UI and gating only. No new writes.
- **Migration / rollout:** frontend + one backend change (the finalize guard). Deploy together.
- **Rollback:** revert both commits; the gate and the tab come back.
- ⚠️ **Watch out:** dropping the rail from the Bill tab would have taken the **Follow-up
  Plan card** with it — that card is the only place the doctor's staged plan becomes real
  reminders and a booked appointment. That is why the tab was repurposed rather than
  deleted: *"move anything reminder related or follow up visit to it"*.
- ⚠️ **Watch out:** the Follow-up Plan card was NOT copied. `PatientRail` gained an `only`
  prop (`'followup'` / `'context'`) and renders from **one** implementation — the card
  carries ~250 lines of plan/reminder/booking state that would have rotted the day it was
  duplicated. The rail now passes `only="context"`, the tab `only="followup"`.
- ⚠️ **Watch out:** the ~700-line Categories & Services render block is **kept in the file,
  dormant**, behind `SHOW_RETIRED_SERVICES_TAB = false`, not deleted. `workflowTab` can no
  longer be `'services'` — nothing sets it. Flip the flag to see it again.
- ℹ️ Tabs that used to land on Categories & Services now land on the **Bill**: a finalized
  visit opens there, service/consumable timeline events jump there, and diagnostic-only
  visits (which have no clinical wizard) start there.

### page: Admin → Plans — Lipana link toggle fixed, "Offered to" hidden for suppliers  —  2026-07-29
- **What changed:** two fixes in the package editor.
  1. 🐞 **The "Add a custom Lipana payment link" checkbox would not stay ticked.** `checked`
     read the URL VALUE (`!!url`), but ticking the box sets the url to `''` — and `!!''` is
     false, so the box redrew **unchecked while its own input appeared underneath**. It only
     ticked itself once you typed something. It now reflects whether the field is *enabled*
     (`!= null`), which is what the box actually means.
  2. **"Offered to" is hidden on the Supplier tab.** A supplier package is supplier-only by
     construction, so the control could only restate what the tab already decided — or set it
     WRONG, cross-listing a supplier plan onto clinic billing screens. `createPackage`
     already stamps the audience from the tab, so nothing is lost.
- **Record impact:** 🟢 None — UI only. No package rows change.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: the reconciliation slip is now a real, printable document  —  2026-07-29
- **What changed:** new `components/clinic/receipts/ReconciliationDocument.tsx` — one document
  that renders as a **RECEIPT** when the bill is filled and a **PAYMENT RECONCILIATION** slip
  when it is not, decided by the server, not by the UI. Full document: header + reference,
  patient/client, billed lines, final amount / paid / balance, every payment that landed, and
  a "this is not a receipt" notice on the slip. Prints via the house `printElementAsPdf`.
  Used by the visit's Receipt tab and the client-profile receipt modal (whose Print button
  previously did nothing). Replaces the interim `ReceiptOrSlip` panel, now deleted.
- **Record impact:** 🟢 None — read-only.
- **Data dependency:** **Requires migration 157** (`GET /visits/:id/reconciliation`).
  **Graceful fallback:** on any failure it renders "Payment record unavailable" rather than
  breaking the visit or the modal.
- **Rollback:** revert the commit and rebuild.
- 🐞 **Fixes two real bugs in the old receipt tab:**
  1. it was **disabled unless `isPaid`**, so a part-paid bill could never reach the very
     document the slip exists for;
  2. it printed **"Amount Paid = `visit.totalCost`"** — the visit's face value, not what was
     actually paid. Wrong whenever a bill is part paid, or filled for less than face value
     via a discount or write-off. Every figure now comes from the settlement rows.
- ⚠️ **Watch out:** the tab's label and its enabled state come from
  `GET /visits/:id/reconciliation`, fetched once per visit in `VisitDetailView` and passed
  into the document via `data` so the two don't both request it.

### fix: a vaccination follow-up now shows what was actually given  —  2026-07-29
- **What changed:** the follow-up step ("Previous Visit — Plan & Outcome") read only the
  wizard blob, so a follow-up to a **vaccination visit** showed *"nothing carried over"* —
  on precisely the visit type the step exists for. A vaccination's outcome lives in
  `vaccination_records`, not in wizard data.
  - It now also loads the prior visit's vaccinations and leads with them: what was given,
    when, and what is next due.
- **Record impact:** 🟢 None — read-only.
- **Rollback:** revert; the step falls back to wizard data only.
- ⚠️ **Watch out:** the fetch is **non-fatal** — if it fails the rest of the step still
  renders. A follow-up must not be blocked because one lookup failed.
- ⚠️ **Watch out:** vaccinations now count toward "carried over", so the empty state no
  longer fires when the only thing carried over is a dose.

### data-shape + component: a receipt is per FILLED BILL, and part payments get a slip  —  2026-07-29
- **What changed:** the receipts list now reads **final amount / paid / balance** instead of a
  single total, and names the bill a receipt is FOR (`visit #N`). New `ReceiptOrSlip`
  component on the visit's receipt document: a settled bill shows its receipt, a **part-paid
  one shows a reconciliation slip** that states outright it is not a receipt. Adds
  `invoicesAPI.receiptsForVisit` / `reconciliationForVisit` / `setDiscount`.
- **Record impact:** 🟢 None — reads only; the discount call is a new opt-in action.
- **Data dependency:** **Requires migration 157** for `amountPaid`/`balance`/`visitId` on a
  receipt. **Graceful fallback** otherwise: `amountPaid` is optional, so a pre-157 receipt
  renders its total alone, and `ReceiptOrSlip` renders nothing at all if the endpoint fails.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** `receipt` on a collect response is now **nullable** — a collection that
  only part-pays every bill issues none. `ClientPaymentsTab` already guarded this
  (`res.data?.receipt?.total ?? selectedTotal`); anything new must null-check.
- ⚠️ **Watch out:** the slip's `REC-` reference is deliberately **outside the receipt number
  series**. Don't "tidy" it into one — a receipt means the bill is settled, and the slip
  exists precisely because it isn't.

### fix: collect preview allocates against the remainder, not face value  —  2026-07-29
- **What changed:** the FIFO preview and the manual-split cap still used each invoice's
  **face value**, so on a part-paid invoice the preview offered money to a balance that was
  already cleared — and the manual input let you type more than was owed. Both now use
  `outstanding`. Completes the same fix already applied to the selected total.
- **Record impact:** 🟢 None — the server always allocated against the remainder; this was a
  display and input-bound disagreement.
- **Migration / rollout:** code-only, frontend deploy.
- **Rollback:** revert the commit.

### feat: book the vaccination follow-up, not just remind  —  2026-07-29
- **What changed:** an administered vaccination with a next-dose date now offers **"Also book
  the appointment"**. The reminder was already raised server-side (095); the booking half
  existed in the API (`bookFollowUp`) but nothing ever sent it.
- **Record impact:** 🔵 Low — creates a reminder and, on click, a booking.
- **Rollback:** revert; reminders still go out, bookings must be made by hand.
- ⚠️ **Watch out:** booking is **opt-in on purpose**. Auto-booking every next dose would fill
  a clinic's diary with appointments no owner has agreed to. `bookFollowUp` is an *action*,
  not a stored field — it is sent only on that click and must never ride along on unrelated
  patches.
- Also: the registration heading now reads *"Search & Select client and patient for this
  visit"*, which says what the box actually does.

### feat: sign up as a FARM business, not just a clinic  —  migration 160 (backend)
- **What changed:** step 2 of the signup wizard now asks what kind of business is
  registering — **veterinary clinic** or **farm** — and sends `accountType`. It is the only
  question in the wizard that changes what the account *is* (which plan catalogue it is
  offered, which app it lands in), so it is asked in plain words rather than buried as a
  checkbox. Every "Clinic X" label follows the choice, from one `orgWord`, so the wizard
  can't half-switch and ask a farmer for their clinic email.
- **The audience now comes from the ORG, not the role.** A farm business and a clinic are
  the same org row and both sign in as CLINIC_OWNER / STAFF, so `audiencesForRole` and
  `defaultAudienceForRole` take an optional org and return **livestock** for a farm —
  instead of the clinic nav, not alongside it (a farm has no patients or consultations).
  Both params are optional, so every existing caller is unchanged.
- **Record impact:** 🟢 None — new signups only. No existing account changes shape, and an
  org that never sends `accountType` is a clinic exactly as before.
- **Migration / rollout:** needs backend migration **160** deployed first; the flag is
  read-only in the UI.
- **Rollback:** revert; the wizard loses the choice and everyone signs up as a clinic.
- ⚠️ **Watch out — the field-mapper footgun, hit in FOUR places.** `isLivestock` had to be
  added to `AuthContext.extractAndCacheClinicData`, `ClinicContext.transformApiClinic` and
  both local `Clinic` interfaces, on top of the backend's `formatClinic`. Every one of them
  copies field by field, so any single omission would have left a farm org rendering the
  clinical sidebar after a refresh — silently, with the API returning the right value the
  whole time. Same class as the DataContext mapper bug.

### feat: workflow fields can read a live list  —  migration 141
- **What changed:** a `select` / `seg` / `checks` field in a clinic workflow can now read a
  **live list** — staff, species, breed, products, clients, suppliers — instead of options
  typed into the builder. Retyping a list that already exists is how a field drifts from the
  real data the moment staff or stock change.
  - The builder offers *"Where the choices come from"*: **Type my own list** (unchanged
    default) or a live source. Choosing a source hides the free-text list, so there is never
    a stale copy arguing with the live one.
  - Species and breed come from the clinic's **own patients**, not a reference table — an
    equine practice shouldn't scroll past "Hamster".
- **Record impact:** 🟢 None in the frontend. Migration 141 adds a nullable
  `form_fields.options_source` (🟢 there too — NULL keeps existing fields exactly as they are).
- **Data dependency:** migration **141**.
- **Rollback:** revert; fields fall back to their static `options`.
- ⚠️ **Watch out:** a live list **degrades to a plain text input** when it cannot resolve — a
  consultation must never be blocked by a lookup. An *empty* list counts as unresolved for
  this purpose: showing an empty dropdown a vet can't get past would be worse than free text.
- ⚠️ **Watch out:** sources are resolved **once per stage**, not per field — hooks can't run
  in a render loop, and two fields sharing a source shouldn't resolve twice.
- ⚠️ **Watch out:** `options_source` is a **column**, not new `field_type` values. `field_type`
  is a closed CHECK set, so every new lookup would otherwise mean a migration.

### fix: New Visit — clearer client step, baby-blue search, New Client gets its colour back  —  2026-07-29
- **What changed** on the New Visit screen's client block:
  - **"Add a client & their pet" → "Select client and patient."** It reads as the step it
    is — you usually pick an existing client, you don't add one.
  - **The search field is baby blue** (`sky`) instead of a seafoam tint, so the primary
    field on the screen is unmistakable; the search icon follows it.
  - **New Client regains its seafoam→cyan gradient.** It had been flattened to an outline
    in `07ef53a0` ("secondary to search — not a loud gradient"); with the field now blue
    the gradient no longer competes with it, so both read at once.
- **Record impact:** 🟢 None — copy and styling only.
- **Migration / rollout:** code-only, frontend deploy.
- **Rollback:** revert the commit.
  - **The `WORKFLOW` picker is hidden** (user confirmed "hide it"). **Commented out, not
    deleted:** the state behind it is still live — `workflowTemplateId: pickedTemplateId`
    remains in the submit payload, and with nothing setting it a visit resolves its
    workflow automatically, exactly as it did before the picker existed. Restoring it is
    uncommenting one block.
- ⚠️ **Watch out:** that picker is S4's "ADDITION 2", shipped days ago. It is hidden, not
  removed — if it is not coming back, S4 should delete it properly along with
  `pickedTemplateId` / `relevantWorkflows`, since they know what else reads them.

### ui: boarding and inpatient lists no longer overflow on a phone  —  2026-07-29
- **What changed:** the meta row on each stay/admission card wraps instead of overflowing.
  It was `justify-between` with two fixed spans and no wrap, so on a narrow screen the
  right-hand value — the **pickup date** on boarding, the **tasks/meds-due counts** on
  inpatient — was pushed off the card and simply unreadable.
  - Boarding's occupancy tiles also tighten on small screens (`p-3`/`text-2xl` below `sm`)
    rather than crowding their labels.
- **Record impact:** 🟢 None — layout only.
- **Rollback:** revert; the cards clip again on narrow screens.
- ⚠️ **Watch out:** the card grids were already responsive (`grid-cols-1 sm:2 lg:3`), which
  is why this read as "fine on mobile" at a glance. The breakage was *inside* the card, not
  in the grid.

### fix: Admin → Plans fits on screen — no scrolling between tabs and editor  —  2026-07-29
- **What changed:** the create-package form and the package editor were built at full size
  (`rounded-3xl p-6`, `py-2 text-sm` inputs), so the tab bar, the package list and the
  editor could not be on screen together — picking a plan meant scrolling up and down.
  ~30% denser: cards `p-6 → p-4` / `rounded-3xl → rounded-2xl`, inputs `py-2 text-sm →
  py-1.5 text-xs`. One `inputCls` drives both the create form and the editor, so shrinking
  it shrinks the whole page consistently.
- **Suppliers too** (per the request): the supplier package grid goes **3-up → 4-up** at
  `xl` with tighter gaps and card padding, matching the Clinic Plans density.
- **Record impact:** 🟢 None — spacing and type scale only. No field, value or API touched.
- **Migration / rollout:** code-only, frontend deploy.
- **Rollback:** revert the commit.
- ⚠️ **Watch out:** the Client and Livestock tabs render through the SAME
  `SubPackagesAdminPage`, so they inherit the new density automatically — check those two
  as well as Clinic when eyeballing it, not just the tab you opened.

### feat: use a deworming protocol on the deworming step  —  2026-07-29
- **What changed:** the deworming step now offers **"Use a deworming protocol…"**, filling
  the product and its stock link from a procedure recipe instead of retyping them. Mirrors
  the vaccination prefill shipped alongside it.
  - Lists only deworming recipes **for this patient's species**, and hides entirely when
    there are none — an empty picker is worse than no picker.
- **Record impact:** 🟢 None — fills the form; the record is still created explicitly.
- **Rollback:** revert; the control disappears, the inventory search is unaffected.
- ⚠️ **Watch out:** like the vaccination equivalent, taking a protocol **does not deduct**.
  Drawing stock stays the explicit act it already was on this step.

### fix: double-clicking Book created two visits  —  2026-07-29
- **What changed:** the visit-registration submit is now guarded. Both submit buttons were
  disabled only by `!isFormValid`, so a second click before the create resolved raised a
  **second visit** — duplicate clinical records for one patient, each with its own bill.
  Both buttons now disable while in flight and read *Creating…*.
- **Record impact:** 🟢 None — it prevents rows being created that never should have been.
- **Rollback:** revert; double-submit returns.
- ⚠️ **Watch out:** the block is a **ref**, not the state flag. Two clicks in the same tick
  would both pass a state check, because state updates are async — the ref is what actually
  stops the second one; the state only drives the label.
- ⚠️ **Watch out:** the guard is released only on a validation bail-out, deliberately **not**
  in a `finally`. On a real submit the view unmounts as the parent navigates away, and
  clearing it there would re-arm the button for the moment before unmount.

### feat: prefill a vaccine from a procedure/recipe  —  2026-07-29 (completes ADDITION 1)
- **What changed:** the vaccine section of a vaccination record now offers **"Prefill from a
  procedure…"**. A clinic's protocol already names the vaccine and the stock item it draws
  from; retyping that per record is how the recorded name drifts from the vial actually used.
  - Offers only vaccination recipes **for this patient's species** that actually carry a
    product line — a recipe with no vaccine has nothing to give.
  - Hidden entirely when there is nothing to offer.
- **Record impact:** 🟢 None — sets the vaccine name and the stock link on the record.
- **Rollback:** revert; the control disappears, the stock search is unaffected.
- ⚠️ **Watch out:** prefill deliberately **does not deduct**. Drawing a dose stays the
  explicit act it already was, so browsing recipes can never move inventory. Deduction
  remains the stock-search / settle path.

### feat: stock before → after on the vaccine picker  —  2026-07-29 (ADDITION 1)
- **What changed:** each row of the vaccine-stock picker now reads **`12 → 11 doses`** instead
  of just the current count, so the effect on inventory is visible at the point of choosing
  rather than discovered afterwards. The last dose is called out in amber.
- **Record impact:** 🟢 None — display only.
- **Rollback:** revert; the row shows the plain count again.
- ⚠️ **Watch out:** this is what **will** happen, not what has. A vaccination draws one dose,
  but the deduction happens when the record is stocked/settled — not at selection. Do not
  read this chip as proof stock moved.

### fix: settling a bill — search the invoices, and see what is actually owed  —  2026-07-29
- **What changed:** a clinic reported it is hard to settle a bill. Three things in the
  Payments tab:
  - **The selected total was wrong on part-paid invoices.** It summed each invoice's face
    value, not its remainder, so the figure staff read out to the client overstated what
    was due. The server had always allocated against the remainder — only the display
    disagreed. Now sums `outstanding`.
  - **A search box.** By patient (a client with two pets pays for one), by visit number, or
    type an amount to see everything owing at least that much — how someone holding cash
    actually looks for the bill it covers. The selection survives the search.
  - **Each invoice lists the payments that cleared it**, with amount applied per payment.
    An invoice fulfilled by three payments shows three; a part-paid one shows what is still
    owed with its face value underneath.
- **Record impact:** 🟢 None — display + a filter.
- **Migration / rollout:** code-only, needs the backend commit for `outstanding`/`payments`.
- **Rollback:** revert the commit.
- ⚠️ **Watch out:** this does NOT address the likeliest cause of "hard to settle" — an
  invoice is only collectable once the visit is finalized (`status` COMPLETED or
  PENDING_PAYMENT). Money cannot be taken against an open visit at all; that is what the
  pay-first flow is for. Confirm with the clinic which wall they hit before building more.

### feat: pick a procedure when registering a visit  —  2026-07-29
- **What changed:** the registration screen now offers **Procedure / recipe** alongside
  Workflow, completing ADDITION 2 ("pick a procedure OR a workflow"). Choosing one stages the
  whole protocol — fees, products, diagnostics — onto the visit instead of adding each line
  by hand.
  - Applied through the **same endpoint auto-apply uses**, so stock, billing and the
    deferred-deduction rules behave exactly as when the trigger service is added manually.
  - Filtered to the categories the visit covers **and the patient's species** — offering a
    rabbit protocol for a dog is worse than offering nothing.
- **Record impact:** 🔵 Low — applying a recipe creates visit task lines and a
  `procedure_applications` row. **No stock moves at registration**; deduction stays deferred
  to settle, as it is for auto-apply.
- **Data dependency:** none beyond the existing procedure templates.
- **Rollback:** revert; registration stops offering it, auto-apply is unaffected.
- ⚠️ **Watch out:** apply runs AFTER the visit exists and is deliberately **non-fatal** — the
  visit is already created, so a failed recipe must not lose it. Staff get a toast telling
  them to add it from the visit.

### feat: pick the workflow when registering a visit  —  2026-07-28
- **What changed:** the visit-registration screen now offers a **Workflow** picker, so a
  vaccination visit can be started on a specific workflow (e.g. `Vaccination (copy)`) instead
  of whatever automatic resolution would pick. The visit then opens on THAT workflow's stages.
  - The list is filtered by the same rule the server resolves by — a workflow claiming this
    encounter/visit type, or a general one — so it cannot offer something that would then be
    ignored. Clinic workflows are marked ★.
  - It only appears when there is **more than one** option; with nothing to choose between,
    a picker is noise.
  - Switching visit type clears a pick that no longer applies.
- **Record impact:** 🟢 None — the choice lands in `consultation_records.template_id`, which
  already existed.
- **Data dependency:** migrations 136/137 and the per-visit pin (both live).
- **Rollback:** revert; registration stops offering the choice, the wizard picker remains.
- ⚠️ **Watch out:** the visit does not exist when the choice is made, so it is stashed
  locally against the new id and adopted by the wizard on first open, which persists it
  properly and then **drops the stash** — otherwise a stale local value would keep
  overriding later changes.

### fix: creating a subscription package 400'd — region and currency were never sent  —  2026-07-28
- **What changed:** the Plans create form now carries **Region** and **Currency**, and sends
  them. The API requires both (*"name, region, currency, amount (or price) and billingCycle
  are required"*) and the payload never included them, so **every** create from this page
  failed with a 400.
- **Pre-existing, not a regression:** the payload lacked them before the add-ons/supplier
  refactor too. It only started being hit once every tab got a New button — before that the
  action was effectively unreachable on most tabs.
- **Record impact:** 🟢 None — it makes a create succeed that previously always failed.
- **Rollback:** revert; creating a package 400s again.
- ⚠️ **Watch out:** region + currency are half of the uniqueness key
  (`uq_clinic_packages_name_region_currency`), so two plans may share a name only if they
  differ on one of them. Defaults are AFRICA / KES, matching every package already on prod.

### fix: Bill & Balance moves to the Bill & Invoice tab, and goes live  —  2026-07-28
- **What changed:** two things were asked for and only the second was ever done. The card
  was collapsed by default, which stopped it misleading people without making it right.
  - **Moved.** It led the patient rail — a card about money in a column about the patient,
    and nowhere near the bill it describes. It is now `BillBalanceCard.tsx`, mounted above
    `BillPanel` in the Bill & Invoice tab. The rail (shared with the visit wizard) loses it.
  - **Live.** It read `visit.totalCost` and a pet snapshot fetched once at mount, so adding
    a bill line or fixing a quantity left it quoting a number that was no longer true.
    `BillPanel` now publishes the `Bill` it holds via `onBillChange` — every mutation
    already funnels through one `setBill`, so a single effect keeps subscribers exact — and
    `VisitDetailView` holds it for both. The client's outstanding balance is re-read when
    the bill's total or status moves, keyed on those values rather than object identity so
    a no-op save doesn't refetch.
  - While it was being rebuilt: it now separates **this visit's total**, **paid so far** and
    **due on this visit**, instead of one "KES 2,000 · unpaid" string that said nothing about
    part payments. A pre-bill visit is labelled as such rather than quietly showing the task sum.
- **Record impact:** 🟢 None — UI only, no API or schema change.
- **Migration / rollout:** code-only, frontend deploy.
- **Rollback:** revert the commit; the card returns to the rail as a snapshot.
- ⚠️ **Watch out:** the card is **gone from the visit wizard's rail**, which is what "move"
  means here — a vet mid-consultation no longer sees the client's outstanding balance in the
  side column. If that context turns out to be wanted during the clinical workflow, it needs
  its own decision, not a silent restore of a stale card.

### fix: the clinic switcher stops calling branches clinics  —  2026-07-28
- **What changed:** `ClinicContext` hands the switcher a **flat** list — every main clinic
  and every branch under it, side by side — and `ClinicSearchDropdown` counted that length.
  One practice with two branches read as **"All clinics (3)"**, and the list showed the three
  as equals with nothing to say which was a location of which.
  - Counts now come from mains only, with branches counted separately:
    `All · 1 clinic · 2 branches`. Same string on the select-all row ("Everywhere · …").
  - The list is ordered parent-then-its-branches, branches indented with a `BRANCH` tag
    whose tooltip names the parent. A branch whose parent isn't in the user's own list still
    renders (unnested) rather than disappearing.
  - Search keeps a matching parent's branches visible, and finds a branch by name even when
    the parent doesn't match — previously a branch search returned a bare row with no
    indication of what it belonged to.
  - The collapsed trigger already had a tooltip; the expanded one now does too, since the
    summary can outgrow the sidebar width.
- **Record impact:** 🟢 None — presentation only. Selection payloads and the
  `X-Clinic-Ids` header are unchanged, so scope behaviour is identical.
- **Migration / rollout:** code-only, frontend deploy.
- **Rollback:** revert the commit.
- ⚠️ **Watch out:** the dropdown still renders whenever there is more than one row, branches
  included — that is deliberate. A single clinic with branches genuinely needs a scope
  switcher; it just shouldn't claim to be three clinics.

### fix: a workflow can now REMOVE fields from a built-in stage  —  2026-07-28
- **What changed:** deleting a card or field from a clinic workflow had no effect on the
  visit. Removing *Systemic Examination* from a Vaccination copy still rendered it — plus
  body condition, pain score, resp rate, murmur and effort.
  - **Cause:** for a stage mapping to a built-in step, the wizard rendered the whole
    hardcoded component and appended only the template's *custom* fields. A template was
    therefore purely **additive**: you could add to a built-in stage but never remove from
    it. It looked like it worked because stage names, order and stepper labels *do* come
    from the template — only the bodies were hardcoded.
  - **Fix:** the wizard now passes the built-in step the set of field suffixes the template
    kept (`visibleFields`), and the step renders only those. A card whose fields are all
    gone disappears entirely.
  - Covered: Examination, History, Diagnosis and Assessment.
- **Record impact:** 🟢 None — rendering only. Answers already recorded are untouched and
  remain readable wherever they are displayed.
- **Data dependency:** none.
- **Rollback:** revert; templates go back to being additive-only.
- ⚠️ **Watch out:** the fix is deliberately NOT "render the template instead of the built-in
  step". Keeping the `Core` branch is what preserves the real medication table, diagnostic
  pickers and triage panel — dropping it would look correct in testing (the fields appear)
  while silently stripping those.
- ⚠️ **Watch out:** `visibleFields === undefined` means *no template governs this stage*, so
  everything renders. That is the permanent floor — the built-in flow with no template must
  behave exactly as it always has.
- ⚠️ **Watch out:** systemic-exam data stays keyed by **display label**, while visibility is
  keyed by registry **slug**. Re-keying the data here would orphan every existing record.
- **Not yet covered:** Diagnostics, Treatment, Communication and Follow-up still render their
  built-in bodies in full. Same mechanism, mechanical to extend.

### fix: attending staff wouldn't stick, and services picked their own staff member  —  2026-07-28
- **What changed:** two separate bugs on the visit service line, reported together.
  - **Attending staff "didn't save".** It always saved — the UI threw it away. `DataContext`'s
    task mapper never copied `attendance`, so the visit refresh that fires right after a
    successful `PUT .../staff` handed the panel back a task with no staff, and the row was
    gone on the next load. Same class as the field-mapper footgun that has bitten this
    mapper before. `AttendingStaffEditor` also read `attendance` into state once at mount and
    never again, so a list that arrived after first paint (the panel opens from the ⋯ menu
    before the visit has refetched) was ignored; it now resyncs on prop change, and skips the
    sync while a save is in flight so a slow refresh can't undo an optimistic edit.
  - **A staff member nobody chose.** Adding a service from the visit — both the Add Services
    drawer and the "add encounter" transfer — assigned `staffMembers[0]`, whoever happens to
    sort first in the clinic's staff list. That is an accountability record: the assignee is
    who the task board credits and the only person (besides the owner) allowed to tick the
    service complete. New lines are now created **unassigned** and show the amber "Assign…"
    prompt the select already had for that state.
- **Record impact:** 🟢 None — client mapper and defaults only.
- **Data dependency:** pairs with the backend commit that syncs `assigned_staff_id` to the
  starred (lead) attendee, so the assignee dropdown and the Attending Staff panel stop
  naming two different people on the same line.
- **Rollback:** revert; attendance goes back to vanishing on refresh.
- ⚠️ **Watch out:** unassigned services are now normal rather than impossible — the amber
  outline will show up on visits where it never used to. The New Visit wizard's
  `autoAssignStaff` is deliberately untouched: it resolves the chosen lead staff or a
  role match, not an arbitrary first row.

### fix: a clinic's own workflow now actually replaces the default  —  2026-07-28
- **What changed:** setting up a custom workflow is meant to replace the built-in one. It
  didn't, unless the workflow was a *fork*.
  - **Resolution:** a workflow built from scratch for VACCINATION lost to our shipped preset,
    because resolution returned a SYSTEM template as soon as no clinic template matched *by
    key* — before any clinic template that claimed the visit by encounter/visit type was
    considered. The clinic's templates are now one tier, evaluated first: a clinic workflow
    qualifies if it answers to the entry point **or** claims the visit.
  - **New "Always use this workflow" toggle** in the builder (`isDefault`). When on, matching
    visits open on it automatically — nobody picks it per visit. It outranks entry-key match,
    specificity and recency, because it is the clinic's explicit instruction.
- **Record impact:** 🟢 None — resolution and one boolean that already existed on the model.
- **Data dependency:** the backend ranking commit.
- **Rollback:** revert; forks still win, scratch-built workflows go back to losing.
- ⚠️ **Watch out:** a clinic workflow for *another* visit type must not hijack the visit —
  covered by a check. `npm run check:workflow` is now 35 cases.
- ⚠️ **Still open:** a custom workflow can ADD to a built-in stage but cannot REMOVE from it —
  the stage body is still the hardcoded component (`VisitWizard.tsx` Core branch). Deleting
  the Systemic Examination card from a template does not remove it from the visit. That is
  ADDITION 3 on the board, routed to another session.

### feat: tell a forked workflow when the original has moved on  —  2026-07-28
- **What changed:** a fork whose source has advanced now shows a **`vN available`** badge in
  Visit Workflows. Clicking it opens a review dialog and, if the clinic wants it, takes the
  source's current layout.
  - **Never automatic.** Silently rewriting a clinical form under a vet mid-use is exactly
    what forking exists to prevent, so the clinic is told and chooses.
  - Taking the update replaces the **layout only** — the workflow's name, plan gating and
    which visits it opens on are kept, so re-taking a preset cannot silently re-point which
    visits it claims.
  - The dialog states both directions: what taking it would **add**, and what you would
    **lose**, with the losing side highlighted when you have stages of your own.
- **Record impact:** 🟢 None. Consultations already recorded are untouched — they keep the
  layout they were captured under.
- **Data dependency:** backend `GET /workflow-templates/:id/upgrade` and
  `POST /:id/adopt-base`.
- **Rollback:** revert; the badge disappears and forks simply never mention their source.
- ⚠️ **Watch out:** the diff is **not a version changelog.** Only the source's *current*
  layout is stored, never the historical one at `base_version`, so what is shown is "how your
  copy differs from the source as it stands today". The dialog says that in as many words —
  do not shorten it to "what changed in the update", which would be false.
- ⚠️ **Watch out:** diffing is by **stable key**, not label. A renamed stage is the same
  stage; comparing labels would report it as removed-plus-added.

### feat: pick the workflow a visit uses; customised presets finally take effect  —  2026-07-27
- **What changed:** two halves of the same gap.
  - **Customising a preset now replaces the default.** Forking produced a copy keyed
    `custom.<slug>`, while resolution matched on `key === entryKey` — so a clinic's own
    Vaccination workflow could never win and the visit kept opening ours. A fork now answers
    to its ORIGIN's key. Customise Vaccination, and every vaccination visit opens your version.
  - **Per-visit switcher** in the wizard header: *Automatic* plus every workflow, clinic ones
    marked ★. Choosing one pins it to that visit and persists on the consultation record
    (`template_id`, unused since 137), so it survives a reload and follows the visit to
    another machine.
  - **Visible indicator**: when a visit is running the clinic's own workflow, a
    `Custom · <name>` chip appears, tooltipped *"Using custom <name> workflow — your clinic's
    version, not the VetHub default."* Nothing is shown on a shipped preset, where there is
    nothing to say.
- **Record impact:** 🟢 None — writes a column that already existed.
- **Data dependency:** the backend commit carrying `templateId` on GET/PUT `/visits/:id/workflow`
  and the fork-key matching.
- **Rollback:** revert; resolution returns to automatic-only.
- ⚠️ **Watch out:** `templateId` is written **only when the client sends it**, so an ordinary
  wizard autosave cannot clear a workflow staff deliberately chose. Keep that guard if you
  touch `saveWorkflow`.

### fix: visit services now carry their catalog id, so recipe auto-apply is reliable  —  2026-07-27
- **What changed:** every task the visit-registration screen builds now sends `serviceId`.
  Only **7 of 234** tasks on prod carried one, so the backend was almost always falling back
  to matching a procedure recipe's trigger service **by name** — meaning renaming a service
  silently stopped auto-apply, with no error anywhere.
  - Covers the main category picker, the vet-visit seed and the grooming/boarding seed.
  - Configured fee lines (house-call call-out, walk-in and after-hours surcharges, travel)
    explicitly send `undefined` — they are not catalog services and should carry no FK.
- **Record impact:** 🟢 None — new tasks simply store a column that was already there.
- **Data dependency:** none; the backend has always accepted and stored `serviceId`.
- **Rollback:** revert; matching falls back to names again.
- ⚠️ **Watch out:** the id is guarded by a **numeric check**. Staged items fall back to using
  the service NAME as their local id, and passing that as `serviceId` would be a bad foreign
  key — `catalogServiceId()` sends the value only when it is actually numeric.
- ⚠️ **Watch out:** this fixes new tasks only. The 227 existing prod tasks keep a null
  `service_id` and still match by name.

### feat: multi-staff attendance on visit services  —  2026-07-27
- **What changed:** a visit line can finally record everyone who performed it — surgeon,
  assistant, nurse — instead of a single `assignedStaffId`. `visit_task_staff` and its 178
  backfilled prod rows have existed since migration **106**; nothing read or wrote them.
  - Line ⋯ menu → **Attending staff**. The panel also appears on its own whenever a line
    already has attendees, so existing data surfaces without hunting for it.
  - One person can be marked **lead** (star); the first added becomes lead automatically.
  - Read-only once the visit is finalized or paid, matching the server.
- **Record impact:** 🟢 None — writes to a table that has existed since 106.
- **Data dependency:** the backend attendance commit (`PUT .../tasks/:taskId/staff` and
  `attendance` on every task payload).
- **Rollback:** revert; the rows stay, they simply stop being displayed.
- ⚠️ **Watch out:** **`fee` is INTERNAL clinic cost and never reaches the client's invoice.**
  Nothing in the UI sums it into a client-facing total, and it must stay that way — what a
  client pays does not change because a second nurse was present. Charging for an extra
  attendee remains an explicit FEE line.
- ⚠️ **Watch out (backend):** attendance had to be added to `transformTask` **and** all three
  task include sites **and** `updateAppointmentTask`'s return shape in one change. That
  function is what the Redis write-behind hash stores, so a relation included but not
  transformed returns an empty list on every cached read — the UI would silently blank its
  own staff list.

### feat: change the service on a visit line in place  —  2026-07-27
- **What changed:** a visit line's ⋯ menu gains **Change service** — swap Bordetella for
  Rabies without deleting the line. Delete-and-re-add lost the assigned staff, the price and
  any note on the card, which is why vets left wrong entries alone.
  - Rides the existing `PUT /appointments/:id/tasks/:taskId` (a swap *is* an edit of the
    line), so the write-behind hash, derived visit status and the bill stay consistent.
  - **Same-category only.** The picker offers nothing else, and the server refuses it —
    the category decides what the line means and which module record hangs off it.
  - Warnings come back from the server and are shown as non-blocking toasts.
- **Record impact:** 🟢 None structurally. A swap **writes a stock movement** when the old
  dose had been deducted (🔵 on `stock_movements` / item quantity) and clears `next_due_at`
  on the linked vaccination record.
- **Data dependency:** the backend swap commit. Without it the request falls through to a
  plain task update and the item does not change.
- **Rollback:** revert; the menu entry disappears and delete-and-re-add returns.
- ⚠️ **Watch out:** the next-dose date is **cleared, never carried over**. Rabies and
  Bordetella are not due at the same time, and `next_due_at` becomes a real reminder and
  booking (095) — carrying it would silently book the owner for the wrong follow-up. Staff
  must re-enter it; the UI says so and the server warns.
- ⚠️ **Watch out:** the new vial is **not** auto-deducted. The old dose goes back to stock
  and the new record starts un-deducted, exactly like a fresh one, so staff draw it
  explicitly rather than having stock move behind their back.

### ui: Billables and Visit Workflows move under Billable Items; Bills hidden  —  2026-07-27
- **What changed:** sidebar reorganisation so everything that becomes — or shapes — a charge
  sits in one group.
  - **Visit Workflows** moves from Clinic Management to **Billable Items**, beside Procedures.
  - **Billables** joins it: a new `clinic-billables` view that opens Clinic Settings straight
    on its Billables tab (daily rates + emergency billables), rather than leaving it buried
    as a tab under Clinic Management. Same pattern as the existing `supplier-branches` /
    `supplier-employees` deep links.
  - **Bills** is commented out of the nav at the user's request. The view is untouched and
    still routable — only the entry is withdrawn, so re-enabling it is uncommenting one line.
  - Both entries were added to the legacy *Inventory & Suppliers* group too, since
    non-`prod_test` clinics still render that layout.
- **Record impact:** 🟢 None — navigation only.
- **Data dependency:** none.
- **Rollback:** revert; Bills returns and both items go back to Clinic Management.
- ⚠️ **Watch out:** `clinic-billables` is deliberately absent from `VIEW_KEY`, so it inherits
  Clinic Settings' always-allowed behaviour rather than gaining a gate of its own.

### fix: grooming visits were rendering the house-call workflow  —  2026-07-27
- **What changed:** template resolution now follows the wizard's own entry point instead of
  competing with it, and the three remaining builder gaps are closed.
  - **The bug:** a GROOMING visit showed the house-call stepper. `standard`, `surgery` and
    `houseCall` all carry NULL encounter *and* visit type, so they tied at zero specificity
    and the most recently seeded row won. Resolution also ignored the manual workflow switch
    on a multi-encounter visit, the emergency override and `isHouseCall`. `useVisitWizard`
    now sends the `entryKey` it already resolved, which wins server-side, and re-resolves
    when staff switch workflow.
  - **`native` fields in mixed stages** no longer degrade to a placeholder. A built-in stage
    the clinic extended renders the real step — medication table, reminder rows, diagnostic
    pickers intact — with only the clinic's own questions appended beneath. Same two-tier
    split as the medical report.
  - **Catalog pickers** for `lab` / `imaging` / `service` / `product` replace the text
    fallback. They store `{ id, name }`, so the report prints the name and a later phase can
    turn the answer into a real order or bill line; products come from inventory, the rest
    from the service catalog narrowed by category.
  - **Species** is passed into resolution (`pet.species`), so a species-restricted workflow
    can finally match.
- **Record impact:** 🟢 None.
- **Data dependency:** backend commit adding `entryKey` to `/workflow-templates/resolve`.
  Deploy the backend first, or resolution silently falls back to tuple matching — i.e. the
  bug persists.
- **Rollback:** revert; the wizard falls back to the built-in entry points.
- ⚠️ **Watch out:** a SYSTEM preset with neither encounter nor visit type is no longer
  generically matchable — only `standard` is. `surgery` and `houseCall` are reached by rules
  no column expresses. A CLINIC template with neither is still generic.

### feat: Plans — Add-ons tab, and every tab uses one editor  —  2026-07-27
- **What changed:** Admin → Plans now behaves the same on every tab.
  - **New Add-ons tab.** A tier-0 package (AI Assist) layers OVER a plan rather than
    occupying a rung on the ladder, so it no longer sits in Clinic Plans beside Manager /
    Pro / Enterprise. Tier 0 is the marker: Clinic Plans excludes it, Add-ons shows only it.
  - **Supplier Plans uses the same editor as Clinic Plans** — pill selector plus
    Views & Services / Limits & Pricing — instead of its own card grid. Supplier plans live
    in a separate table behind a separate API, so an adapter picks the API by tab; the tabs
    now differ only by which catalog of keys they offer.
  - **Refresh + New on every tab** (labelled "New Add-on" on the Add-ons tab). They were
    previously rendered only for Clinic Plans.
- **Record impact:** 🟢 None — the frontend reads and writes existing rows.
- **Data dependency:** backend commit exposing `featureKeys` on supplier packages plus
  `POST /:id/features` and `DELETE /:id/features/:feature`. **Without it the Supplier tab's
  Views & Services panel cannot save** — the column existed since 108 but the admin API
  never exposed it.
- **Rollback:** revert both commits; the supplier card grid returns.
- ⚠️ **Watch out:** switching to/from the Supplier tab changes the TABLE being read, not
  just the filter, so the list is refetched and the selection cleared. `SupplierPackagesAdminPage`
  is now unreferenced — left in the tree deliberately rather than deleted, pending S1's review.

### feat: the workflow builder becomes a plan feature  —  backend migration 138
- **What changed:** three keys added to the clinic catalog and wired through the existing
  gating stack — `view:workflows` + `capability:workflow-builder` (Pro),
  `capability:workflow-share` (Enterprise).
  - `VIEW_KEY` now maps `workflows` / `workflow-builder`, so the sidebar prunes the entry
    and the route lock screen both work with no extra code.
  - "New workflow" is wrapped in `UpgradeGate`; Customise / Deactivate / Publish are hidden
    without the key; the builder page itself goes **read-only** rather than offering a Save
    button that would 403 on click.
  - `FEATURE_COPY` entries added so the upsell names the feature and the plan.
- **Record impact:** 🟢 None in the frontend. The migration appends keys to
  `clinic_subscription_packages.feature_keys` (🔵 there).
- **Data dependency:** backend **138**.
- **Rollback:** revert; every control returns to ungated.
- ⚠️ **Watch out:** a clinic that DOWNGRADES keeps consulting normally — its workflows still
  render in the wizard, they just become read-only. That is deliberate: the reads are
  ungated because the wizard calls `/resolve` on every consultation and the shipped presets
  ARE the built-in flow. Gating reads would break consultations for every clinic below Pro.

### feat: custom fields reach the medical report  —  2026-07-27
- **What changed:** `MedicalReport` now renders the questions a clinic added itself. Two
  tiers, deliberately:
  - **Core fields keep their hand-written narrative** — *"Velvet presented with vomiting of
    3-day duration"*. Nothing about the existing report changes.
  - **Clinic-added fields are reported as labelled facts** under the section they were laid
    out in, in the clinic's own order. There is no prose to generate for a question we have
    never seen, and inventing one would risk misstating a clinical finding.
  - **Stages a clinic invented outright** get their own titled section after the standard
    eight, in template order.
  - Values are normalised for print: a checklist becomes its ticked labels, a
    normal/abnormal card becomes its findings (or "Normal"), a list becomes a joined line.
    Anything empty is dropped rather than printed as a blank row.
- **Record impact:** 🟢 None — read-only rendering of what is already stored.
- **Data dependency:** backend **136**; the report reads the template from `useVisitWizard`,
  and without one it renders exactly as before.
- **Rollback:** revert; the report falls back to narratives only.
- ⚠️ **Watch out:** a section that previously printed "Not recorded." now prints custom facts
  if the clinic captured any — `has` was widened per section, so an empty narrative no longer
  suppresses a populated custom field.

### feat: Add-ons section on Billing + Base plan / Add-on toggle in Admin  —  2026-07-27
- **What changed:** AI Assist is now sold as an add-on, so the billing screen had to stop
  treating every package as a tier.
  - Add-ons are **filtered out of the Change Plan grid** and given their own section. An
    add-on is tier 0 with no limits — left in the grid it renders as a downgrade to
    nothing. The section states plainly that buying one doesn't change your subscription.
  - The buy button is **disabled without a base plan** ("Choose a plan first"), matching
    the server: an add-on grants nothing on its own.
  - Owned add-ons show **Active**, sourced from the same access endpoint the gate reads,
    so billing and entitlements can't disagree.
  - `fetchInfo()` now also refreshes plan access — every settle path funnels through it,
    so a freshly bought add-on can't stay invisible to the gate until reload.
  - Admin → Plans: any package can be flipped **Base plan / Add-on**.
- **Record impact:** 🟢 None.
- **Data dependency:** **Requires migration 112** and the `isAddon` field on
  `/stripe/info` (cache bumped v11).
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** adding a future add-on needs **no frontend change** — create the
  package and tick Add-on in Admin → Plans.


### feat: the visit wizard renders from a clinic's own workflow  —  2026-07-27
- **What changed:** When a visit resolves to a clinic-built workflow, the wizard now renders
  **that** — the clinic's stages, cards, field order and widths — instead of the hardcoded
  flow. New `TemplateStep` renderer; `useVisitWizard` resolves a template and derives the
  step sequence from it.
  - **The built-in flow remains the permanent floor.** No template, an API error, or a
    template with no populated stage → the wizard behaves exactly as it always has. This is
    why it can ship before any clinic has built anything.
  - **Same data shape.** A field keyed `<stage>.<leaf>` writes to `data[stage][leaf]`, so a
    core field in its native stage lands in the slot `MedicalReport.tsx` already reads —
    reports keep working untouched.
  - **A stage holding one built-in block IS that block.** Every shipped entry stage is
    seeded that way, so triage, the grooming report card and the gate-check forms keep their
    real components under a template instead of degrading to a placeholder.
  - `WizardStepId` widened with `(string & {})` so clinic stage slugs are valid, and every
    `STEP_DEFS[...]` lookup now falls back to the template's own label — an unguarded one
    would have thrown the moment a vet completed a custom stage.
- **Record impact:** 🟢 None — same `consultation_records` blob, same keys.
- **Data dependency:** backend **136** + seed (live on staging and prod), and **137** for
  `consultation_records.template_id`.
- **Rollback:** revert; the wizard falls back to the hardcoded entry points.
- ⚠️ **Watch out:** a *custom field of type `native`* inside an otherwise normal stage still
  renders as a labelled placeholder — only a whole stage that is a single native block gets
  the real component. Catalog-backed types (`lab`/`imaging`/`service`/`product`) fall back to
  a text input until P5 builds their pickers.
- ⚠️ **Watch out:** template resolution does not pass **species** yet, so a species-restricted
  template will not match. Harmless today (nothing ships one) but it silently narrows a
  clinic's intent — pass `pet.species` when the wizard has it.

### feat: Visit Workflow builder  —  2026-07-27
- **What changed:** Clinic Management → **Visit Workflows**. Clinics can build the form a
  vet actually fills in: add/rename/reorder stages, group questions into cards, and drag
  fields into position. New views `workflows` (list) and `workflow-builder` (editor),
  plus `workflowTemplatesAPI`.
  - **Search a field, or create it.** The picker searches the core registry and the
    clinic's own fields; anything missing is created inline as `custom.<slug>`. The key
    is permanent, the label is renamable — so renaming never detaches recorded answers.
  - **Shipped presets are read-only by design.** A clinic uses ours *live*, which is how
    our improvements reach everyone; "Customise a copy" forks an editable version that
    records which version it came from. Copying from the shared library forks too, so one
    clinic's later edits can never alter another clinic's live form.
  - **Layout stores order and width only** — array position is the order, `span` is grid
    columns. Deliberately no pixel coordinates: the wizard grids are responsive and stored
    positions would break on every other viewport.
  - The picker greys out a field whose **leaf key is already claimed in that stage**
    (`history.chiefComplaint` vs `custom.chiefComplaint`). Answers are stored
    `data[stage][leaf]`, so allowing both would let one silently overwrite the other. The
    API rejects it too — the UI just explains it before you hit save.
  - Built-in blocks (medication table, reminders, diagnostic requests, triage) are marked
    **Built-in**: positionable, not editable. They move stock, money and real records.
- **Record impact:** 🟢 None — no existing rows are read or rewritten.
- **Data dependency:** backend **migration 136** (`form_templates`, `form_fields`) applied
  AND `npm run db:seed-forms` run, or the lists are simply empty. The visit wizard does not
  read any of this yet — it still uses its hardcoded entry points.
- **Rollback:** revert the commit; the menu entry and both views disappear.
- ⚠️ **Watch out:** uses `@dnd-kit`, which was already a dependency but had **no other
  consumer in the codebase** — this is its first real use, so regressions here won't be
  caught by anything else.


### feat: Farm Settings + vet-officer picker  —  2026-07-27
- **What changed:** The last two livestock shells are now real.
  - **Farm Settings** (`livestock-settings`) leads with **care linkage** rather than
    burying it at the bottom of a form — who looks after a farm is what its setup is
    actually about. Registered clinic and attending vet are separate and independent: a
    farm can use our clinic, an outside vet officer, both, or neither.
  - **Vet-officer picker** groups two pools because they mean different things: our own
    clinic vets, and platform FREELANCERs — which is how a county vet officer exists on
    the platform. Searchable, with an explicit "self-managed" state so *no vet* reads as
    a deliberate choice rather than missing data. Backed by new
    `GET /livestock/vet-officers`, which returns a `kind` discriminator.
  - The Farms quick-add modal gets a compact grouped `<select>` for the same field.
  - Save is disabled until something changes; the draft resets on farm switch so edits
    can't leak between farms. Archive keeps history and is reversible via Restore + Save.
- **Record impact:** 🔵 Low — writes `linked_vet_user_id` / `linked_clinic_id` on the
  farm you edit.
- **Data dependency:** Requires migrations 109 + 152 (both live).
- **Rollback:** revert the commit and rebuild.


### flow: livestock is a MODE of the client portal, not a second portal  —  2026-07-27
- **What changed:** Farm owners get their livestock experience inside the existing portal,
  on the same login.
  - **`usePortalMode`** derives Pets vs Farm from what the account HOLDS
    (`/portal/me/holdings`), not from `clients.is_livestock` — a boolean can't express
    "has both", which is the common case for a smallholder with a dog and dairy cows.
    Server suggests on first visit; last-used is remembered in `localStorage`. A stored
    mode the account can no longer satisfy (farm sold, last pet removed) falls back rather
    than stranding them on empty nav.
  - **Nav follows the mode.** The Pets/Farm switcher renders ONLY for an account holding
    both, so a pet-only owner's portal is byte-for-byte what it was.
  - **`ClientFarms`** (`/client/farm`) leads with the two daily actions — one-tap **log a
    feed** (defaults to the plan's ration) and **record produce** — because most accounts
    have one farm and making them tap into it first would put navigation in front of the
    only thing they came to do. Herds and plots are read-only; the clinic maintains those.
  - **`/livestock`** is a brandable marketing entry that records FARM mode and hands off
    to `/client/farm`.
- **Record impact:** 🟢 None — plus feeding/produce rows the owner creates.
- **Data dependency:** Requires migrations 109 + 152 and the portal livestock endpoints.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** we deliberately did NOT build a second portal — one `User` spans many
  `Client` rows and a farm hangs off a Client exactly like a pet, so two portals would
  split one identity and then owe the user an account-linking flow.


### feat: VetHubCore Livestock — working module (Farms → Produce)  —  2026-07-27
- **What changed:** The livestock placeholder shells are replaced with real CRUD:
  - **Farms** — registered against an existing client (which flags them `is_livestock`,
    routing them to the livestock experience rather than the pet-owner portal); cards
    carry head-count and plot rollups.
  - **Herds & Flocks** — species, breed, head count, purpose, housing. Livestock is
    managed by GROUP, so a dairy herd of 40 is one row, not 40 patient records.
  - **Crop Plots** — crop, acreage, planted/expected-harvest dates, harvest-soon hint.
  - **Feeding** — plans per herd plus a **one-tap "Log feed"** that defaults to the plan's
    own ration (the common case is "fed the usual, now"); the modal is only for when the
    amount or time differs. Per-plan log history.
  - **Produce** — sub-tabbed schedules vs recorded yield. Recording rolls the schedule's
    next-due date forward, so the list stays a live "what's due" view.
  - **Dashboard** — head/plot/plan counts, produce due today or overdue, recent yield.
  - New `services/modules/livestock.api.ts`.
- **Record impact:** 🔵 Low — registering a farm sets `is_livestock` on that client.
- **Data dependency:** **Requires migrations 109 + 152.** Both live on prod + staging.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** lists update in place from the POST/PUT response (no refetch), per the
  house preference. **Farm Settings is still a placeholder**, and the farm↔vet-officer
  picker isn't exposed yet — `linkedVetUserId` exists and the API accepts it, but farms
  currently link to the creating clinic. Lane S6 on the session board tracks both.


### flow: gating extended to supplier, client and livestock audiences  —  2026-07-26
- **What changed:** Gating existed only for clinics. Now:
  - **Supplier** — `supplier:*` keys in `entitlements.ts` + `SUPPLIER_FEATURE_CATALOG`.
    `PlanAccessContext` picks its fetcher by role, so a SUPPLIER user's entitlements come
    from `supplier_subscriptions` (migration 108) instead of a clinic package — same
    shape, so `UpgradeGate` / `planAllows` work unchanged for both.
  - **Client** — `CLIENT_FEATURE_CATALOG`. Unlike the others these keys are **subscribed
    services** a pet owner buys (wellness / vaccination / deworming / grooming plans,
    priority booking, telehealth, home visits), not app modules.
  - **Livestock** — `livestock:*` keys + a fifth sidebar audience (farms, herds & flocks,
    crop plots, feeding, produce) routed to `LivestockPlaceholder` shells over the
    migration-109 tables.
  - **Admin → Plans** gains **Client** and **Livestock** tabs. All three non-supplier
    audiences share `clinic_subscription_packages`, distinguished by the `audiences` tag:
    the list scopes to the active tab, new plans are tagged with it, and each tab offers
    its own vocabulary via `CATALOG_FOR_AUDIENCE`.
- **Record impact:** 🟢 None (creating a plan now tags `audiences`, which was already
  a supported column).
- **Data dependency:** **Requires migrations 108 + 109** — applied to **staging only**
  at time of writing. Supplier gating reads `supplier_subscription_packages.feature_keys`,
  which prod does not yet have; `getAccessState` returns `[]` for a missing column, so a
  prod supplier would see a LOCKED plan. **Apply 108/109 to prod before deploying this.**
- **Rollback:** revert the commits and rebuild.
- ⚠️ **Watch out:** `PlanAccessProvider` had to move **inside** `SupplierProvider` in
  `index.tsx` — it now reads `mySupplier`, which wasn't in scope above it. Keep that
  nesting. Livestock pages are deliberately shells; lane S6 on the session board owns
  the build-out.

### ui: management pages flag a DEACTIVATED clinic/supplier  —  2026-07-26
- **What changed:** An admin could open Clinic Settings for a **deactivated** clinic and
  work through Identity, Branches, Personnel, Billing… with nothing anywhere saying the
  account was switched off — every tab looked and behaved like a live clinic.
  `ManagingSwitcher` (the shared "Managing [entity]" header control on every management
  page) now shows a red **Deactivated** pill beside the picker, and flags the entity in
  the dropdown options as `Name — deactivated`.
- **Record impact:** 🟢 None (indicator only).
- **Data dependency:** `clinic.isActive` / `supplier.isActive` — already on both contexts.
  The switcher's item mapper was **dropping** it, so it had to be carried through
  explicitly (same class of bug as the DataContext field-mapper footgun).
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the pill is a **warning, not a lock** — settings still save on a
  deactivated clinic, which is intentional (an admin often fixes details *before*
  reactivating). Its tooltip says so: users can't sign in, changes still save.
- ⚠️ **Watch out:** it lands on **every** management page because the control is shared —
  that's the point, so nobody gets several tabs deep unaware, but it means a copy change
  here shows up app-wide.


### ui: supplier profile card names the main branch instead of "No branches"  —  2026-07-26
- **What changed:** The profile dropdown's **Active Branches** card showed
  **"No branches"** for any supplier without branch *rows* — reading as if nothing were
  active, where the clinic side names the clinic. A supplier always has a main location:
  itself. It now names the supplier with a **Main branch** sub-label, matching the clinic
  view's shape.
- **Record impact:** 🟢 None (label only).
- **Data dependency:** `SupplierContext.mySupplier` (already loaded).
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** `Navbar` now calls `useSupplier`, which **throws** outside a
  `SupplierProvider`. Verified safe — `index.tsx` wraps the whole app in it, above
  `SupplierBranchProvider` in `App.tsx`. Keep that ordering if either provider moves.


### fix: supplier order totals were labelled "$" on KES orders  —  2026-07-26
- **What changed:** `SupplierOrdersView` printed each total with a **hardcoded `$`**, so a
  KES 249,960 purchase order read as **$249,960** — a ~130× misstatement to anyone reading
  it as dollars. Now uses the **order's own `currency`** where it has one (what it was
  priced in, and what `SupplierOrderDetailView` already showed), falling back to the
  supplier in view: the admin-scoped one, else the signed-in supplier's, else `KES`.
- **Record impact:** 🟢 None (display only — no stored amount changes).
- **Data dependency:** `Supplier.currency` (already returned) and `PurchaseOrder.currency`
  where present.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the list card was the only hardcoded `$` in the supplier area — the
  detail view, dashboard and wallet all already interpolate a `currency` variable. Worth
  grepping for a bare `$` before a number when adding money to any new view.

### fix: supplier scope had no way to apply a selection + Amber Alert now clears on stabilise  —  2026-07-26
- **Supplier picker (`SupplierSearchDropdown`).** Ticking a supplier changed the stored
  selection but **nothing refetched** — `onSelectAll` and single-pick both called
  `reload()`, the multi-select toggle didn't — and the **Apply** footer only rendered at
  `selectedIds.length > 1`. So selecting **one** supplier left the box purple, the orders
  list unchanged, and no button to commit it. Rebuilt on the **local-draft** pattern
  `ClinicSearchDropdown` already used: toggles live in the panel's own state, a persistent
  footer shows `N selected` with **Cancel** and **Apply**, and nothing touches the live
  scope until Apply. Empty draft = All suppliers, matching the backend convention.
- **Amber Alert clears immediately.** The bar polls every 45s, so stabilising a patient
  left it claiming "1 patient in emergency triage" for up to that long — the alert
  outliving the emergency, which is how staff learn to ignore it. Triage saves,
  discharge-to-vet-visit, and removing the Emergency encounter now broadcast a
  `vethub:triage-changed` window event that the bar re-polls on at once. The interval
  stays as the backstop for changes made in another tab or by another user.
- **Record impact:** 🟢 None (scope selection + a read-only alert).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** applying supplier scope still does a **full page reload** — that is
  the existing mechanism for re-sending the `X-Supplier-Id(s)` header, and is exactly why
  it can't fire per checkbox tick. The Apply button carries that in its tooltip.
- ⚠️ **Watch out:** a window event is intentionally used rather than a shared context —
  the bar lives outside the visit tree, so there are no props to thread. It does **not**
  cross tabs; the poll covers that.

### fix: removing the Emergency encounter left its service and charge on the bill  —  2026-07-26
- **What changed:** `handleDeleteEncounter` looks the entry key up in an `ENC` map and
  bails on a miss (`if (!enc) return`). **`emergency` was never in that map**, so removing
  the Emergency encounter was a silent no-op — the ✕ appeared to work while the
  "Emergency visit" service and its **KES 5,000** stayed on the bill. Added with keywords
  `emergen` / `triage`, so its services and their charges are deleted like every other
  encounter's.
  - The linked **triage record is deleted too**. Left behind it keeps the patient on the
    Emergency board — and now under the clinic-wide Amber Alert — for a workflow that is
    no longer part of the visit.
- **Record impact:** 🟡 Medium — deletes visit service rows, reduces `totalCost`, and
  deletes the `emergency_triage_records` row. Behind the existing danger confirm, which
  names the services and charges first. Blocked once the visit is finalized/paid, same as
  the other encounters.
- **Data dependency:** existing `DELETE /triage/records/:id` and the visit task delete.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** if the service deletion succeeds but the triage delete fails, the
  removal is **not** rolled back — the charge is already gone, so it warns and points at
  the Emergency board instead of leaving the bill wrong.
- ⚠️ **Watch out:** the match is by service **category keyword**, not a hard link. A
  service filed under an emergency category is removed with the encounter; one filed
  elsewhere is not. Same trade-off as grooming/boarding/vaccination.

### ui: "Start New Visit" leads the patient-card menu  —  2026-07-26
- **What changed:** The pet card's action menu opened with **View Patient**, and the only
  visit-ish entry was **Create Appointment** — which books for *later* via the booking
  modal. The walk-in case, by far the most common at reception, had no entry at all even
  though `PetsView` already received an `onNewAppointment` prop wired to the New Visit
  flow. **Start New Visit** is now the first item; Create Appointment stays for booking
  ahead.
- **Record impact:** 🟢 None (navigation).
- **Data dependency:** None — reuses the existing prop and `new-appointment` route with
  `initialPetId` / `initialClientId`.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** disabled for a deceased patient, matching the guard already on Create
  Appointment and New Reminder.

### feat: clinic-wide Amber Alert while a patient is in emergency triage + fix dead emergency card  —  2026-07-26
- **What changed:**
  - **Amber Alert bar.** A sticky amber strip rides above **every** page while any triage
    record is `IN_PROGRESS`, naming the patients, and removes itself once the last one is
    stabilised. The emergency board is a page you have to be *looking at*; a patient
    mid-triage shouldn't wait for someone to navigate there. One patient with a visit →
    the bar opens that visit directly; otherwise the board.
  - **Fixed a dead click.** A triage record's `appointment_id` is **nullable** — one can
    be raised on a patient before any visit exists — and the card's handler was
    `r.appointmentId && onOpenVisit?.(…)`, so those cards rendered a hover state and a
    chevron and then did *nothing*. Confirmed on prod: Kermit (record #8, `IN_PROGRESS`)
    plus two more with no visit. Those cards now start a visit for the patient, and carry
    a **"No visit — start one"** badge so they don't look identical to ones that navigate.
- **Record impact:** 🟢 None (read-only bar; the fix navigates, it doesn't write).
- **Data dependency:** existing `GET /triage/records?scope=board` — server-side that
  filter *is* `status = 'IN_PROGRESS'`, which is what makes the bar self-clearing.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the bar polls every **45s** (plus on tab re-focus), so it can lag
  reality by up to that long — it is a safety net, not a realtime feed. A failed poll
  keeps the last known state rather than clearing, deliberately: a bar that vanishes on
  a network blip is worse than one that lingers. If it should be instant, the SSE stream
  (`vethub:stream`) is the right upgrade.
- ⚠️ **Watch out:** this is a persistent alert **bar**, not a re-theme of the whole app.
  Recolouring every surface would fight the plan/role theming already in place and make
  clinical status text harder to read; the bar is deliberately the loudest thing on the
  page instead.

### fix (admin): "Mark paid" on a support ticket — resolving one never settled the payment  —  2026-07-26
- **What changed:** A support ticket for a stuck payment had two actions:
  **Reconcile & resolve** (asks the provider) and **Resolve** (closes the ticket). When
  the provider can't confirm — the whole reason the clinic raised the ticket — reconcile
  correctly refused and the toast said *"use Manual-activate"*. **That button existed
  only on the Payments page**, so the instruction had nothing behind it and admins fell
  back to plain Resolve, which closes the ticket and leaves the payment `PENDING`. The
  clinic therefore still saw the stuck-payment banner and raised another ticket —
  observed on prod as **three resolved tickets against one still-pending KES 13 payment**.
  A **Mark paid** action now sits on the ticket itself: it manual-activates the linked
  attempt, then resolves the ticket with an audit note.
- **Why this fixes the invoice too:** the clinic's invoice list is a **projection of the
  payment attempts** — `INV-LIP-000010`'s `PENDING` badge *is* that attempt's status.
  There is no separate invoice row to sync; settling the attempt is what turns the
  invoice `PAID` and clears the banner.
- **Record impact:** 🟢 None in itself, but the action it triggers **provisions a real
  subscription** and flips an attempt to `SUCCESS`. Behind a confirm dialog, recorded as
  `paymentChannel='MANUAL'` with the admin id in `resultDesc`.
- **Data dependency:** existing `POST /admin/subscriptions/attempts/:provider/:reference/manual-activate`
  (SUPER_ADMIN only). No backend change.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the button is deliberately shown **even on RESOLVED tickets** — a
  ticket closed without settling is exactly the state that needs it, and
  `manualActivate` is idempotent (a no-op on an attempt already `SUCCESS`). Three
  tickets pointing at the same reference is normal in that state; settling once fixes
  all of them.

### fix: a reminder kept offering "Book" after its appointment was created  —  2026-07-26
- **What changed:** Creating an appointment from a reminder left the reminder card
  looking untouched — still a live **Book** button, still counted as pending — so the
  obvious next action was to book it a second time. The card's action row tested only
  `bookedAppointmentId` (the **visit** link) and ignored the **booking** link, which the
  page had already computed for the "Appointment from reminder" chip beside it.
  - Booked reminders now show **View appointment** (violet, opens the booking) instead
    of Book. A reminder whose visit exists still shows **View visit**.
  - A **Booked** badge on the card, so it doesn't read like one still waiting.
  - Header counts split: `N to book · M booked` rather than lumping both into "pending".
- **Record impact:** 🟢 None (UI over data already fetched).
- **Data dependency:** None — `appointments.originReminderId` already exists and the
  page was already loading it.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the reminder→booking map now **excludes `CANCELLED` / `NO_SHOW`**
  bookings. Without that, cancelling the appointment would leave the reminder looking
  handled forever with no way back to Book. `CONVERTED` deliberately still counts — it
  became a visit, so the reminder did its job.
- ⚠️ **Watch out:** reminder `status` is deliberately left `PENDING` when booked. Only
  the visit happening closes a reminder; booking is not completion. The distinction is
  carried in the UI, not the enum — if a future change wants it in the data, that needs
  a `BOOKED` value on `ReminderStatus` and an audit of every PENDING filter.

### fix: the double-entry guard warned about the reminder it was opened from  —  2026-07-26
- **What changed:** Booking a follow-up **from** a reminder showed
  "Already scheduled for this patient" listing **that same reminder** — the guard
  flagging the thing that opened the form. `UpcomingForPet` takes
  `excludeReminderId`, and `AppointmentCreateModal` passes its `originReminderId`.
- **Also:** the future-only window is now enforced through an explicit
  `Number.isFinite` check. It was already `>= startOfToday`, but an unparseable date
  produced an `Invalid Date` whose every comparison is `false` — so a malformed row
  silently vanished from the guard instead of being surfaced.
- **Verified against live staging data:** of 4 bookings and 5 pending reminders, the
  guard admits only Saffron's 27/07 `RESCHEDULED` booking and the future reminders —
  the three `CONVERTED` bookings (29/06, 03/07, 03/07) and the overdue `PENDING`
  reminders (02/07, 18/07) are all correctly excluded.
- **Record impact:** 🟢 None (read-only guard).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the window is deliberately **start of today**, not *now* — something
  booked for 09:00 this morning is still a same-day duplicate risk when you book at
  14:00. `RESCHEDULED` is deliberately *not* excluded: it is a live future booking.
  `ReminderCreateModal` needs no equivalent fix — it hides the guard entirely when
  editing.

### component: plan cards list REAL entitlements, delta-style  —  2026-07-26
- **What changed:** `PlanCard` listed the free-text `features` column — marketing copy
  that had drifted from what the tier actually grants (Manager showed 4 bullets and
  "+15 more features" while holding 24 keys). Cards now build their list from
  **`featureKeys`** via `planHighlights()` + a new `KEY_LABEL` map in
  `services/entitlements.ts`, so the copy can't drift again.
  - Every tier inherits the one below, so listing shared basics made all three cards
    read **identically** (same first 5 bullets — useless on a pricing page). Each card
    now leads with its **delta**: *"Everything in Manager, plus: Laboratory, Imaging,
    Boarding, Grooming…"*. New `inheritsFrom` prop, fed from `BillingView` by picking
    the highest package below this one's tier.
  - Branches come from `maxBranches` (not a feature key) and are appended as
    "Unlimited branches" / "Up to N branches".
  - `'*'` renders "Every module included". Baseline keys every plan has
    (dashboard/staff/settings/import-data/billing) are filtered out as noise.
  - "+N more" is now a **toggle** (expand/collapse) instead of dead text.
  - Fixed the footnote that read "Subscriptions are billed monthly" directly under cards
    labelled Quarterly / 6 Months / Yearly.
- **Record impact:** 🟢 None.
- **Data dependency:** **Requires the matching backend change** — `/stripe/info` did not
  return `featureKeys` or `maxBranches` at all. Falls back to the legacy `features` array
  when `featureKeys` is absent, so shipping FE-first degrades rather than breaks.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** the backend packages payload is cached **30 min**; the cache key was
  bumped `v9 → v10` so the new fields appear immediately. Any future field added there
  needs the same bump or cards render stale/empty. Also: **Pro still lists "AI assist"**
  because migration 015 put the AI keys on tiers 2–3 and 107 didn't remove them — see
  the AI add-on note before launching that package.

### flow: subscription gating — shared entitlements, plan context, inline upgrade gate  —  2026-07-26
- **What changed:** Gating was one inline `VIEW_KEY` map + `planAllows` closure buried in
  `App.tsx`, covering 13 views. Extracted and extended:
  - **`services/entitlements.ts`** — the single source for `VIEW_KEY` (now ~40 route ids
    across every clinic module, sub-routes included so deep-links can't bypass),
    `ALWAYS_VIEWS`, `hasFeature`/`allowsView`, and `FEATURE_COPY` (label + which plan
    grants it, so prompts name the plan instead of just saying "upgrade").
  - **`contexts/PlanAccessContext.tsx`** — one fetch of `/clinic-subscriptions/:id/access`
    shared with the whole tree; `usePlanAccess()` / `useFeature(key)`. Mounted in
    `index.tsx` inside `ClinicProvider`. **Fails open** while loading or on error.
    `App.tsx` now consumes this instead of its own state + closure.
  - **`components/shared/common/UpgradeGate.tsx`** — wraps a control; renders children
    when entitled, otherwise replaces them with a dashed lock panel ("Image upload is on
    the Pro plan") and an Upgrade button. `variant="inline"` for toolbar slots. Wired
    into the 5 uploaders: Lab record, Lab list, Imaging record, Boarding meal photo,
    Surgery record.
  - `FEATURE_CATALOG` gains the 14 new view keys + a new **`capabilities`** bucket
    (`attachments`, `exports`, `client-portal`); the admin plan editor renders it as a
    third toggle grid and `CustomFeatures` counts it as catalog.
  - The 403 interceptor now distinguishes `PLAN_FEATURE_REQUIRED` from a role denial and
    offers "See plans" → Billing, rather than "ask a clinic owner for permission".
  - New `vethub:navigate` window event (mirrors the existing `vethub:stream`) so leaf
    components can reach Billing without a navigation prop threaded through the tree.
- **Record impact:** 🟢 None — read-only gating.
- **Data dependency:** **Requires migration 107.** Ship it first: it seeds the new keys
  onto the tiers. Without it, an ACTIVE clinic's `featureKeys` lacks every new key and
  the modules go dark. TRIAL clinics (`['*']`) are unaffected either way.
- **Rollback:** revert the commit and rebuild; the extra DB keys are harmless.
- ⚠️ **Watch out:** gating is **hide, not disable** in the sidebar (pre-existing
  behaviour) — a locked module simply isn't in the nav, so "the page vanished" is the
  expected report from a clinic that downgrades. `capability:*` keys gate a control
  *inside* an allowed page; a plan can grant Lab but not attachments, which is exactly
  what the new admin grid lets you configure.

### feat: attending staff on a procedure recipe + New Visit header trim  —  2026-07-26
- **What changed:**
  - **STAFF** joins the component chips. Picking it searches the **clinic's staff list**
    instead of the old free-text "Consultant" box, so a recipe records a real person.
  - **Several staff per procedure** — a surgeon, an assistant, a nurse. Staff already on
    the recipe are filtered out of the search rather than offered twice.
  - Each staff line takes a **role** ("Surgeon"/"Anaesthetist"), a **stage**, and an
    **internal fee** that pre-fills from that person's standing rate for the clinic.
  - Staff cost is shown in the summary **below the estimated total, outside it**, and
    labelled internal — it is not part of what the client pays.
  - **New Visit** header: the title said "Register Visit" over a "New Visit" subtitle;
    it now reads **New Visit**, matching the breadcrumb and nav. Title, icon and the
    step indicator are each a notch smaller.
- **Record impact:** 🟢 None (UI).
- **Data dependency:** backend **migration 106** — `STAFF` on `ProcItemType`,
  `procedure_template_items.staff_user_id`/`staff_fee`, `user_clinics.default_fee`
  (returned as `defaultFee` on the staff list). Ship the backend first: an older API
  rejects a `STAFF` component outright.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** `StaffContext` maps API users field-by-field, so `defaultFee` had to
  be added there explicitly — a field missing from that mapper is a field the app never
  sees, whatever the API returns. Its sessionStorage key was bumped **v3 → v4** so warm
  caches don't serve staff rows without the new field for 15 minutes.
- ⚠️ **Watch out:** `StepIndicator` is shared, but `NewVisitView` is currently its only
  consumer — a second consumer would inherit the smaller sizing.

### page: Billing & Subscription — 3-tab layout (billing / documents / tickets)  —  2026-07-26
- **What changed:** `BillingView` was one long scroll: plan cards, then Payment History,
  then a receipt modal, with "Report an issue" as a header button and no way to see a
  raised ticket again. It is now tabbed:
  1. **Current Billing** — trial banner, current plan card, plan usage, branch notice, Change Plan grid.
  2. **Invoices & Receipts** — sub-tabbed. *Invoices* lists every subscription charge
     (paid or not) with a printable invoice document; *Receipts* lists only settled
     charges with the existing receipt document. Payment History no longer lives under
     the plan cards.
  3. **Tickets** — new `SupportTicketsPanel` showing the clinic's raised payment tickets,
     their status (Open / In progress / Resolved), the admin's response notes, resolution
     timestamp, and a link to the uploaded payment proof.
  - New `InvoiceModal` (printable, mirrors `ReceiptModal`); document numbers are derived
    deterministically as `INV-<CHN>-<id>` / `RCP-<CHN>-<id>`.
  - Submitting the report-an-issue modal now lands the user on the Tickets tab.
  - The stale-pending-payment banner and error banner stay above the tabs, always visible.
- **Record impact:** 🟢 None — read-only surfaces over existing endpoints.
- **Data dependency:** None. `GET /subscriptions/tickets` (`supportTicketsAPI.listMine`)
  already existed and was unused by the frontend; requires migration **039**
  (`subscription_tickets`) to be live, which it is.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** there is **no subscription invoice table** in the backend — each
  payment attempt *is* the charge, so an "invoice" is rendered from its
  `PaymentHistoryRow`. If a real invoice entity is ever added, `docNo()` and
  `InvoiceModal` are the two places to repoint. Also: the payment/cancel modals are
  siblings of the tab panels, not inside them, so switching tabs mid-STK-push doesn't
  unmount the poller.

### feat: procedure editor — multi-select component types + All  —  2026-07-26
- **What changed:** The Add-component type chips (Service / Medication / Consumable /
  Lab / Imaging / Fee) were single-select, so building a recipe meant switching chip by
  chip. They now **toggle**, with an **All** chip that clears the selection — one search
  across everything ticked. All is the default, so the picker opens browsable instead of
  pre-filtered to Service.
  - The **Fee** form is no longer an either/or: it appears alongside the search whenever
    Fee is in the selection, so a recipe's fee and its items can be added in one pass.
  - Search placeholder adapts (services only / inventory only / both).
- **Record impact:** 🟢 None (editor UI; the saved recipe shape is unchanged).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the component type used to come from whichever chip was active — with
  several selectable that no longer works, so each result now **resolves its own type**
  and shows it as a badge before you click. Services resolve Lab/Imaging from category
  keywords (the same rule the old pre-filter used). **Inventory carries no
  medication/consumable flag**, so that split is inferred from the category name
  (`suture`, `glove`, `syringe`, `dressing`, … ⇒ Consumable, else Medication). An item in
  an oddly-named category will land as Medication — the badge makes that visible before
  it is added, but the real fix is a type flag on `inventory_items`.

### feat: payment allocation in the client Payments tab (Revenue Cycle P3)  —  2026-07-26
- **What changed:** Collecting one payment across several invoices can now be split.
  - **Amount** field next to the method picker. Left blank it settles the selection in
    full, which is exactly what the tab did before — the new controls only appear once
    the amount is short of the total, so the common case is unchanged.
  - **Oldest first / Manual** toggle. Oldest-first previews the split inline (each
    selected row shows what it receives) so the allocation is visible *before* it is
    committed rather than being a surprise on the receipt. Manual gives each row its own
    input, with a live "still to allocate" / "over-allocated" readout that blocks the
    Collect button until the split adds up.
  - Rows that will keep a balance are badged **"X left"**, and the toast reports how many
    invoices settled in full versus how many were merely touched.
  - Over-tendering is refused with an explanation pointing at the real fix (select more
    invoices) — client credit doesn't exist yet.
- **Record impact:** 🟢 None (UI over an existing endpoint).
- **Data dependency:** backend **migration 105** (`settlements`) and the `amountTendered` /
  `allocations` inputs on `POST /clients/:id/collect`. Against an older backend the extra
  fields are ignored and the whole selection is settled in full — so ship the backend first.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the FIFO preview is computed client-side to mirror the server's rule
  (oldest `date` first). If the server's ordering ever changes, this preview has to change
  with it or it will quietly disagree with the receipt.

### fix: "Invoice & receipts" opened the wrong tab  —  2026-07-25
- **What changed:** The rail's **Invoice & receipts** button still switched to
  `records` + the `invoice` inner tab — correct before the Bill/Records split, but
  since then the invoice lives under **Bill & Invoice**, so the button landed you on
  Records & Reports with nothing to show. Now targets `billing`.
  Bill & Balance is also **collapsed by default**: its figures are a snapshot that
  doesn't re-read as the bill is edited, so leaving it open invited staff to trust a
  stale number. The live figures are on the Bill tab.
- **Record impact:** 🟢 None (navigation + default UI state).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the card is still a snapshot when expanded — it does not
  subscribe to bill changes. Making it live is the proper fix; collapsing it only
  stops it misleading by default.

### ui: units-per-pack label follows Unit Type  —  2026-07-25
- **What changed:** On the inventory item form, "Units per pack" now reads
  **"Capsules per pack"**, "Tablets per pack", etc., taking its noun from the chosen
  Unit Type, with the placeholder matching (`e.g. 30 Capsule per box`). Measures
  (mL, mg, g, kg, IU, cc) and words already ending in *s* are never pluralised.
- **Record impact:** 🟢 None (label only).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** this field is what the margin readout uses to convert cost→sale
  when the two are priced per different units, so the clearer label directly reduces
  the chance of a wrong margin.

### ui: Bill · Invoice · Receipt as three tabs inside Bill & Invoice  —  2026-07-25
- **What changed:** The Bill & Invoice tab now holds **three inner tabs — Bill,
  Invoice, Receipt** (Bill first and default). The bill panel used to sit stacked
  above the Invoice/Receipt strip, which made the tab scroll long and hid the
  invoice below the fold.
- **Record impact:** 🟢 None (layout only).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.

### feat: Generate Invoice from the bill (Revenue Cycle P2)  —  2026-07-25
- **What changed:** The **Bills** queue gains an **Invoice** action on every APPROVED
  bill (hidden on any other status, so the invalid call never happens), and the
  visit's Bill panel gains a **Generate invoice** button plus an invoice strip
  showing number, total, collected and outstanding once one exists.
- **Record impact:** 🟢 None directly — generating writes an invoice row and flips the
  bill to INVOICED server-side.
- **Data dependency:** **Requires migration 101** and the `/invoices` +
  `/visits/:id/invoice` endpoints. Ship the backend first.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the invoice is not editable by design. "Outstanding" is derived
  from what was collected **on the visit**, not allocated per invoice — exact
  per-invoice allocation arrives with settlements in P3.

### flow: Bill Review at End Encounter + Bills queue (Revenue Cycle P1)  —  2026-07-25
- **What changed:** The visit's `Records & Billing` tab splits in two: **Records &
  Reports** (medical report, grooming, boarding, meds & consumables) and **Bill &
  Invoice** (the bill, invoice, receipt). Grooming and Boarding tabs now always
  appear — a visit without that work shows **"No results"** instead of the tab
  vanishing. The inner tab resets when you switch, so you never land on a tab the
  new strip doesn't offer.
  - New **`BillPanel`** (replaces `EstimatePanel`): every line the encounter
    produced, with editable qty and unit price, delete, **Add item**, Approve, and
    Reopen. *Add item searches the service catalog* — pick a service and it fills
    the name/price, or type anything the catalog doesn't have and it lands as an
    **Other** line, so a forgotten charge is never blocked by the catalog.
  - **Approve locks the clinical record** (payment no longer does); Reopen unlocks.
  - New **Bills** page under Billable Items — the reception worklist.
- **Record impact:** 🟡 Medium — approving writes the lock state; backfill creates a
  bill per historic visit.
- **Data dependency:** **Requires migration 100** and the `/visits/:id/bill` +
  `/bills` endpoints. Ship the backend first — the panel 404s otherwise.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the bill is raised lazily the first time the Bill tab is opened,
  not on every visit creation — so a visit nobody opened the bill on still has none,
  and falls back to the legacy payment-based lock.

### feat: live profit margin on the inventory item form  —  2026-07-25
- **What changed:** The add/edit item form's **Levels & Pricing** section now shows what
  the clinic actually makes, live as cost/sale are typed: profit per sale unit, markup
  % (on cost), margin % (of sale), and the profit on the quantity being added. Turns
  red and reads "Selling at a loss" when sale < cost.
  - **Handles mismatched units.** Cost and sale can be priced per *different* units
    (buy per bottle, sell per mL), where subtracting them is meaningless. When
    **units per pack** is set it converts (cost ÷ pack = cost per sale unit) and shows
    the working; when it isn't, it says which two units disagree and what to fill in,
    instead of printing a confidently wrong number.
  - Notes that the figure excludes the Service Charges below, since those are added on
    top at billing time.
- **Record impact:** 🟢 None (derived display; no new fields, no writes).
- **Data dependency:** None — `costPrice`, `price`, `costUnit`, `sellUnit`, `packSize`
  and `quantity` are all already on the form.
- **Rollback:** revert commit and rebuild.

### feat: delete a mistaken payment from the Payments tab  —  2026-07-25
- **What changed:** The client Payments tab gains a **Delete** (🗑) action beside Void
  on each settled payment, shown only to owner/manager/admin — mirroring the server's
  role gate so the button never appears to someone who'd get a 403. The confirm
  prompt states plainly that Void is the right tool for a real reversal and Delete is
  for a mistaken entry, and asks for a reason. Void's tooltip now says it "keeps the
  history" so the two are distinguishable at a glance.
- **Record impact:** 🔴 High — triggers irreversible server-side deletion of the
  payment, its receipt and its settlement links, and reopens every covered invoice.
- **Data dependency:** `DELETE /transactions/:id` (same-day backend change). The
  reason travels as a query param because the shared `del()` helper sends no body.
- **Rollback:** revert commit and rebuild.

### ui: Patients & Clients moved directly under Dashboard  —  2026-07-25
- **What changed:** Sidebar order for the Clinic section is now Dashboard → **Patients
  & Clients** → Reminders → Appointments → Visits → Emergency → Inpatient → … (it was
  sixth, below Emergency). Order only; no view ids, permissions or deep links changed.
- **Record impact:** 🟢 None (navigation order).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.

### ui: de-duplicate the New Visit scheduling column  —  2026-07-25
- **What changed:** Three copies of the same information removed from the booking
  screen. (1) The selected date + time moved into the **Date & Time** card header,
  centred, replacing the "Selected Visit Time" card that sat under the picker saying
  the same thing. (2) The chosen time no longer echoes on the Time Slot row — the
  selected slot is already highlighted in the grid. (3) The lead vet was rendered
  **three times** in the right column (the picker, a confirmation card under it, and
  again in Team); the confirmation card is gone — the select shows name + role and
  Team carries the LEAD badge.
- **Record impact:** 🟢 None (presentation only).
- **Data dependency:** None.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** `DateTimePicker` no longer renders its own selection summary, so
  any other caller relying on it must show the selection in its own layout. Only
  NewVisitView uses it today.

### feat: create a service (with inventory attached) from both catalog surfaces  —  2026-07-25
- **What changed:** New shared `AddServiceModal` — name, category, description, default
  price, **plus attaching medicine/consumables at creation** (the same auto-bill &
  stock-deduct attachment the catalog row offers, with a live "bills at" total). The
  Billable Items → **Services** catalog page had no way to create a service at all; it
  now has an **Add Service** button beside Reload, and gained a **Service Bundles**
  section so category / service / bundle can all be created from one page. Clinic
  Settings → Categories & Services now opens the same shared modal instead of its own
  inline one, so both surfaces behave identically.
- **Record impact:** 🟢 None (creates a new service row; attachments write a per-clinic
  service override).
- **Data dependency:** None — `POST /services` and the override endpoint already exist.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** attachments are saved as a **second** call after the service is
  created (they live on the per-clinic override). If that call fails the service still
  exists — the modal says so and points at the catalog row rather than pretending the
  whole create failed.

### feat: client Payments tab — invoices, payments, receipts + multi-invoice collect  —  2026-07-25
- **What changed:** The client profile's Transactions tab is now **Payments** (id kept
  as `transactions` so existing deep links still land), rendering a new
  `ClientPaymentsTab` with three sub-views: **Invoices** (every visit bill, with paid /
  unpaid / not-finalized state), **Payments**, and **Receipts**. Tick several
  outstanding invoices → *Collect as one payment* settles them all with a single
  transaction and receipt; a payment covering more than one invoice is badged, and
  voiding it reopens every invoice it covered.
- **Record impact:** 🟡 Medium — collecting marks several visits paid at once; voiding
  reverts them to unpaid.
- **Data dependency:** **Requires migration 097** plus `GET /clients/:id/billing` and
  `POST /clients/:id/collect`. Ship the backend first — the tab 404s otherwise.
- **Rollback:** revert commit and rebuild.

### feat: per-line edit/delete on an applied procedure recipe  —  2026-07-25
- **What changed:** `AppliedProcedurePanel` generated product lines are now editable
  pre-settle: quantity input (blur/Enter to save), a Billed/Free toggle, and a delete
  button per line. Previously the expanded lines were read-only, so a recipe quoting
  2 sutures when 3 were used meant un-applying the whole procedure and rebuilding it
  by hand. Also: the visit's **Add Services** drawer and the Transfer/Add-encounter
  action now send `serviceId`, so recipe auto-apply matches on the trigger service ID
  instead of falling back to comparing service names (which breaks on any rename).
  `ApptTask.serviceId` added to the type.
- **Record impact:** 🟡 Medium — editing a line rewrites the consumable, its bill line
  and the visit total, and returns/takes stock for already-deducted lines. Only lines
  the user actively edits change.
- **Data dependency:** `PATCH /consumables/:id` must accept `quantity` (same-day
  backend change). Without it the quantity edit silently no-ops — billable toggle and
  delete work on the old backend.
- **Rollback:** revert commit and rebuild.

### flow: pay-first estimate panel on the visit  —  2026-07-25
- **What changed:** New `EstimatePanel` in the visit's **Records & Billing** tab.
  Build a quote from the visit's current services + reserved consumables, edit the
  lines, issue it to the client, then Collect — which opens the same Settle Bill
  modal used everywhere else. Once collected, the panel states plainly that the
  clinical record is **still open** and locks at finalize; after finalize it shows
  the reconciliation (quoted vs actual vs collected) and whether the client owes a
  balance or is owed a credit. `Visit.prepaid` added to the type and to BOTH
  appointment mappers (`DataContext` + `App.tsx`) — a field missing from the mapper
  is silently dropped.
- **Record impact:** 🟢 None directly; issuing/collecting writes estimate rows and
  flips `appointments.prepaid` via the backend.
- **Data dependency:** **Requires migration 096** (`visit_estimates`,
  `visit_estimate_items`, `appointments.prepaid`) and the `/visits/:id/estimate`
  endpoints. Ship the backend first — the panel 404s otherwise.
- **Rollback:** revert commit and rebuild.
- ⚠️ **Watch out:** the panel is the only surface that explains the decoupling
  ("paid, record still open"). If it's hidden on a visit, staff have no other
  in-app cue for why a paid visit is still editable.

### flow: follow-up visits open on the previous visit's plan  —  2026-07-25
- **What changed:** New wizard step `priorPlan` ("Previous Visit — Plan & Outcome"),
  now the FIRST step of the `followUp` entry point (before `reviewHistory`, which
  keeps capturing progress/compliance). It reads the PARENT visit's workflow blob
  (`GET /visits/:parentId/workflow` via `visit.parentAppointmentId`) and shows what
  the last visit ended with — outcome at consultation/close, outcome notes, diagnosis,
  treatment plan, staged reminders and requested home monitoring — then lets the vet
  tick off which carried-over care-plan items today closes out, and record why the
  patient is back. Closes the loop the originating wizard's last step opens.
- **Record impact:** 🟢 None (reads an existing record; writes only into this visit's
  own wizard blob).
- **Data dependency:** None — `consultation_records` and `visits.parent_appointment_id`
  already exist. Graceful fallback: an unlinked follow-up, or a parent whose follow-up
  step was left empty, renders an explanatory empty state and the editable fields.
- **Rollback:** revert commit and rebuild.

### feat: vaccination next-due date + follow-up scheduling  —  2026-07-25
- **What changed:** Each row in the visit's **Vaccination panel** gains a *Next dose
  due* date and a "Book the appointment too" tick; the standalone Vaccination record
  page gets the same field and prints the date on the certificate. Setting the date on
  a given dose schedules the owner's follow-up reminder server-side (and the booking
  when ticked); on a not-yet-given dose the panel says so and the reminder fires when
  it's marked Given.
- **Record impact:** 🟢 None on existing rows (writes a new optional column on records
  the user actively edits; creates new reminder/booking rows).
- **Data dependency:** **Requires migration 095** (`vaccination_records.next_due_at`)
  plus the `nextDueAt`/`bookFollowUp` handling in `POST`/`PUT /vaccinations`. Ship the
  backend first — the field reads as `null` and saves would drop it otherwise.
- **Rollback:** revert commit and rebuild.

### feat: clinic quick-add supplier in Supplier Hub  —  2026-07-25
- **What changed:** Non-admin clinic users now get an **Add Supplier** button in the
  Supplier Hub that opens a lightweight modal (name + phone/email, optional category)
  and posts to `POST /suppliers/quick-add`. Lets clinics onboard suppliers they buy
  from so they can raise POs immediately (PO custom items already allow ordering items
  not yet in the supplier's catalogue). Admins keep the full New Supplier modal.
- **Record impact:** 🟢 None (creates a new supplier row).
- **Data dependency:** backend `POST /suppliers/quick-add`.
- **Rollback:** revert commit.

### feat: per-service workflow scope in the catalog  —  2026-07-25
- **What changed:** In the Services catalog (`ClinicCatalogTab`, via the 📦 panel),
  each service now has a **"Shows in workflows"** chip picker — tag the workflow areas
  (categories) it should appear in, or leave empty for **General** (everywhere). The
  workflow service picker (`AddCategoryService`) now surfaces a service when its own
  category OR its `workflowScope` matches the step. Fixes "diagnostics list shows
  irrelevant services." Status on/off toggle already existed (per-clinic `enabled`).
- **Record impact:** 🟢 None (UI; writes the new optional override field).
- **Data dependency:** backend `clinic_service_overrides.workflow_scope` column.
- **Rollback:** revert commit.

### ui: Plans page Clinic/Supplier tabs · mobile visit tweaks  —  2026-07-25
- **What changed:** (1) Admin **Plans** page (`SubPackagesAdminPage`) now has a
  **Clinic Plans / Supplier Plans** tab strip; the supplier editor renders embedded
  under the Suppliers tab (via `SupplierPackagesAdminPage embedded`). Removed the
  separate "Supplier Plans" sidebar item (the `supplier-plans` route still works as a
  deep link). (2) New Visit (`NewVisitView`): encounter-type buttons are a 3-col grid
  that fits on mobile (was full-width stacked); client **search bar** made the primary
  element — seafoam tint, bold border, suffix search icon — and **New Client** toned to
  an outlined secondary so search dominates. **Deworming** removed from the vet-visit
  Visit-type chips (filtered from the row; the `VisitType` enum + deworming module are
  untouched).
- **Record impact:** 🟢 None (UI only).
- **Data dependency:** None.
- **Rollback:** revert commit.

### feat: PO sell price + supplier product edit fix  —  2026-07-24
- **What changed:** (1) Purchase-order form (`PurchaseOrderFormView`) — each line now
  has **Buy Price + Sell Price** with a live per-item cost/sale/profit (margin %)
  readout (adopts the stock-item form pattern). `sellPrice` is sent on create + update;
  catalog adds pre-fill a suggested sell = cost×1.3. On receive, the backend uses this
  as the inventory item's sell price. (2) **Fix:** supplier product edit/view bounced
  back to the list because `SupplierProductFormPage` read `res.data.product` but
  `GET /supplier-products/:id` returns the product directly in `data`; now reads
  `data.product ?? data`, and the whole product card is clickable to open.
- **Record impact:** 🟢 None (writes a new optional field on records the user edits).
- **Data dependency:** backend `PurchaseOrderItem.sellPrice` column (`sell_price`) —
  see backend changelog; without it, `sellPrice` is ignored server-side.
- **Rollback:** revert commit.

### feat: supplier plans admin editor + supplier dashboard ops + add-product one-card UI  —  2026-07-24
- **What changed:** (1) New admin **Supplier Plans** page (`SupplierPackagesAdminPage`,
  under Billing & Plans) — CRUD for the plans suppliers see on billing, via
  `/supplier-subscription-packages`. (2) Supplier dashboard gained onboarding checklist,
  plan + listing-quota tile, "Orders to fulfil", "Low/out-of-stock", and Best Sellers
  (own-supplier view only). (3) Add-Product form consolidated 4 cards → 1 card with
  dividers; inventory cards redesigned compact; added `mg` + medical units.
- **Record impact:** 🟢 None (new admin page over an existing table; UI only elsewhere).
- **Data dependency:** `supplier_subscription_packages` table (already live). Listing
  limit is parsed from plan feature text ("Up to N product listings") — no numeric column.
- **Rollback:** revert commit.

### page: legal pages (Terms / Privacy / Security) + wired-up marketing footer  —  2026-07-24
- **What changed:** New `LegalPage` component renders **Terms & Conditions**,
  **Privacy Policy**, and **Security** pages (drafted standard SaaS copy tailored to
  VetHubCore) as pre-auth `authView` screens, mirroring `PricingPage`. Deep-linkable
  via new `/terms`, `/privacy`, `/security` routes in `Router.tsx`. The landing-page
  **footer no longer has any dead `href="#"` links**: Platform links anchor to
  `#modules`, Marketplace → `#partners`/supplier-signup/pricing, Company → About
  (`#modules`), Careers (mailto), Contact (opens the demo/contact lead form), and
  Privacy/Terms/Security → the new legal pages. Added `onContact`/`onLegal` props to
  `LandingPage`. ⚠️ Legal copy is a working baseline, not a substitute for legal review.
- **Record impact:** 🟢 None (static marketing/legal UI only).
- **Data dependency:** None.
- **Rollback:** revert commit.

### fix(emergency): journey logs escalation · triage tab persists after discharge · fixed action footer  —  2026-07-24
- **What changed:** (1) **Escalate to Emergency** now writes a journey event (local
  wizard timeline + persisted `visit_events` via `addEvent`) — previously it flipped
  the visit type silently and nothing appeared on the patient journey. (2) The
  **Emergency Triage tab now persists after discharge**: the "Triage · closed"
  read-only tab was gated on an 'emergency'-category task existing, but consumables
  log under 'Consumables', so the trace was usually absent and the tab vanished —
  forcing a re-escalation to reach existing data. It now keys off the kept triage
  **record** itself. (3) The **Save Triage / Stabilized→Discharge** buttons are now
  a **fixed bottom footer** (like the consultation wizard), sidebar-offset, hidden
  on the read-only closed view.
- **Record impact:** 🟢 None (UI + one extra journey event on escalate).
- **Data dependency:** None.
- **Rollback:** revert commit.

### page: "Contact us for a demo" mode + admin public-signups toggle  —  2026-07-24
- **What changed:** New `PublicConfigProvider` reads `GET /public/config` once on load.
  When `signupsEnabled` is false, every "Create account" / "Start demo" CTA (plus the
  login "Sign up" link and a direct `/signup` link) opens a **Contact us for a demo**
  modal (name · clinic · email · phone · message → `POST /public/request-demo`) instead
  of the signup wizard; login stays enabled. Admin gets a **Public signups** switch at
  the top of Platform Settings. Safe default: signups ON if the config fetch fails.
  (Also ships the warm parallax landing-section backgrounds.)
- **Record impact:** 🟢 None (UI + a public lead form; the FE writes no records).
- **Data dependency:** backend `signups_enabled` column + `GET /public/config` +
  `POST /public/request-demo` (this batch's backend release) must be live.
- **Rollback:** revert commit.

### page: staff form — lock Clinic Owner role + accurate Page Access list  —  2026-07-24
- **What changed:** Editing a **Clinic Owner** now shows a locked notice instead of
  the role picker — ownership can't be re-picked here (admin clinic-transfer only),
  and `CLINIC_OWNER` is no longer a selectable chip for anyone. **Page Access** now
  lists only the sections the app actually gates (audited against `canAccess`):
  Dashboard, Finance, **Partners** (was mislabeled "Referrals"), Clinic Management,
  Suppliers. The dead **Inventory** and **Purchase Orders** toggles were removed —
  those pages are open to every clinic user, so the switches did nothing. Role
  page-access presets updated to match.
- **Record impact:** 🟢 None (UI + which coarse tokens are offered).
- **Data dependency:** None.
- **Rollback:** revert commit.

### page: Emergency Protocol Billables — show attached-consumable amounts + Bills-at total  —  2026-07-24
- **What changed:** Each attached-consumable chip now shows its amount (qty × the
  product's sell price), and each intervention shows a "Consumables … · Bills at …"
  total (fee + consumables). Previously the chips showed only name/qty/unit with no
  money, so the product amounts weren't tallied. Amount = the same price the triage
  auto-log bills at. (A KES 0 amount means that product has no sell price set under
  Products.)
- **Record impact:** 🟢 None (display only).
- **Data dependency:** None.
- **Rollback:** revert commit.

### page: Service Catalog — attach medicine/consumables to a service (📦)  —  2026-07-24
- **What changed:** Each row in the Service Catalog (Clinic Settings → Categories
  & Services / Billable Items → Services) gets a **box button** that opens an
  inline inventory search (mirrors the Emergency-Billables pattern). Add products
  as chips with an editable qty + unit; the row then shows **"Service + products
  = Bills at"** and the **owner product margin** — i.e. the price updates as
  quantities are added. Saved per-row via `upsertOverride({ products })`. When
  the service is later added to a visit, the attached products travel with it,
  tally into the line, deduct stock at settle, and land in the patient's medical
  report.
- **Record impact:** 🟢 None (UI; products stored per-clinic on the service
  override).
- **Data dependency:** backend migration **094** (`clinic_service_overrides.products`
  JSONB) + the `addTaskToAppointment` auto-attach + `generateFromAppointment`
  medical-record wiring must be live.
- **Rollback:** revert commit.

### page: staff form consolidated + expanded roles/permissions; product Add-Stock redesign  —  2026-07-23
- **What changed (staff):** The staff registration/edit view is now a **single
  card** (identity · contact · assignment · access · certifications) instead of
  four stacked cards. The role picker is expanded into grouped chips covering the
  ten new operational roles (Vet Nurse, Front Office, Receptionist, Cashier,
  Pharmacy, Lab Tech, Groomer, Kennel, Driver, Accountant) plus Manager/Vet/
  Viewer. Owners can set **Page Access** (coarse `VIEW_*`) and **Permissions**
  (granular, role defaults locked on) inline via grid-4 compact chips — picking a
  role reseeds a sensible page preset. Directory filter tabs + all role badges
  now use a shared `constants/roles.ts` catalog (labels + colours). StaffProfile
  permissions tab tightened to grid-4 chips.
- **What changed (products):** Add-Stock main category is a **Medicine /
  Consumables** toggle; subcategories are added via dropdown-or-type with an
  unlimited, **drag-to-reorder** chip list. The confusing Form/Units-pack fields
  are simplified (form auto-derives from unit type; units-per-pack is optional);
  the unit list is reordered with **mL in slot 2**; cost and sale prices each get
  their own unit selector. New **service-charge** checkboxes (service /
  administration / injection [KES + mL per shot, default 300/10mL] / prescription)
  reveal amount fields. The summary aside shows a **live P&L** (buy cost, sale
  value, profit/loss, margin %) on the quantity being added.
- **Record impact:** 🟢 None (UI; new fields are optional).
- **Data dependency:** backend migration **092** (`user_role` values) + **093**
  (`inventory_items.metadata` JSONB) must be live. Product metadata is sent on
  create/update; staff role writes require the new enum values on the DB.
- **Rollback:** revert commit.

### page: management Billing tabs = the full billing pages; procedure picker fixes  —  2026-07-21
- **What changed:** Clinic Settings' "Treasury" tab is renamed **Billing** and
  now embeds the full Billing & Subscription page (pending-payment banner,
  active-plan card, plan usage, change plan) instead of its own reduced plan
  cards — one page, two entry points. Supplier management's "Subscription"
  tab likewise becomes **Billing** and renders the full SupplierBillingView
  (side card removed). Procedure editor: component pickers are now browsable
  (focusing the search lists the first matches; LAB/IMAGING pre-filter by
  category) and inventory force-loads on open, so pickers are never empty
  when Stock Manager wasn't visited first.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### flow: Billable Items taxonomy rolled out to all clinics  —  2026-07-21
- **What changed:** the `prod_test` gate on the M4 sidebar taxonomy is
  removed — every clinic now sees BILLABLE ITEMS (Products / Services /
  Procedures / Packages) + Suppliers & Orders instead of the classic
  Inventory & Suppliers group. View ids and deep links unchanged.
- **Record impact:** 🟢 None — presentation only.
- **Data dependency:** None.
- **Rollback:** restore the prodTest condition in Sidebar.tsx SectionBlock.

### page: Billable Items sidebar taxonomy + sectioned inventory form (M4)  —  2026-07-21
- **What changed:** clinics flagged `prod_test` see the classic Inventory &
  Suppliers group replaced by **BILLABLE ITEMS** (Products = Stock Manager ·
  Services = catalog page · Procedures · Packages = Vaccine Packages +
  Service Bundles under tabs) plus a **Suppliers & Orders** rump (Purchase
  Orders, Supplier Hub). All internal view ids unchanged; old deep links
  (`vaccine-packages`, `service-bundles`) keep working; non-prod_test clinics
  see no change. New views: `PackagesView` (tab wrapper), `ServicesCatalogPage`
  (reuses ClinicCatalogTab). The Add/Edit inventory item form gains numbered
  section headers (1 Basic Information · 2 Clinical & Regulatory · 3 Stock &
  Batch · 4 Levels & Pricing) and, when editing, a read-only **"Used in N
  procedure recipes"** chip list.
- **Record impact:** 🟢 None.
- **Data dependency:** None (`clinics.prod_test` exists since migration 054).
- **Rollback:** revert commit.
- ⚠️ **Watch out:** the taxonomy is gated per clinic — flip `prod_test` on a
  pilot clinic from the admin panel to see it.

### page: supplier Add/Edit Product restyled into sections + listing preview  —  2026-07-21
- **What changed:** the flat supplier product form becomes numbered section
  cards (1 Basic Information · 2 Pricing w/ live margin % · 3 Stock & Ordering
  · 4 Provenance & Details) with a sticky **Listing preview** rail showing the
  product exactly as clinics will see it (image, name, category ·
  manufacturer · country, buy/sell, stock, availability chip). Breadcrumb now
  reads "Add Product" instead of the raw SUPPLIER-PRODUCT-NEW slug (plus
  proper labels for the other unmapped views).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### flow: applied-procedure panel on visit + surgery pages (M3)  —  2026-07-21
- **What changed:** new shared `AppliedProcedurePanel` renders each procedure
  recipe applied to a visit as a stage checklist (✓ when a stage's lines are
  complete, expandable to the generated bill lines w/ batch chips), amber
  skipped-item warnings, a violet "Recommended — tick what was performed" row
  that materializes optional diagnostics, a weight/flags **Re-evaluate**
  re-quote, un-apply (pre-settle), and a manual "Apply a procedure recipe…"
  selector. Mounted on `SurgeryRecordPage` (scoped to the record's service)
  and the visit page's Categories & Services tab (all applications).
  All service-add paths now send `serviceId` (AddCategoryService, boarding/
  inpatient grooming pickers, Book & Start staged services) so recipe
  auto-apply matches by id instead of the name fallback.
- **Record impact:** 🟢 None.
- **Data dependency:** backend M1 (migration 084, deployed) + the
  `serviceId`-in-applications payload shipped with this wave's backend.
- **Rollback:** revert commit.

### component: supplier product provenance + inventory mockup parity  —  2026-07-21
- **What changed:** supplier Add/Edit Product gains Manufacturer, Country of
  Origin and a product image upload (R2, ≤2MB); supplier product cards show the
  image + manufacturer · country line. Clinic Add/Edit Inventory Item gains
  Country of Origin, Storage Conditions (select) and a Prescription Only toggle
  — matching the design mockups. Provenance flows clinic-side automatically
  when receiving a PO.
- **Record impact:** 🟢 None.
- **Data dependency:** Requires backend migration 085. Graceful fallback —
  fields render blank until it ships.
- **Rollback:** revert commit.

### page: Procedures — recipe builder UI (M2 of Billable Items wave)  —  2026-07-21
- **What changed:** new sidebar item **Procedures** (Inventory & Suppliers
  group) with two views: `ProceduresView` (recipe cards: component counts by
  type, rules badge, trigger service, est. total, activate/deactivate,
  "Start from Spay example" seeding) and `ProcedureEditorPage` — 5 tabs
  matching the design mockups (Details w/ trigger-service picker · Components
  w/ type-filtered rows, service/inventory/fee pickers, qty basis
  fixed/per-kg/manual, billable / deducts-stock / recommended toggles, stage
  assignment · Rules & Pricing w/ condition+effect editor and an
  example-patient quote tester hitting `/preview` · Protocol Workflow w/ stage
  editor + vertical checklist preview · Summary) plus a sticky Cost & Price
  rail. New `procedureTemplatesAPI` module wraps `/procedure-templates`.
- **Record impact:** 🟢 None — recipes only affect visits when applied.
- **Data dependency:** Requires backend migration 084 (deployed 2026-07-21).
- **Rollback:** revert commit; templates already created remain in the DB.

### component: inventory product image + manufacturer, batch backtrace on usage lines  —  2026-07-21
- **What changed:** Add/Edit inventory item gains a product image upload
  (R2 presigned PUT via `uploadsAPI`, ≤2MB, thumbnail + remove) and a
  Manufacturer field; stock cards show the thumbnail + manufacturer.
  Everywhere a product usage renders — ConsumablePicker lines (surgery/
  inpatient/boarding/grooming/visit service cards) and the visit Medications
  tab — the line now shows an amber **Batch NNN** chip plus supplier and
  manufacturer, so any administered item backtraces batch → supplier →
  manufacturer.
- **Record impact:** 🟢 None.
- **Data dependency:** Requires backend migration 084 (`manufacturer`/
  `image_url` columns + enriched consumables list payload). Graceful fallback
  — fields render blank until the backend ships.
- **Rollback:** revert commit.

### flow: landing page no longer bounces to /login on stale tokens  —  2026-07-20
- **What changed:** visiting `/` with expired tokens left over from an old
  session no longer redirects to `/login` after ~1.5s. The 401 interceptor's
  public-path list now includes `/` (the marketing landing page), so a failed
  background session-restore just clears the dead token and stays on landing.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: lab/imaging lock chip moves into the banner  —  2026-07-19
- **What changed:** the "🔒 Bill settled — locked" chip on Lab and Imaging
  record pages moves from the Markers/Images section header into the top
  banner next to the status chip (matching the boarding/inpatient/surgery
  banners), with the "💰 Billed — awaiting payment" variant when finalized
  but unpaid.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: inpatient/boarding/surgery pages match Lab chrome  —  2026-07-19
- (follow-up) On mobile the banner chips (Checked out / Discharged /
  Billed / Bill settled) wrap BELOW the patient info inside the same card
  instead of squeezing the name column; desktop keeps them top-right.
- **What changed:** the Inpatient chart, Boarding stay and Surgery record
  pages swap the boxy square back button for the Lab/Imaging-style minimal
  back link ("← Inpatient" etc.), and their banners now show the linked
  visit's billing state — "💰 Billed — awaiting payment" once finalized,
  "🔒 Bill settled — locked" once paid — like the Lab page's lock chip.
- **Record impact:** 🟢 None.
- **Data dependency:** None (billing.status already in payloads).
- **Rollback:** revert commit.

### component: wizard footer floats at screen bottom on mobile  —  2026-07-19
- **What changed:** the clinical wizard's footer nav (back step · Reset draft ·
  Complete & next / Complete workflow) floats FIXED at the viewport bottom on
  every screen size. Sticky was inert on desktop (ancestor overflow), so the
  bar is pinned with measured left/width matching the wizard card's column
  (ResizeObserver keeps it aligned on sidebar collapse/resize); mobile spans
  edge-to-edge. A spacer keeps the last step content clear.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### fix: service-card ⋯ menu clipped + bottom Add-service removed  —  2026-07-19
- **What changed:** the service card's ⋯ options menu now renders through a
  portal (fixed-position, anchored to the button) — the Services container's
  overflow-hidden was clipping "Delete service". The dashed bottom "Add
  service" row is removed (the header Add Service button remains).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: vaccination page shows package origin per record  —  2026-07-19
- **What changed:** package-expanded vaccination records (backend change of
  same date) show "📦 <package> package" on the record card, a 📦 marker on
  the sibling tab, and "Part of the <package> package" on the certificate.
- **Record impact:** 🟢 None.
- **Data dependency:** Backend migration 082.
- **Rollback:** revert commit.

### component: register-visit vaccine chips slimmed  —  2026-07-19
- **What changed:** vaccine + package choice chips on Register Visit are
  smaller (px-2.5/py-1.5, text-[10px], gap-1.5, thin border) so they pack
  several per row instead of sprawling one-to-a-line. Packages and single
  vaccines now share ONE wrap flow — 📦 package chips lead, 💉 vaccines
  continue in the same rows (package chip compacted to a single line).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### feature: diagnostics-only visit workflow, portal Reminders/Appointments/Visits + Invoices/Receipts  —  2026-07-19
- **What changed:** (1) Visits auto-created by "New lab/imaging" (all tasks in
  Laboratory/Imaging) skip the clinical wizard — tabs are just Categories &
  Services + Records & Billing, with a "🔬 Diagnostics visit" chip that turns
  "📥 External diagnostics" when any linked record is external. (2) Portal
  page renamed "Appointments & Visits" with THREE tabs — Reminders (from the
  clinic, per pet) · Appointments (the only thing a client creates; requests
  awaiting clinic confirmation) · Visits (clinic-run) — booking lands on the
  Appointments tab. (3) Portal Invoices page gains Invoices | Receipts tabs:
  finalized unpaid visits show payable "Due now", not-started/in-progress
  visits show an "Awaiting charges" chip, paid ones move to Receipts.
- **Record impact:** 🟢 None.
- **Data dependency:** Backend getMyInvoices change of the same date.
- **Rollback:** revert commit.

### fix: returning users bounced to /login (broken token refresh)  —  2026-07-19
- **What changed:** two stacked bugs made every return visit after access-token
  expiry land on /login: `authAPI.refreshToken()` sent NO body while the
  backend requires `{ refreshToken }` (refresh always 400'd), and nothing
  attempted a refresh on 401 anyway — the interceptor cleared the session and
  hard-redirected immediately. Now: the refresh call sends the stored refresh
  token, and the response interceptor does a SINGLE-FLIGHT refresh + one retry
  of the failed request before ever treating the session as expired. A failing
  refresh call itself never toasts/redirects (its awaiting callers handle it).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### fix: WhatsApp link preview image  —  2026-07-19
- **What changed:** `og-image` recompressed 309KB PNG → 95KB JPEG
  (`og-image.jpg?v=3`) — WhatsApp silently drops preview images over ~300KB.
  All og:/twitter: image tags updated. NOTE: WhatsApp caches previews per URL
  on its servers; test with a query-string variant (e.g. `/?wa=1`) or wait for
  their cache to expire.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: service card mobile reflow  —  2026-07-19
- **What changed:** service cards on visits: the service name now owns line 1
  (checkbox + full-width name); the assignee select + amount move to line 2 —
  no more squeezing on mobile. The Images chip moved into the ⋯ options menu
  (with its count badge; Share/Delete stay below it, hidden once the visit
  completes while Images stays viewable). Card + container x-padding trimmed
  slightly on mobile.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: Grooming + Boarding clinic specialties for partner service scoping  —  2026-07-19
- **What changed:** `CLINIC_SPECIALTIES` gains **Grooming** and **Boarding**
  (In-patient already existed) — named exactly like the service categories so
  negotiated handshake prices match `task.category` on outsourcing. Flows
  automatically to: Clinic Management → Clinical Specialties chips (clinics
  declare them), Create Partnership filter + service permissions, the
  partnership edit modal, handshake Services/negotiated pricing (OPEN access
  includes them), and the per-service "Share to partner" matching.
- **Record impact:** 🟢 None — `clinics.specialties` is a free string array;
  backend already passes any values through.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: partners mobile UI, no duplicate pairings, mobile escalation menu  —  2026-07-19
- **What changed:** (1) Handshake detail "Partnership Flow" stacks vertically
  on mobile (arrow rotates down) so requester/receiver names no longer truncate
  to one letter; details heading scaled down. (2) Create Partnership: a clinic
  you already have a PENDING/ACCEPTED handshake with (either direction) shows
  a "Partnered/Pending · view" badge and selecting it OPENS the existing
  partnership instead of creating a duplicate. (3) Visit wizard on mobile:
  "🏥 Hospitalize / In-Patient" + "Escalate to Emergency" collapse into a
  dropdown behind a red Siren icon button (desktop keeps full buttons).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### feature: live notifications over SSE (clinic app + portal)  —  2026-07-18
- **What changed:** new `services/eventStream.ts` opens an EventSource to the
  backend's SSE stream (`/stream` for staff via DataContext, `/portal/me/stream`
  for the portal via ClientPortalContext). Staff: instant toasts for new portal
  messages + booking requests; events re-broadcast as `vethub:stream` window
  CustomEvents — the client chat thread refreshes live (poll kept as fallback)
  and the Appointments page refetches on new requests. Portal: new-message
  toast + thread refresh, and booking status changes (confirmed/rescheduled/
  cancelled) update the Visits list instantly.
- **Record impact:** 🟢 None.
- **Data dependency:** Backend SSE endpoints of the same date.
- **Rollback:** revert commit (polling still works).

### component: service card — ⋯ options menu, price top-right, abbreviated assignee; emergency header → triage  —  2026-07-18
- **What changed:** On visit service cards: Share-to-partner + Delete moved
  into a "⋯" options menu that sits as the LAST item on the Items/Notes/Images
  row; the price is now the card's top-right anchor; the assigned-staff select
  shows the surname with abbreviated other names ("J.K. Mwaura") when
  collapsed so it no longer collides with the price on mobile. The EMERGENCY
  services category header now jumps to the Emergency Triage tab
  ("Open triage") like module categories open their pages.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert commit.

### component: vaccination page — stock search, sibling tabs; emergency triage gate; struck-through discounts  —  2026-07-18
- **What changed:** (1) Vaccination record page: each record's editor gains a
  "Vaccine stock" search over the clinic inventory — picking an item deducts
  one dose (`POST /vaccinations/:id/apply-stock`) and fills the batch number;
  once deducted it shows a green "dose deducted · batch" chip. With 2+ vaccines
  on the visit (e.g. a package) a tab strip switches between them (lab-page
  pattern). (2) Emergency visits: "🚨 Emergency Triage" is the FIRST workflow
  tab (and the landing tab); the Clinical Workflow is blurred behind an
  overlay ("Go to Emergency Triage") until the patient is stabilized —
  stabilized state rehydrates on reopen. (3) Billing: when a discount applies,
  the discounted amount leads and the original total shows struck through
  (invoice tab + settle modal).
- **Record impact:** 🟢 None.
- **Data dependency:** Backend migration 081 (auto via db push).
- **Rollback:** revert commit.

### portal: booking requests shown as "awaiting clinic confirmation"  —  2026-07-18
- **What changed:** portal "Book a visit" now files an appointment REQUEST the
  clinic confirms (backend change). The Visits list renders pending requests
  (REQUESTED/CONFIRMED/RESCHEDULED tones) as non-clickable rows with an
  "Awaiting clinic confirmation" hint; the dashboard next-visit card routes
  booking rows to the Visits list instead of a (nonexistent) visit detail.
- **Record impact:** 🟢 None.
- **Data dependency:** Backend commit of the same date.
- **Rollback:** revert commit.

### component: admin Top Clinics ranking → clinic detail  —  2026-07-18
- **What changed:** clinic names in the admin "Top clinics · by clients"
  ranking are clickable — straight into the AdminClinicDetailPage
  (Overview/Users/Branches/Partners), same as the clinic cards below.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Appointments — Today chip + converted sink below  —  2026-07-18
- **What changed:** one-tap "Today" filter chip beside the date-range picker
  (tap again to clear), and the list now sorts actionable bookings
  (Requested/Confirmed/Rescheduled) first, CONVERTED below them, and
  Cancelled/No-show last — soonest scheduled first within each band.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### fix: date consistency across dashboard/appointments/reminders  —  2026-07-18
- **What changed:** (1) ClinicStatistics had its own `toISOString` range
  helper — the actual source of the 2-appts/2-reminders/3-visits phantom
  counts (range silently widened one day into the past); now `localYMD`.
  Same fix applied to Appointment-create default date/Now button, Pharmacy
  log range defaults, and FinalizeReminderGate. (2) Appointments (bookings)
  page gains a DATE-RANGE filter on scheduled date — so its list can be
  compared against the dashboard windows. (3) Booking from a reminder whose
  due date is date-only (00:00 UTC) now defaults to 09:00 local instead of
  the 03:00 EAT artifact.
- **Record impact:** 🟢 None — display/derivation only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: Imaging mirrors the lab treatment + incoming shared work + dashboard count fix  —  2026-07-18
- **What changed:** (1) Imaging new-study form gets the page treatment
  (sky/cyan hero) + the EXTERNAL direction toggle (send-out = IN_PROGRESS,
  partner completes the shared study; results-received as before) + awaiting/
  done badges. (2) Lab + Imaging lists label records shared TO this clinic
  with a violet "📥 From {clinic}" badge — the receiving clinic works them in
  its own flow; Lab gains an "📥 Incoming" filter chip. (3) Dashboard
  statistics date range now uses LOCAL calendar dates (new `localYMD`) —
  toISOString shifted "Jul 18" to "Jul 17" (UTC), pulling in yesterday's
  snapshot and showing 3 visits where the list correctly showed 1.
- **Record impact:** 🟢 None.
- **Data dependency:** backend clinicName + imaging status (same deploy).
- **Rollback:** revert the commit and rebuild.

### page: New Lab record — page treatment + send-out vs received  —  2026-07-18
- **What changed:** the New-lab form gets the gate-page treatment (back link
  + emerald/teal hero mirroring the lab record page, card sections). EXTERNAL
  source gains a DIRECTION toggle: "📤 Sending out" (record starts ORDERED,
  shared with the picked partner clinic who fills the results into the same
  record — hint explains results appear in place; button says "Send to
  partner") vs "📥 Results received" (RESULTED at save, as before). List
  badges now distinguish: Internal · amber "Sent to X · awaiting" · indigo
  "External · X ✓" once results land.
- **Record impact:** 🟢 None — status was already supported server-side.
- **Data dependency:** None (partner share via existing recordSharingAPI).
- **Rollback:** revert the commit and rebuild.

### page: Inpatient admission → full in-app page (gate parity)  —  2026-07-18
- **What changed:** `AdmitInpatientModal` converted from a full-screen
  takeover into an in-theme, in-flow PAGE like the boarding/grooming gates:
  back link, red/rose gradient hero, white card sections on `.field-*`
  classes. Callers (InpatientView, VisitDetailView 🏥 escalation) render it
  in place via early return. Gate parity added: owner "(J.K. Surname)" on the
  patient chip, weight copy (<3 months, labelled), and the vaccine
  recommend-and-transfer escape with journey attribution + Vaccination tasks
  on client agreement.
- **Record impact:** 🟢 None — same admit call; extra tasks/events only on
  newly created admissions when staff use the recommend flow.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: green "P" avatar badge for active portal clients  —  2026-07-18
- **What changed:** clients with an ACTIVE portal account (logged in within
  30 days) show a small green "P" badge overlaying their avatar — on the
  Clients list rows and the client profile header.
- **Record impact:** 🟢 None.
- **Data dependency:** portalStatus on client payloads (already live).
- **Rollback:** revert the commit and rebuild.

### component: Broadcasts — portal-account audience options  —  2026-07-18
- **What changed:** audience picker gains "💻 With portal account" and
  "⚡ Active portal users (30 days)" — the live recipient count previews the
  narrowed audience before sending; opt-outs/unsubscribes stay excluded as
  always.
- **Record impact:** 🟢 None.
- **Data dependency:** backend portal audience (same deploy).
- **Rollback:** revert the commit and rebuild.

### component: stacked Risk & Credit filters (Clients) + stacked A–Z (Patients)  —  2026-07-18
- **What changed:** new stacked-card filter pattern (`stacked-filter-primary`/
  `stacked-filter-panel` in index.css): the primary filter bar lifts ~10px and
  the less-used filters slide out from UNDERNEATH it. Clients list gains a
  "Risk & credit filters" panel — With-outstanding-balance toggle, min
  amount-spent input, client-type chips (💀→👑) + Clear; filtering is local
  over the loaded list using the new `outstandingBalance` field (mapper
  updated). Patients list moves its A–Z alphabet row into the same stacked
  "More filters" panel.
- **Record impact:** 🟢 None.
- **Data dependency:** backend outstandingBalance on client list (same
  deploy); degrades to 0 (filter just matches nothing) before it.
- **Rollback:** revert the commit and rebuild.

### flow: Register Visit — vaccine chips + layout polish  —  2026-07-18
- **What changed:** (1) Vaccination visits stage vaccines via BIG toggle
  chips (name + price, ✓ when staged) instead of the "+ ADD SERVICE" dropdown;
  active vaccine PACKAGES appear as violet chips showing the item count and
  package price — one tap stages the package as a single line. (2) Encounter
  type buttons are ~50% wider (min-w 9rem, centered). (3) The auto timing
  pill sits far right and reads slightly faded (info, not input).
- **Record impact:** 🟢 None.
- **Data dependency:** None (packages via existing vaccine-packages API).
- **Rollback:** revert the commit and rebuild.

### flow: Register Visit refinements  —  2026-07-18
- **What changed:** (1) Visit-type picker trimmed to Vaccination /
  Consultation / Emergency / Follow-up (Routine Consultation + Routine Check
  commented out of VISIT_TYPES — enum values stay valid for legacy rows).
  (2) The "Working hours / After-hours · auto" timing chip is a status pill,
  no longer clickable — it's auto-detected from clinic hours. (3) Follow-up
  REQUIRES pairing with the older visit ("Follow-up to which visit?") —
  booking blocks with a toast otherwise. (4) "Book & Start Visit"/"Book only"
  collapsed into ONE button driven by a "Start visit immediately" switch,
  remembered per browser (localStorage vethub.bookStartNow.v1, default on).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: pet transfer (portal + staff) & reminders/appts type tabs  —  2026-07-18
- **What changed:** (1) Portal pet profile: "Transfer clinic" hero action →
  ClinicFinder modal + note; pending state shows a chip + a card with Cancel;
  copy explains records stay until the old clinic approves sharing. (2) Staff
  Partners page: new "Patient transfers" panel — accept/decline incoming
  transfers, request records after accepting, and approve/decline record
  requests when you're the origin clinic. (3) Reminders & Appts tab (pet +
  client profiles): every card now carries a Reminder/Appt type chip and a
  second tab group filters Both / Reminders / Appointments.
- **Record impact:** 🔵 Low — accepting a transfer moves the patient to your
  clinic (by design).
- **Data dependency:** backend migration 080 + /pet-transfers routes (same
  deploy).
- **Rollback:** revert the commit and rebuild.

### page: admin All Protection  —  2026-07-18
- **What changed:** new admin sidebar item + page: summary tiles (owners with
  debt, total outstanding, debt-jumpers, multi-clinic owners), filters ("with
  outstanding balance", "debt-jumpers only"), and one expandable row per owner
  identity showing each clinic's outstanding, spend, last visit, client type
  and risk score. Debt-jumpers highlighted.
- **Record impact:** 🟢 None.
- **Data dependency:** backend GET /admin/protection (same deploy).
- **Rollback:** revert the commit and rebuild.

### page: Partner Tiers — tiered-partners table  —  2026-07-18
- **What changed:** below "Assign a tier": a table of every partner carrying
  a tier (name, type, tier chip in its color, rank, active status) with a
  per-row "Remove tier" action. Refreshes together with the tier counts.
- **Record impact:** 🟢 None (remove = the existing assign-null call).
- **Data dependency:** backend /admin/partner-types/assignments (same deploy).
- **Rollback:** revert the commit and rebuild.

### flow: admission-gate upgrades (weight copy + vaccine recommendation)  —  2026-07-18
- **What changed:** grooming + boarding gates: (1) intake weight prefills
  from the pet record when it's <3 months old, labelled "copied from record —
  confirm on the scale". (2) When the vaccination check is unknown/none the
  gate no longer hard-blocks: staff pick RECOMMENDED vaccines (shared
  `GateVaccineRecommend`); with "Client agreed — transfer to vet visit for
  vaccination" the selected vaccines join the visit as Vaccination tasks
  (grooming: in the create payload; boarding: addTask on the stay's visit).
  Either way a journey event logs the gate + vaccines + decision — the server
  stamps the recommending user (later stats). (3) Nested cards slimmed on
  mobile (GroomingPanel sections + record page frame).
- **Record impact:** 🟢 None — new tasks/events only on newly created visits.
- **Data dependency:** backend pet.updatedAt (same deploy) for the copy rule;
  degrades to no-prefill without it.
- **Rollback:** revert the commit and rebuild.

### component: client profile portal chip (Active / Dormant + Wake)  —  2026-07-18
- **What changed:** the "Invite to portal" button moved OUT of the name row
  into a status row below it. It's now state-aware: no account → Invite to
  portal; account + recent login → green "Portal · Active" chip; dormant →
  amber chip + "Wake client" (sends the backend nudge email). DataContext
  mapper copies `portalStatus`/`portalLastLoginAt` (mapper footgun).
- **Record impact:** 🟢 None.
- **Data dependency:** backend portalStatus + /clients/:id/wake (same deploy).
- **Rollback:** revert the commit and rebuild.

### component: UX fix batch (mobile + navigation)  —  2026-07-18
- **What changed:** (1) Portal request-appointment modal: body scrolls within
  88dvh so the submit button is always reachable on phones. (2) Client-profile
  patient cards: age/weight no longer double their units ("3 months yrs" →
  "3 months"), Sex row added. (3) Floating Ask-AI button commented out (was
  overlapping content everywhere). (4) Surgery list search+status stack
  one-per-row on mobile. (5) Grooming/Boarding admission: selected patient
  chip shows the owner as "(J.K. Lusisa)" to confirm the right client.
  (6) Landing: partner cards drop the tier badge (tier = ranking only) and
  the testimonials headline/quotes now span clinics, suppliers, pet owners
  and freelancers. (7) Emergency board cards open the visit directly on its
  TRIAGE tab (new `openTriage` nav param → `autoOpenTriage` prop).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: group Settle-all gets the real settle experience  —  2026-07-18
- **What changed:** the group "Settle all" modal's bare 4-button method grid
  is replaced with the single-bill settle UX: a "Settle into" wallet picker
  (clinic wallets w/ balances + Main badge, Cash off-wallet option; wallet
  type derives the payment method) and a Confirm-payment button showing the
  combined total. Sends `walletId` to settle-group so money routes into the
  chosen wallet. (Discounts stay per-bill on the individual settle modal.)
- **Record impact:** 🟢 None.
- **Data dependency:** backend settle-group walletId (same deploy).
- **Rollback:** revert the commit and rebuild.

### component: per-service consumables picker inlines into the Items panel  —  2026-07-18
- **What changed:** "Add item from inventory" on a visit service card no
  longer opens a centered modal — the ConsumablePicker (search, qty/billable,
  packages, logged lines) expands INLINE inside the Items section and the
  button toggles to "Done adding items". The section's plain item rows hide
  while the picker is open (it lists the same lines with richer controls).
- **Record impact:** 🟢 None — same dispense/billing flow, different container.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: C-paw loader on remaining module pages  —  2026-07-17
- **What changed:** the branded C-paw `LoadingSpinner` replaces generic
  Loader2/RefreshCw spinners on the page-level loading states of Emergency,
  Inpatient, Boarding, Surgery, Laboratory, Imaging, Vaccine Packages,
  Service Bundles, Pharmacy (dispensing log) and Billing — matching the
  already-migrated Patients/Clients/Inventory/Finance/Transactions pages.
  (ClinicWallet keeps its shaped pulse-skeleton; views with no fetch of
  their own — Grooming, Petshop, Partners, Staff, B2B — have no loader.)
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Reminder cards — bottom-aligned actions + overflow menu  —  2026-07-17
- **What changed:** reminder cards are flex columns with the action row pinned
  to the bottom (`mt-auto`) so Book buttons align across a grid row; the
  mark-done ✓ and dismiss ✕ icon buttons moved into a ⋯ dropdown (opens
  upward, click-away closes). Phone/contacted toggle stays inline.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Reminders — no booking actions on handled cards  —  2026-07-17
- **What changed:** "Create appointment" and "Attach existing" links now show
  only on PENDING reminders — dismissed/completed cards keep just their
  history links (Originating visit / Visit from reminder).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Reminders list — uncompleted always on top  —  2026-07-17
- **What changed:** RemindersView sorts client-side too: PENDING reminders
  first ordered by nearest due date (today up top), handled ones after in
  the same date order — regardless of scope tab or search.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Add-pet breed dropdown + pet-hero mobile fit  —  2026-07-16
- **What changed:** (1) Add-pet "Breed" is now a dropdown fed by the public
  global breed catalog (`GET /breeds`, filtered by the chosen species), with
  an "Other…" escape to free text; species without catalog breeds keep the
  text input. (2) Pet-profile hero: meta text gets an 11rem minimum so the
  badge/certificate actions wrap to their own row on phones instead of
  crushing the text to a word per line.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: portal settings clinic-logo fallback  —  2026-07-16
- **What changed:** the My-clinics tile put whatever `clinic.logo` holds into
  an `<img src>` — ShiVets' logo is the emoji 🐱, so it rendered a broken
  image with alt text bleeding out. New `ClinicLogo`: emoji strings render as
  text, URLs get an onError fallback, everything else falls back to the icon.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: portal mobile hero fix + topnav wordmark  —  2026-07-16
- **What changed:** hero quick actions were showing BOTH variants on mobile
  (Tailwind `hidden` lost to `.cp-btn`'s own display on specificity) and
  crushed the greeting — visibility now lives on wrapper divs, so mobile gets
  only the two compact round icon buttons top-right and the greeting keeps the
  card. Topnav "Pet Portal" tag removed — wordmark is just VetHubCore.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: two-way platform messaging + portal branding/mobile fixes  —  2026-07-16
- **What changed:** (1) Client profile "Messaging" tab is now a LIVE two-way
  chat with the pet owner (`ClientPlatformThread`): owner bubbles left, clinic
  replies right (sender name shown), 20s poll, auto marks owner messages read;
  replies land in the owner's portal Messages chat. Replaces the local-only
  `store.messages` list that never saw portal messages. Broadcast button kept.
  (2) Portal topnav brand = "VetHubCore" + the C-paw `BrandMark` on the coral
  tile. (3) Mobile hero fit: Book-a-visit / Message-clinic collapse to compact
  round icon buttons at the top of the hero on small screens. (4) Pets page
  header shows ONE action — Add clinic before a clinic is connected, Add pet
  after (more clinics via Settings → Advanced).
- **Record impact:** 🟢 None.
- **Data dependency:** backend `/api/v1/messages` routes (same deploy).
- **Rollback:** revert the commit and rebuild.

### flow: portal "Add pet"  —  2026-07-16
- **What changed:** pet owners can register a pet from the portal Pets page
  (header button + empty-state CTA + dashboard card): name/species/breed/sex/
  dob/weight, clinic picker only when connected to >1 clinic. The pet lands
  as a patient at that clinic; the list updates from the POST response
  (no refetch).
- **Record impact:** 🟢 None — creates a new pet row.
- **Data dependency:** backend `POST /portal/me/pets`.
- **Rollback:** revert the commit and rebuild.

### page: client-portal upgrade wave (dashboard · pet profile · visit detail · chat · settings · memories)  —  2026-07-16
- **What changed:** (1) Home = hero banner w/ pet avatar strip + quick actions,
  care-reminders card, unpaid-invoice callout, pets overview, "ask your clinic
  to add your pets" empty state. (2) NEW pet profile PAGE `/client/pets/:petId`
  (replaces the records modal): pill tabs Overview (health timeline) /
  Vaccinations (due badges + printable certificate) / Medical / Surgeries /
  Grooming & Boarding / Memories (photo+video gallery w/ upload, 30-cap).
  (3) NEW visit detail `/client/appointments/:id`: services+bill, journey
  timeline from visit_events, owner cancel + reschedule request. (4) Visits
  page gained a Reminders tab (due/handled, "Booked →" converted-visit link).
  (5) Messages = chat threads per clinic, day separators, sticky composer,
  auto mark-read. (6) NEW settings `/client/settings` via topnav avatar;
  change/add clinic AND sign-out live behind an "Advanced" disclosure
  (topnav sign-out button removed by design).
- **Record impact:** 🟢 None — UI; cancel/reschedule/memories write via new
  owner-scoped portal endpoints.
- **Data dependency:** backend commit 97cc70e (portal expansion + migration
  079). Memories upload stays dark until R2 STORAGE_* is configured.
- **Rollback:** revert the commit and rebuild.

### page: client-portal chrome upgrade (topnav + nav rail)  —  2026-07-16
- **What changed:** (1) Pet-portal topnav upgraded from a flat white bar to a
  pine gradient with coral glow — gradient logo mark, "Pet Portal" wordmark
  tag, coral avatar chip, frosted sign-out button. (2) Desktop sidebar became
  an elevated card rail: icon tiles (seafoam→coral on hover), coral gradient
  active pill, inverted badges, plus a "Time for a check-up?" promo card
  linking to the Visits booking flow. (3) Mobile bottom tabs get a coral
  active indicator bar. All via new `cp-topnav`/`cp-rail`/`cp-rail-promo`/
  `cp-tab` classes scoped under `.client-portal`. (4) Landing "Works
  everywhere" tablet screenshot refreshed to the current Register Visit page.
- **Record impact:** 🟢 None — styling/markup only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: admin clinic detail as a page + supplier drill-down links  —  2026-07-16
- **What changed:** (1) new `AdminClinicDetailPage` (nav `admin-clinic-detail`,
  param `clinicId`) replaces the tabbed clinic detail MODAL on the admin
  Clinics page — pine hero banner, Overview/Users/Branches/Partners tabs,
  side-rail Edit + Activate/Deactivate (with branch-scope choice). Clinic
  name-click navigates there; the modal remains only as a fallback for
  call-sites without `onNavigate`. (2) Supplier Super View "Top Suppliers"
  names now open the existing `supplier-detail` PAGE (new `onOpenSupplier`
  prop wired in App).
- **Record impact:** 🟢 None — read-only views; status toggle unchanged
  (same `PATCH /clinics/:id/status`).
- **Data dependency:** None (uses existing `GET /clinics/:id` +
  `/clinics/:id/admin-details`).
- **Rollback:** revert the commit and rebuild.

### page: Boarding + Grooming admit gates → full in-app pages  —  2026-07-16
- **What changed:** `AdmitBoardingModal` and `GroomingAdmitModal` converted
  from full-screen takeovers into in-theme, in-flow PAGES (sidebar +
  breadcrumb stay visible): back link, gradient hero banner (amber/orange for
  boarding, fuchsia/pink for grooming — matching their record pages), white
  card sections, and all inputs on the standard `.field-*` classes. Callers
  (`BoardingView`, `GroomingView`, `VisitDetailView` "Onboard to Boarding")
  now render them in place of their content while open. Same props + logic.
- **Record impact:** 🟢 None — restyle/relayout only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### component: Visits list filter bar wraps on tablet  —  2026-07-16
- **What changed:** the Visits list toolbar's second row (date range · status ·
  List/Calendar · New Visit · refresh) now wraps (`sm:flex-wrap`) instead of
  overflowing off-screen at tablet widths.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### config: landing device screenshots refreshed  —  2026-07-16
- **What changed:** `assets/device-desktop.png` (Register Visit on MacBook) and
  `assets/device-mobile.png` (Register Visit on iPhone) replaced with current
  product shots; new `assets/device-desktop-grooming.png` added (unused yet).
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: admin Clinics — branches on cards + tabbed drill-down  —  2026-07-16
- **What changed:** admin Clinics page: (1) cards of clinics WITH branches
  show a "Branches" chip row (first 3 names + "+N more"). (2) The clinic
  detail modal (click a clinic name) is wider and TABBED: Overview (existing
  facts) + Users / Branches / Partners tables (counts in the tab labels) —
  users with role/status/joined, branches with city/subdomain/status,
  partnerships with direction/services/status. Data from the new
  `GET /clinics/:id/admin-details` (SUPER_ADMIN/MERCHANT_ADMIN).
- **Record impact:** 🟢 None — read-only.
- **Data dependency:** backend admin-details endpoint (same day).
- **Rollback:** revert the commit and rebuild.

### page: testimonials become a gallery carousel  —  2026-07-16
- **What changed:** the landing "Quiet confidence" quotes are a centre-mode
  carousel: active card centred, previous/next cards peeking at the edges
  (real cards faded/scaled — no skeleton scaffolding), auto-advance every 7s,
  pause on hover, dots + clicking a peeked card navigate. Also fixed the
  literal "&mdash;" rendering in the multi-site quote (real em dash).
  EXPANDED to 8 quotes and a SEAMLESS endless loop: three copies on the
  track, invisible snap-back after passing a set's edge — no empty edges at
  the ends, auto-scrolls and repeats forever.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: landing partner cards — real clinic logos + brand-colour gradients  —  2026-07-16
- **What changed:** the "Trusted clinics on VetHubCore" cards now render the
  clinic's REAL logo (uploaded logos are data: URLs — the old check only
  accepted http, so everyone got the paw placeholder) and each card carries a
  soft gradient of the clinic's own primary→secondary colours (border tinted
  to match; logo tile is a solid gradient of the same pair). Emoji-logo
  clinics keep the emoji on their branded tile.
- **Record impact:** 🟢 None.
- **Data dependency:** backend featured-clinics payload must carry
  primaryColor/secondaryColor (same day) — falls back to VetHub pine/spruce.
- **Rollback:** revert the commit and rebuild.

### flow: add category services from the grooming + surgery pages  —  2026-07-16
- **What changed:** new shared `AddCategoryService` picker (same pattern as
  the boarding page's grooming picker): the grooming report card gets
  "＋ Add grooming service" (side rail) and the surgery record page gets
  "＋ Add procedure" (under the tabs). Picks from the catalog's category
  services (price shown, one-instance-per-service guard with green "Added"
  tags, + Custom fallback), adds the task to the linked visit's bill — the
  category trigger auto-creates the module record, so the new service/
  procedure appears on the page (new surgery tab) immediately. Hidden once
  the visit is locked/billed.
- **Record impact:** 🔵 Low — adds service tasks to the open visit (user
  action).
- **Data dependency:** None (task-add trigger already creates records).
- **Rollback:** revert the commit and rebuild.

### flow: Back works from record pages (transient forwards replace, not push)  —  2026-07-15
- **What changed:** Back looked dead on surgery-record / boarding-stay /
  inpatient-chart when reached from a visit: the module LIST page pushed onto
  the stack, auto-forwarded to the record, and pressing Back remounted the
  list whose deep-link ref had reset — instantly re-forwarding to the record.
  `navigateTo` now takes a `replace` option (with history.replaceState) and
  every transient auto-forward (surgery/boarding/inpatient deep-links +
  legacy openStayId/openHospId forwards) REPLACES the list hop — Back returns
  to where the user actually came from (the visit). Direct list navigation
  from the sidebar still pushes normally.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: surgery status persists on click + progress strip on the visit  —  2026-07-15
- **What changed:** (1) SurgeryRecordPage status buttons now SAVE immediately
  (with the auto-stamped started/ended times) — a status was local-only until
  "Save record", so switching sibling tabs refetched and silently reverted
  Completed back to In progress. (2) The clinical workflow shows a slim
  "🔪 Surgery" progress row INSIDE the wizard, right under the step strip —
  one chip per procedure with its live status (pending / in progress /
  completed), clicking opens the Surgery page for the visit. No more
  navigating away just to check how the procedures are going.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: Journey events navigate + closed-triage ABCDE browsable  —  2026-07-14
- **What changed:** (1) events in the 🧭 Journey drawer are now clickable —
  each jumps to where it happened: step milestones open that wizard step,
  billing/payment events open Records & Billing, triage/emergency events open
  the Triage tab (live or closed), service/encounter changes open Categories
  & Services; default = clinical workflow. (2) The read-only closed triage is
  now BROWSABLE: the ABCDE primary-survey circles and the prev/next section
  buttons stay clickable (pure view navigation) inside the otherwise inert
  panel.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: grooming-only visits stay grooming-only + encounter chips deletable  —  2026-07-14
- **What changed:** (1) the "Vet Visit — clinical" workflow chip is no longer
  offered unconditionally: it appears only when the visit HAS clinical
  content (VET_VISIT encounter or non-module service categories) — a
  grooming-only visit runs the grooming flow alone (its vet-check step
  covers the clinical basics); a STALE workflow override to a no-longer-
  offered flow now falls back to the visit's real flow (fixes grooming
  visits stuck on "Standard Consultation"). (2) Non-primary encounter chips
  get a ✕: removing an encounter shows a CONFIRMATION box listing the
  services/charges it will delete, then deletes those tasks off the bill
  (linked module records cascade), logs a journey event. Primary encounter
  not removable; boarding with a live stay must go via the stay; hidden once
  finalized/paid.
- **Record impact:** 🔵 Low — encounter removal deletes that encounter's
  service tasks (user-confirmed, pre-finalize only).
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: Imaging record page tabbed + completed locks to view-only  —  2026-07-14
- **What changed:** ImagingRecordPage now mirrors the lab page: (1) every
  imaging study on the SAME visit renders as a TAB (modality · body part +
  status chip; internal currentId, prop record stays fallback). (2) A
  COMPLETED study locks to view-only — upload/remove/date/save and per-image +
  findings inputs disable — with an "✏️ Edit study" reopen (→ In progress +
  journey event on the visit), mirroring the lab "Edit result". Once the
  visit is BILLED the record freezes for good (existing bill-lock; reopen
  hidden).
- **Record impact:** 🟢 None.
- **Data dependency:** None (imagingAPI.list already filters by
  appointmentId).
- **Rollback:** revert the commit and rebuild.

### flow: stabilized emergency keeps triage viewable (closed)  —  2026-07-14
- **What changed:** a visit that started as EMERGENCY and was stabilized
  ("discharge to vet visit" de-escalates it to CONSULTATION) no longer loses
  its Triage tab. When the de-escalated visit still has emergency traces
  (emergency-category service) and a kept triage record, a "🚨 Triage ·
  closed" tab renders the full triage panel READ-ONLY ("🔒 Closed — view
  only" badge, inputs inert) — the emergency's medical/legal history stays
  reviewable, but the closed triage can't be edited.
- **Record impact:** 🟢 None.
- **Data dependency:** None (triage records were already kept on discharge).
- **Rollback:** revert the commit and rebuild.

### flow: bill-lock now disables lab/imaging INPUTS too  —  2026-07-14
- **What changed:** follow-up to the bill-lock: on a billed visit the lab
  page's marker fields/flag select, add/remove marker, attachment upload +
  delete, and notes textarea now actually disable (first pass only hid the
  Save/Edit buttons — fields still accepted typing). Imaging page same:
  image upload dropzone, per-image remove/description/diagnosis, and the
  findings textarea disable. Viewing (attachments, image lightbox) untouched.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: billed visit locks lab/imaging record pages  —  2026-07-14
- **What changed:** LabRecordPage + ImagingRecordPage read the visit's
  billing state off the record payload (`appointment.status`/`isPaid`): once
  billed, the "Edit result" reopen, Save buttons, result/study date inputs
  and the status control disable, replaced by a "🔒 Bill settled — locked"
  chip — everything stays readable. Pairs with the backend
  `assertRecordEditable` guard (same day) covering grooming too.
- **Record impact:** 🟢 None.
- **Data dependency:** backend must ship first for the payload fields
  (page degrades gracefully — controls just stay enabled, server rejects).
- **Rollback:** revert the commit and rebuild.

### page: Surgery record is a full-page workflow  —  2026-07-13
- **What changed:** `SurgeryRecordPage` (`surgery-record` route) replaces the
  SurgeryView edit drawer. Two-column layout (clinical narrative + images and
  consumables left; status/timing/complexity/actions right). Multiple
  surgeries on the SAME visit render as TABS (status chip per tab, like the
  lab page). A COMPLETED record LOCKS — fields become read-only detail blocks
  (respecting the paragraph/bullets format), complexity/timing/status render
  as saved values, image add/remove and consumables hide — with a discreet
  "Reopen to edit" (→ IN_PROGRESS). Reopen is allowed only UNTIL the visit is
  finalized — once billed (PENDING_PAYMENT/COMPLETED or paid) the record is
  frozen for good ("Bill finalized — record locked"; server guard too).
  Surgery list rows and visit deep links (`openForAppointmentId`) forward to
  the page; `surgery-record` joins the open staff views.
- **Record impact:** 🟢 None — same endpoints as the drawer.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: guided finalize + staff-assignment persistence  —  2026-07-13
- **What changed:** (1) API client now invalidates cached GETs of a resource
  after any successful mutation on it (`client.ts`) — root cause of task
  staff assignments "removing themselves": the 30s client cache served the
  pre-mutation list on refetch and DataContext rebuilt the old value. (2) The
  Assign dropdown keeps the CURRENT assignee as an option even when the
  VET/STAFF/OWNER role filter excludes them (e.g. a manager) — previously the
  select silently fell back to "Assign…". (3) Finalize with unfinished
  services no longer errors: staff land on Categories & Services with the
  pending service cards highlighted amber (auto-scroll to the first, warning
  toast, highlight clears on completion or after 10s). All complete → the
  reminder gate opens as the create/adjust prompt.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: stay day-count = calendar dates + check-out shown on stay page  —  2026-07-13
- **What changed:** boarding/inpatient day math now counts CALENDAR DATES
  (EAT) between check-in and check-out — new `calendarDaysBetween` in
  `dateFormatter.ts`, mirroring the backend's `computeNights`. Applied to the
  "Day N" badges (BoardingView, InpatientView, BoardingStayPage), the accruing
  previews (BoardingStayPage, InpatientChartPage — labels now "N days"), and
  checked-out summaries now show the full range: stay facts grid gets
  Check-in + Check-out (replacing the moot "Expected pickup"), Status shows
  "Checked out · N days", and both checkout/discharge cards show
  "check-in → check-out · N days".
- **Record impact:** 🟢 None — display + preview math; billing is server-side.
- **Data dependency:** pairs with the backend `computeNights` calendar-date
  change (same day) — previews match bills only once both are deployed.
- **Rollback:** revert the commit and rebuild.

### flow: Finalize gate checks server task state first  —  2026-07-13
- **What changed:** "Finalize → enable billing" (and the grooming/summary
  finalize entry points) now verify EVERY task is COMPLETED on the SERVER
  before opening the reminder gate (`openFinalizeGate` in VisitDetailView,
  cache-bypassed getById). If something's still pending server-side (stale /
  optimistic local list), staff get one specific toast listing the pending
  services and the local task statuses resync — no more filling the reminder
  form into a 400. The finalize catch also stops double-toasting the raw
  "status code 400" (the API layer already shows the server message) and
  closes the gate on the pending-services 400.
- **Record impact:** 🟢 None.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: staff access audit — visit/client detail pages open, groups inherit gates  —  2026-07-12
- **What changed:** `canAccess` audit of every view id. (1) Per-visit /
  per-client detail pages are now OPEN staff views: `boarding-stay`,
  `inpatient-chart`, `vaccinations`, `edit-client`, `messaging` — visits are
  open to every staffer, so records of a visit they're working always open;
  "Restrict to assigned categories" gates only the module LIST pages (as its
  toggle text says). (2) Fall-through fixes: `vaccine-packages` joins the
  open inventory group; `staff-new`/`staff-edit` join the clinic-mgmt gate;
  `handshake-detail`/`create-partnership` inherit the referrals gate.
  Platform-admin and subscription views stay full-access-only.
- **Record impact:** 🟢 None — client-side view gating only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: staff access to boarding-stay / inpatient-chart pages  —  2026-07-12
- **What changed:** `canAccess` now maps the full-page module details to their
  parent module's category gate (`boarding-stay`→`boarding`,
  `inpatient-chart`→`inpatient`). STAFF (and other non-full-access roles) hit
  "Access Restricted" on these pages after the drawer→page conversions — the
  new view ids fell through to the full-access-only default. Category-scoped
  staff get them only with the matching category assigned, mirroring the
  sidebar.
- **Record impact:** 🟢 None — client-side view gating only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### flow: Boarding + Grooming gate checks share data  —  2026-07-11
- **What changed:** on a visit carrying BOTH Boarding Admission and Grooming
  workflows, whichever assessment gate check is filled first seeds the other
  (temperament, vaccination status, verified-vaccines checklist + their
  given-dates) — copied once in `useVisitWizard`, staff edits stand after
  that; a journey event records the pre-fill. Shared steps (vet check,
  communication, follow-up) already used one data slice.
- **Record impact:** 🟢 None — wizard state only (`consultation_records`
  blob via the existing workflow endpoints).
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: Boarding stay is a full page  —  2026-07-11
- **What changed:** `BoardingStayDrawer` → `BoardingStayPage` (`boarding-stay`
  route) — same conversion as the inpatient chart. Two-column layout: care
  logging + care log + consumables on the left; stay facts, Open-visit /
  Add-grooming / Share actions, vaccine gate, instructions and checkout on the
  right. Boarding list cards, visit Boarding chips and legacy `openStayId`
  deep links all navigate to the page; drawer removed. Grooming services
  already added to the linked visit are listed on the page ("Grooming on this
  visit", each row + a header link jump to the Grooming page), deletable
  pre-completion (server still locks settled bills), and each catalog service
  can only be added once (picker chip flips to a green "Added" tag).
- **Record impact:** 🟢 None — UI only, same endpoints as the drawer.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: Health Alerts editing + Reminders & Appts tabs  —  2026-07-09
- **What changed:** (1) Pet profile Health Alerts card is editable — staff add
  alert chips (input + Add) and remove them on hover; saved to
  `pets.healthAlerts`. (2) New "Reminders & Appts" tab on BOTH the pet and
  client profiles (`RemindersApptsTab` shared component): one chronological
  list of reminders + appointment bookings, filter chips Today & Future
  (default) / Past / All, in-place detail modal with Mark-done + Delete.
  (3) The Appt/Reminder badges on Patients-list cards are clickable → open
  that pet's Reminders & Appts tab. Records & Billing "Record" tab folded into
  the per-workflow report tabs; Follow-up Plan created items deletable.
- **Record impact:** 🔵 Low — health-alert edits write `pets.health_alerts`.
- **Data dependency:** Requires backend migration 078 (applied to staging +
  prod 2026-07-09); reminders/bookings endpoints already live.
- **Rollback:** revert the commit and rebuild.

### page: Client profile record grids + clinical-record deep link  —  2026-07-09
- **What changed:** Client profile Medical History and Transactions tabs render
  as responsive 3-column grids. A medical-history card is clickable → opens the
  pet's Clinical Records sub-tab scrolled to that visit (highlighted with a
  seafoam ring, `initialVisitId` nav param). Clinical Records now lists EVERY
  concluded visit (grooming/boarding-only included) and each card shows all
  three workflow sections — Medical Record / Grooming / Boarding — with blank
  ones reading "No service done". Both profile sidebars (client: spending +
  activity + notes; pet: owner + medical notes + preferences + behaviour +
  alerts) merged into one card with seafoam dividers.
- **Record impact:** 🟢 None — UI only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: Client + Pet profile header/summary compaction  —  2026-07-09
- **What changed:** Both profile headers restructured — the tab bar now sits on
  its own full-width row BELOW the identity row, tabs stretch to fill
  (`flex-1`). Client Summary's top cluster (stats · upcoming quick-access ·
  Identity Profile incl. Metadata + Risk & Credit) merged into ONE card with
  seafoam accent dividers (`divide-seafoam/25`); vertical paddings/margins
  tightened across the overview (both columns). Pet profile "Subject Owner"
  card is now clickable → opens the client profile (`onViewOwner` prop wired
  in `App.tsx`).
- **Record impact:** 🟢 None — UI layout only.
- **Data dependency:** None.
- **Rollback:** revert the commit and rebuild.

### page: Visit & billing restructure — 3 encounter types, toggles, group visits, records tabs, billing upgrades — 2026-07-07
- **What changed:** The big visit/billing restructure:
  1. **Register Visit + booking modal**: exactly THREE encounter chips (Vet
     Visit / Grooming / Boarding). The Vet Visit "Visit type" row is now
     Vaccination · Routine Consultation · Routine Check · Consultation ·
     Emergency · Follow-up (`VISIT_TYPES` in `types.ts`). Picking Vaccination
     restores the vaccine picker (services staged, no auto-seed).
     Hospitalization is no longer a type — a red **Hospitalize / In-Patient**
     toggle escalates any vet visit (admission gate check + linked
     hospitalization via `onboardInpatient`).
  2. **House Call + Walk-in are standalone side-by-side toggles** next to the
     Timing (working-hours) controls, available for ALL three encounter types;
     House Call keeps its trip-distance charge and disables Walk-in.
  3. **Group Visit toggle** (vet visits): multi-select the client's animals —
     visits are created sequentially, one per animal, sharing a
     `groupVisitId`. New `GroupVisitPanel` on the visit shows per-animal
     workflow progress (complete vs pending, jump links) + a printable
     **consolidated group invoice**; each patient keeps its own editable
     invoice.
  4. **Wizard flows**: grooming and boarding both gained a mandatory **Vet
     Check** step (fit-for-service, temp/weight, observations, sign-off) before
     care; new `routineCheck` entry point; vaccination flow resolves from
     `visitType` too; a linked hospitalization routes to the admission flow.
     Boarding assessment keeps belongings + feeding schedule (now persisted to
     the stay server-side).
  5. **Patient records tabs** (`PetProfileView`): restructured into
     conditional **Medical Record** (All Visits · Clinical Records ·
     Vaccinations — with vaccination record + certificate/passport access),
     **Grooming Record** and **Boarding Record** tabs — grooming/boarding tabs
     only appear when that history exists; a multi-workflow visit shows under
     each matching tab. Boarding tab lists stays (belongings, feeding) with a
     printable **Boarding Report**; grooming visits get a printable **Grooming
     Report** (per-workflow reports, never merged).
  6. **Billing**: invoice panel is now collapsible; **previous outstanding
     balance** carries forward onto the invoice (toggleable, with a combined
     total-due row); **Add discount** stages a negative Adjustment line
     pre-finalize; **Edit invoice** reopens a finalized unpaid bill;
     Transactions view gained **Export Invoices** (accounting-ready CSV, one
     row per line item). Mid-visit encounter transfers now also log a
     server-side `transfer` journey event (conversion tracking).
- **Record impact:** 🟢 None — new/optional fields and projections; discounts
  are ordinary negative bill lines (same pattern as the grooming discount).
- **Data dependency:** backend migration **077** (`visit_type` enum values
  `VACCINATION`/`ROUTINE_CHECK`, `appointments.group_visit_id`,
  `boarding_stays.belongings`) + the new `/visits/group`, `/visits/outstanding`,
  `/visits/export/invoices`, `/visits/:id/events` endpoints. Deploy backend
  first; without 077 a Vaccination/Routine-Check visit save fails at the DB
  enum.

### page: Vaccination panel in the visit + Boarding/In-patient chip admit-for-visit — 2026-07-06
- **What changed:** New `VaccinationPanel` (mirrors `GroomingPanel`) renders in a
  visit's Record tab for any visit with vaccination tasks: one row per vaccine
  record, a **Given/Scheduled** toggle (syncs the visit task by `taskId`), a
  batch # field, remove, and an **add-a-vaccine** box (pick from the standard
  list or type a custom one) — custom adds are badged **"Added this visit"** in
  teal. Records are shared with the standalone Vaccination page, so a vaccine
  given in either place shows in both. `vaccinations.api` gains `taskId`/
  `isCustom` + `remove()`. Also: the visit's **Boarding**/**In-patient** module
  chips now open the Admit modal prefilled with the visit's pet + appointment
  when no stay/hospitalization exists yet (previously did nothing).
- **Record impact:** 🟢 None (frontend).
- **Data dependency:** backend `vaccination_records.task_id` + `is_custom`
  (migration 076) and `DELETE /vaccinations/:id` — must be live; the panel
  degrades to name-overlap sync if `task_id` is absent.

### page: Clinic working hours editor + auto after-hours on New Visit — 2026-07-06
- **What changed:** Clinic Management → **Billables** gains a **Working Hours**
  card (`WorkingHoursEditor`) — per-weekday open/close times with a Closed
  toggle, saved to `clinics.workingHours`. New Visit now **auto-derives the
  After-hours flag** from those hours whenever the visit date/time changes:
  outside the day's window (or a closed day) flips to 🌙 After-hours · auto.
  Staff can still tap to override; a visit at a different time re-derives.
  Shared helper `components/clinic/shared/workingHours.ts` (`computeAfterHours`,
  day types/labels, defaults). No config ⇒ the manual switch behaves as before.
- **Record impact:** 🟢 None (frontend).
- **Data dependency:** backend `clinics.working_hours` (migration 075) — must be
  live for hours to persist; degrades to the manual switch if absent.

### page: Laboratory record → full page (was drawer) + inline result viewing in wizard — 2026-07-03
- **What changed:** clicking a lab record on the Laboratory page now opens
  `LabRecordPage` — a full-page detail replacing `LabDrawer`: editable
  **markers & results table** (results usually land after the ORDERED record
  is created), result date, attachment preview grid, notes with format
  toggle, and a side rail with the standard record controls (status, share,
  open visit) + metadata. Deep-links from a visit's category header open the
  full page. First of the "special pages" moving from drawer → full page
  (imaging/dental next). Also: the wizard's Diagnostics step gains a **View
  result** toggle per request — lazily loads the pet's lab + imaging records,
  matches by `taskId` (visit-level fallback) and renders markers/findings/
  images inline.
- **Record impact:** 🟢 None — reads existing records; result editing uses the
  existing `labAPI.update`.
- **Data dependency:** none.
- **Rollback:** revert the commit and rebuild (`LabDrawer.tsx` still in tree).

### page: Register Visit — House Call + Hospitalization encounter chips, Date & Time in main column — 2026-07-02
- **What changed:** the Encounter Type row gains **🚗 House Call** and
  **🏥 Hospitalization/In-Patient** chips. UI-level pseudo-encounters: House
  Call maps to `VET_VISIT + isHouseCall`, Hospitalization to `VET_VISIT +
  visitType INPATIENT + onboardInpatient` (auto-admits via the existing flow) —
  the encounter enum gains real values in the DB phase. The old House Call
  toggle (right rail) and the "Onboard to In-patient" checkbox are gone. The
  "Workflow runs inside the visit" info card is removed; the **Date & Time
  picker moved into its slot** in the main column (walk-in shows an
  "arriving now" chip); the right rail keeps Lead Staff, summaries and Book.
  Vet visits show a "Staged Services" card only when module flows pre-staged
  services.
- **Record impact:** 🟢 None.
- **Data dependency:** none — maps onto existing columns.
- **Rollback:** revert the commit and rebuild.

### page: Register Visit — 2-char search, Walk-in → New Client + arrival chip — 2026-07-02
- **What changed:** client/patient search now triggers at **2 characters**
  (local filter + debounced API fallback; placeholder updated). The **Walk-in**
  button is renamed **New Client** (same inline client+pet quick-create modal,
  now titled "New Client") — walk-in is no longer a client concept. Instead, a
  **🚶 Walk-in** toggle chip joins the Visit Type row as an arrival mode that
  combines with any visit type; it's sent as `isWalkIn` in the create payload.
- **Record impact:** 🟢 None.
- **Data dependency:** Graceful — the backend create endpoint ignores
  `isWalkIn` until the arrival-mode column ships (planned for the wizard's
  API phase).
- **Rollback:** revert the commit and rebuild.

### page: Register Visit — vet visits drop the "Visit Workflow" picker — 2026-07-02
- **What changed:** for `VET_VISIT` encounters, `NewVisitView` no longer shows
  the service-category card picker ("Visit Workflow") — the clinical wizard on
  the visit now owns the workflow, driven by the visit type. Registration is
  just Client & Pet → Schedule (2-step indicator). An info card explains the
  flow the visit will open in. Since the backend requires ≥1 task on create,
  a service-less vet visit is auto-seeded with its entry-point fee from the
  catalog (Emergency service for EMERGENCY, else Consultation) assigned to the
  lead staff. Grooming/boarding/vaccination keep the service picker (they are
  service-driven bookings). Pre-staged services (module-page / booking flows)
  still render and submit.
- **Record impact:** 🟢 None — new visits only.
- **Data dependency:** none (uses the existing seeded catalog; falls back to a
  0-priced "Consultation" task if the category is missing).
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** clinics whose catalog lacks a Consultation/Emergency
  service get a KES 0 seed line — price it during the visit.

### flow: Dynamic Visit Workflow wizard + Patient Journey (UI-only phase) — 2026-07-02
- **What changed:** new `components/clinic/appointments/wizard/` module — the
  entry-point-driven clinical wizard from the Dynamic Visit Workflow PRD. The
  visit's `(encounterType, visitType, isHouseCall, surgery-task)` resolves a
  **Visit Entry Point** (`entryPoints.ts` config map) which decides the step
  sequence: Standard Consultation (History → Examination → Assessment →
  Diagnostics → Diagnosis → Treatment → Communication → Follow-up), Emergency
  (Triage & Stabilization first, embedding the existing `EmergencyTriagePanel`),
  Vaccination, Surgery, Hospital Admission, Follow-up Review, House Call,
  Grooming and Boarding. `VisitDetailView` gains a **Clinical Workflow** tab
  (default for non-finalized visits) and a **🧭 Journey** button on every tab
  opening the **Patient Journey** drawer — a per-visit timestamped event feed
  also shown live as a collapsible sidebar inside the wizard. A running-bill
  rail mirrors the visit's real service line-items.
- **Record impact:** 🟢 None — UI only. Wizard drafts + journey events persist
  to `localStorage` (`vethub.visitWizard.v1.<visitId>`); **no API calls** are
  made by the new surfaces (the embedded emergency triage panel keeps its
  existing `triageAPI` behaviour).
- **Data dependency:** none (this phase). The backend `visit_events` +
  `ConsultationRecord` tables replace the localStorage seam in the wiring phase.
- **Rollback:** revert the commit and rebuild.
- ⚠️ **Watch out:** drafts are per-browser (localStorage) — two machines don't
  see each other's wizard progress until the backend lands. Default tab for
  non-finalized visits changed from Services (Triage for emergencies) to
  Clinical Workflow.

### ui: DateRangePicker redesigned (calendar + quick ranges, anchored below trigger) — 2026-06-29
- **What changed:** `components/shared/common/DateRangePicker.tsx` rebuilt to a
  Grafana-style range picker: a month calendar (prev/next, range highlight with
  dark endpoints + gray in-range bar), a quick-range column (Last 30 min … Last
  30 days), editable **Start/End** `YYYY-MM-DD HH:mm` inputs, a timezone label
  (browser tz + GMT offset), and a blue **Apply** that commits the draft. The
  popover now anchors **directly below the trigger** with an upward caret, and
  flips to right-aligned when the trigger sits in the right half of the viewport
  so it never spills off-screen. Public API is unchanged — same
  `value`/`onChange`/`className`/`buttonClassName`, same `DateRange` `{start,end}`
  output (start at 00:00, end at 23:59), so all ~13 consumers work untouched.
- **Record impact:** 🟢 None — UI only.
- **Data dependency:** none.

### feature: inventory add-item supports equipment/food units + multi-scope clinic badges — 2026-06-29
- **What changed:** (1) Inventory → Add item **unit** dropdown now also offers
  equipment/food units (Piece, Pair, Set, Pack, Roll, Tube, Bag, Can, Pouch,
  Block, Tub, Kg, Grams, Litres, mL) and always includes the current value, so a
  unit chosen from the reference-catalog typeahead renders even if not preset.
  Category dropdown already merges live `/drugs/categories`, so the new catalog
  categories (equipment/food) appear automatically. (2) New reusable
  `ScopeClinicBadge` (cyan Building2 pill, auto-hidden when ≤1 clinic in scope)
  added to Clients, Patients, Visits, and Transactions lists + dashboard
  Statistics/Wallets so multi-clinic scope shows the owning clinic name.
- **Record impact:** 🟢 None — UI only; reads existing fields.
- **Data dependency:** the expanded reference catalog (equipment/tools/food) needs
  the backend **`npm run db:seed-drugs`** seed run (backend CHANGELOG → "Reference
  Catalog expanded"). Until then the typeahead just returns the existing medicines.

### feature: admin verification + business-doc upload (clinics + suppliers) — 2026-06-03
- **What changed:** Clinic owners and suppliers get a **Verification** tab in
  their management views to upload business documents (vet/business license,
  registration, owner ID front+back) with an in-browser **image cropper**
  (`react-easy-crop`, new dep) and PDF passthrough. A new platform-admin
  **Verification** queue (`admin-verifications`) lists clinics/suppliers, shows
  their docs (image/PDF preview), and lets an admin approve (→ verified) or
  reject (with reason). New: `verificationAPI`, `DocumentUploader`,
  `VerificationPanel`, `VerificationQueuePage`, `uploadsAPI.uploadBlob`,
  `services/utils/cropImage.ts`; `clinic-doc`/`supplier-doc` upload scopes.
- **Record impact:** 🟢 None on the frontend itself — it reads/writes via the
  verification endpoints. New signups are TEMP_ACTIVE (full trial access) until
  an admin verifies; only FULL clinics appear in the pet-owner portal directory.
- **Data dependency:** backend **migration 013** (verification columns + enums +
  `business_documents`) must be live, and `/api/v1/.../verification` +
  `/admin/verifications` routes deployed. See backend CHANGELOG.
- **Rollback:** revert the frontend commit + rebuild; the Verification tabs and
  admin page stop rendering. No data to undo.

### feature: pet-owner portal — separate client-facing app at /client — 2026-06-02
- **What changed:** A whole new client-facing portal mounted at `/client/*`, a
  warmer ("clienty") variant of the brand, sharing the same build/deploy and
  `AuthContext` as the staff app but rendering a separate tree (`ClientApp`).
  Pet owners can self-sign-up (with clinic search / use-my-location discovery)
  or accept a staff invite, then view pet medical + vaccination records, request
  appointments, message their clinic, and pay invoices (M-Pesa STK with live
  status polling; card via redirect when the gateway returns a URL). A logged-in
  `CLIENT` is redirected from staff routes into the portal. New: `clientPortalAPI`,
  `ClientPortalContext`, `components/client/*`, `.client-portal` theme in
  `index.css`, and `clientsAPI.inviteToPortal` for staff.
- **Record impact:** 🟢 None — new pages/components only. Reads/writes go through
  the ownership-scoped `/portal/*` endpoints; no staff records change shape.
- **Data dependency:** backend migration **012** must be live (`clients.user_id`
  + `message_channel = 'portal'`) and the `/api/v1/portal/*` routes deployed.
  See backend CHANGELOG.
- **Rollback:** revert the frontend commit and rebuild; `/client/*` simply stops
  resolving. No data to undo.

### fix: tour no longer races to the end on owner/client-dependent steps — 2026-05-31
- **What changed:** Pet & appointment tour steps that only render AFTER the user
  picks an owner/client (`pet-form-name`, `appointment-services`) were `optional`,
  so the overlay couldn't find them and auto-skipped each in ~1.2s → the tour
  raced to the end. New `awaitInteraction` step flag: the overlay goes
  **non-blocking** (clicks pass through so the user can actually select an owner),
  shows a "make the selection above" hint, and **waits up to 3 min** for the field
  to appear, then highlights it. Auto-skips only if the user never acts.
- **Record impact:** 🟢 None — UI/UX only.
- **Data dependency:** None.
- **Rollback:** revert the frontend commit and rebuild.

### fix: Treasury tab shows honest sub price + cycle (matches Billing) — 2026-05-31
- **What changed:** The clinic-settings Treasury tab showed the package's base
  price with a hard-coded `/mo` (e.g. "KES 20.00/mo"), while the Billing page
  showed the actual subscription price + real cycle ("KES 32 / 3 months"). Treasury
  now uses the subscription's own `billingCycle` and the matching per-cycle option
  price (falling back to package price), with the same cycle labels as Billing, so
  the two screens agree. Also exposes `billingCycle` on the getActive mapping.
- **Record impact:** 🟢 None — display-only; reads existing fields.
- **Data dependency:** Uses `billingOptions` already on the package payload and
  `sub.billingCycle` from `/stripe/info`. No new API.
- **Rollback:** revert the frontend commit and rebuild.

### fix: receipt tab false "Transaction ID missing" — 2026-05-31
- **What changed:** The DataContext appointment mapper rebuilt each appointment
  field-by-field and **dropped `transactionId`/`receiptNumber`**, so the receipt
  tab's `!appointment.transactionId` banner always fired on paid visits even when
  the transaction was correctly linked. Mapper now carries both fields through.
  (Pairs with backend commit that includes the settled-transaction id in the list
  payload + smarter regenerate.)
- **Record impact:** 🟢 None — display-only mapping fix.
- **Data dependency:** Requires the backend list payload to include `transactionId`
  (shipped alongside). Evict `cache:appointments:*` once after deploy.
- **Rollback:** revert the frontend commit and rebuild.

### page: "has vaccinations" filter on Clients + Pets lists — 2026-05-31
- **What changed:** Added a filter option to the existing filter dropdown on both
  the Clients list ("With Vaccinated Pets") and Pets list ("With Vaccination
  Records"). Pets filter keeps pets whose `vaccinationCount > 0`; Clients filter
  keeps clients who own at least one such pet (matched by `pet.ownerId`).
- **Record impact:** 🟢 None — read-only client-side filtering over already-loaded
  list data. No writes.
- **Data dependency:** None — uses `vaccinationCount` already returned by the
  pets list endpoint (`pet._count.vaccinationRecords`) and `ownerId`. No new API.
- **Rollback:** revert the frontend commit and rebuild.

### page+flow: admin broadcasts + real OTP password reset — 2026-05-30
- **What changed:** Two pieces backed by the new backend email feature.
  - **Broadcasts page** (`BroadcastView`, under Clinic → Broadcasts) — managers/
    owners compose a one-off email to the clinic's opted-in clients, pick the
    audience (all or by client type), see a live recipient count, and view a
    recent-campaign history. New `broadcasts.api` + `BROADCASTS` endpoints.
  - **OTP password reset** — `VerifyOTPPage` now calls `POST /auth/verify-reset-otp`
    against a real per-email code instead of the hard-coded `VHC26` master OTP;
    "Resend Code" re-triggers `/auth/forgot-password`.
- **Record impact:** 🟢 None on the frontend itself — it composes/sends; the
  backend does the writes (broadcast row, per-client message, opt-out flips).
- **Data dependency:** **Requires backend migration 036** (`clients.email_opt_in`/
  `unsubscribed_at` + `broadcasts` table) **and** `RESEND_API_KEY` set on the
  API. Ship after the migration is applied — until then sends return a clear
  "Email is not configured" / no-recipients error rather than failing silently.
- **Rollback:** revert the frontend commit and rebuild.
- ⚠️ **Watch out:** the OTP page no longer accepts `VHC26` — without a live
  backend OTP (Redis + Resend) there is no bypass, so verify the API is
  configured before relying on the reset flow in an env.

### page: client profile identity-card relayout — 2026-05-29
- **What changed:** Reorganized the Identity Profile card on the Client Profile
  page. The single tall left-hand field list + short right-hand Metadata box
  (which left a large empty void) is replaced by a responsive multi-column field
  grid (`sm:2 / xl:3` columns, Coordinates spanning the full row) and a
  full-width horizontal Metadata stat band (6 tiles). Same fields and values,
  better space usage and readability.
- **Record impact:** 🟢 None — pure layout/markup, no data reads or writes changed.
- **Data dependency:** None — same fields as before.
- **Rollback:** revert the frontend commit and rebuild.

### flow: product tour expansion + overlay robustness — 2026-05-29
- **What changed:** Grew the guided tours (client 4→9 steps, pet 5→7, appointment
  4→7) with `data-tour` anchors on more fields; implemented `optional`-step
  auto-skip + `waitMs` settle delay and fixed the overlay's `setTimeout` cleanup.
- **Record impact:** 🟢 None — UI only. Tour completion is stored in browser
  `localStorage`, never the database.
- **Data dependency:** None.
- **Rollback:** revert the frontend commit and rebuild. Shipped to prod + staging.

---

## Pages with a backend data dependency

Reference map of pages that read/write columns added by backend migrations. If
you touch one of these pages, confirm the migration is live in the target
environment first (see `vet-hub-enterprise-backend/CHANGELOG.md`).

| Page / view | Fields used | Needs backend | Behaviour if missing |
|-------------|-------------|---------------|----------------------|
| `RegisterClientView` / `EditClientView` (GPS map) | client `lat` / `lng`, clinic `latitude` / `longitude` | clinic coords = migration **009** (live); client lat/lng = **pending** | Client coords: graceful fallback (`null`) until the pending column lands. |
| `RegisterPetView` / `EditPetModal` (identity & lifecycle) | `color`, `markings`, `isNeutered`, `passportPhotoUrl`, `isAlive`, `dateOfDeath` | migration **025** | `P2022` on save if 025 not applied — apply first. |
| Client name fields (`title`/`firstName`/`secondName`/`surname`) | name-split columns | **pending** (still on legacy `name`) | API computes a display `name`; the split inputs need the pending name-split migration before they persist separately. |
| Appointment booking (services, estimate) | `appointment_tasks.service_id`, `medications` | migrations **013**, **007** (live) | None — already applied. |
| Payments / billing pages | gateway configs, provider refs, billing options | migrations **008**, **019**, **027**, **029** | Feature stays dark until the relevant gateway migration is live. |

---

## Maintaining this file

- Add the entry in the same change that ships the page.
- Always fill in **Data dependency** — it's the field that prevents shipping a
  page ahead of its backend column.
- If a page change implies a backend schema change, add the matching entry to
  `vet-hub-enterprise-backend/CHANGELOG.md` too, and cross-reference it.
