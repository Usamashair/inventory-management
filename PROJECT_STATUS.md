# Rexapack CRM — Workflow Status (10 Business Points)

> Updated: **23 Jul 2026** — artwork revisions, admin user management, call-offs stock UX, invoice PDF, inventory/staff scoping.

**How to use:** `[x]` done · `[ ]` remaining · fill **Done by / Date** when verifying in your environment.

**Repos:** Frontend → `ZainAliJon/rexapackcrm` · Backend → `ZainAliJon/rexapack-backend`

---

## Point 1 — Three users (admin, staff, customer)

| Status | **Done** |
|--------|----------|

- [x] Roles: `admin` | `staff` | `customer`
- [x] `isStaffOrAdmin()` — admin and staff share elevated permissions
- [x] `isAdmin()` — admin-only actions (e.g. create staff/admin)
- [x] Customer scoped to own records
- [x] Seeded users: `admin@admin.com`, `staff@staff.com`, `customer@gamil.com` (password `12345678`)
- [x] Frontend role helpers + login demo accounts
- [x] Admin page `/dashboard/admin/customers` — **Customers** + **Users** tabs (Users tab admin-only; create/edit admin & staff)
- [x] API: `GET/POST/PUT/DELETE /api/users` (admin-only; roles `admin` | `staff`)

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 2 — Admin makes quotation then sends to customer

| Status | **Done** |
|--------|----------|

- [x] Only admin/staff can create quotations (with `customer_id`)
- [x] Customer sees quotations addressed to them
- [x] `POST /api/quotations/{id}/send` — draft → sent
- [x] UI: **Send to Customer** on quotation detail
- [x] Quotation list/detail/add UI polished (line totals, dark header metrics)

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 3 — Customer approves quote → order (`waiting-for-artwork`) + delivery choice

| Status | **Done** |
|--------|----------|

- [x] `POST /api/quotations/{id}/approve` creates order linked via `quotation_id`
- [x] Order status starts as `waiting-for-artwork`
- [x] Delivery choice: `warehouse` (pick warehouse) or `customer_address`
- [x] Fields: `delivery_type`, `delivery_warehouse_id`, `delivery_address`
- [x] UI approve modal with warehouse / own address options
- [x] `POST /api/quotations/{id}/reject`

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 4 — Customer sees waiting for artwork

| Status | **Done** |
|--------|----------|

- [x] Order status `waiting-for-artwork` visible on list + detail
- [x] Amber banner on order detail: “Waiting for artwork”
- [x] CTA to upload when no artwork yet
- [x] `/dashboard/artwork` list = orders waiting for artwork (filters: search, artwork status, customer for staff)

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 5 — Artwork upload → revision loop → admin approves → `in-production`

| Status | **Done** |
|--------|----------|

- [x] `artworks.order_id` link
- [x] `POST /api/orders/{order}/artworks` (only while waiting for artwork)
- [x] Upload form on order detail / artwork add
- [x] Customer upload → `awaiting-approval`; staff upload → auto-`approved`
- [x] Admin **Approve** → order moves to `in-production`
- [x] Admin **Revision requested** → customer sees amber CTA + **Upload revision**
- [x] Customer revision upload → status `revision-sent` (**customer-only** label)
- [x] Admin UI never selects/shows “Revision Send”; maps it to **Awaiting Approval**
- [x] Approved artwork locked (edit/delete blocked); staff can still **Request revision** to unlock
- [x] Revision request always returns order to `waiting-for-artwork`

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 6 — Admin progresses order to delivered

| Status | **Done** |
|--------|----------|

- [x] Status transitions enforced for staff/admin
- [x] Customers cannot change production statuses
- [x] Pipeline: `waiting-for-artwork` → `in-production` → `in-transit` → `delivered`
- [x] Staff can advance / jump-ahead status from order UI
- [x] Delivered + warehouse delivery credits `warehouse_stocks`
- [x] Invoice auto-created when order reaches delivered (where configured)

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 7 — Admin warehouses: each customer’s products + quantities

| Status | **Done** |
|--------|----------|

- [x] `warehouse_stocks` ledger (warehouse × customer × product × qty)
- [x] `GET /api/warehouses/{id}/stocks`
- [x] `GET /api/warehouse-stocks` (staff: all stocks)
- [x] Admin warehouses UI shows per-customer stock (“Warehouse stock”)
- [x] Inventory catalog uses live warehouse IDs/names; customer-held column hidden on inventory list
- [x] Inventory pages staff-only (customers redirected; sidebar hides Inventory for customers)

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 8 — Customer warehouse view + delivery report

| Status | **Done** |
|--------|----------|

- [x] `GET /api/my-warehouse-stock`
- [x] Page `/dashboard/my-stock` — stock by warehouse
- [x] Orders report filter: warehouse vs own address
- [x] Call-off help card collapsed by default

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 9 — Call-off: request products from warehouse → address → deduct qty

| Status | **Done** |
|--------|----------|

- [x] `delivery_requests` + `delivery_request_items`
- [x] Customer multi-item request (product + qty rows, quotation-style **Add Item**)
- [x] Warehouse dropdown built from **customer’s stock only** (defaults to warehouse with most products)
- [x] Whole-number qty input (`min=1`, `step=1`); available qty shown without trailing `.00`
- [x] Admin/staff **Fulfill** deducts stock; **Reject** available
- [x] Page `/dashboard/call-offs`

**Sign-off:** Done by: _______________ Date: _______________

---

## Point 10 — Artwork upload for specific order while waiting

| Status | **Done** |
|--------|----------|

- [x] Order-scoped artwork upload API + UI
- [x] Validates order ownership + `waiting-for-artwork` status
- [x] One artwork per order (create blocked if already exists; update existing for revisions)

**Sign-off:** Done by: _______________ Date: _______________

---

## End-to-end checklist (manual QA)

Walk this path once in local/staging:

1. [ ] Login as **admin** → Users tab → create staff if needed; create product + warehouse
2. [ ] Create quotation for customer → **Send to Customer**
3. [ ] Login as **customer** → open quote → **Accept** → choose warehouse
4. [ ] Confirm order **waiting-for-artwork** → upload artwork
5. [ ] Login as **admin** → artwork → **Revision requested** → customer sees **Upload revision**
6. [ ] Customer uploads revision → customer sees **Revision Send**; admin sees **Awaiting Approval**
7. [ ] Admin **Approve** → order **in-production** → advance to **in-transit** → **delivered**
8. [ ] Open **Warehouses** → see customer stock; customer **My Warehouse Stock**
9. [ ] Customer **call-off** (all their products in the right warehouse) → admin **Fulfill**
10. [ ] Open invoice → **Download PDF**

**QA sign-off:** Done by: _______________ Date: _______________

---

## API endpoints (workflow + recent)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/quotations/{id}/send` | |
| POST | `/api/quotations/{id}/approve` | |
| POST | `/api/quotations/{id}/reject` | |
| POST | `/api/orders/{order}/artworks` | |
| POST | `/api/orders/{order}/advance` | Staff status advance |
| GET | `/api/warehouses/{warehouse}/stocks` | |
| GET | `/api/warehouse-stocks` | Staff all stocks |
| GET | `/api/my-warehouse-stock` | Customer (or staff + customerId) |
| GET/POST | `/api/delivery-requests` | |
| POST | `/api/delivery-requests/{id}/fulfill` | |
| POST | `/api/delivery-requests/{id}/reject` | |
| GET/POST/PUT/DELETE | `/api/users` | **Admin only** — admin/staff accounts |
| GET/POST/PUT/DELETE | `/api/customers` | Staff/admin — customer accounts |
| GET/POST/PUT/DELETE | `/api/artworks` | Filters: status, orderStatus, search, customerId |

---

## Recent UI / portal updates (23 Jul 2026)

- [x] Invoice **Download PDF** (`jspdf` + `jspdf-autotable`) — real `.pdf`, not HTML
- [x] Sidebar: removed non-working **Settings** / **Support**; user block opens menu → **Logout**
- [x] Favicon at `/favicon.ico`
- [x] Artwork queue + revision visibility for customers
- [x] Call-offs product list tied to customer stock warehouses

---

## Still out of scope / remaining backlog

- [ ] Live dashboard KPIs / notifications / activity timeline APIs (pages may exist as shells)
- [ ] Odoo sync
- [ ] PDF generation for **quotations** (invoices done)
- [ ] Quote chat messaging (API routes exist; verify end-to-end UX)
- [ ] Email notifications
- [x] Invoices linked to orders (auto-create on delivered)
- [x] Inventory customer-held qty awareness (held column hidden; stock via warehouses / my-stock)

---

## Deploy notes

1. **Backend:** deploy Laravel API; run pending migrations if any; no new migration required for `/users` (uses `users` table + `role`).
2. **Frontend:** `git pull` → `npm install` (needs `jspdf`, `jspdf-autotable`) → `npm run build`.
3. Confirm artwork revision + call-offs + Users tab on staging after deploy.

---

*Implementation covers Phases A–F of the workflow plan, plus Jul 23 portal polish.*
