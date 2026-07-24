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
