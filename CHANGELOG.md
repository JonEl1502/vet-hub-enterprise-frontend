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
