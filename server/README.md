# Water System database

## Admin browser session renewal

The admin frontend renews short-lived access tokens and retries an unauthorized
request once after renewal. Renewing during `/auth/me` verification no longer
causes a false missing-user redirect. Connection errors preserve saved credentials.
The browser signs out after eight hours without pointer, keyboard, touch or scroll
activity, shared across tabs using local storage. Background API requests/renewals
do not reset this timer. This is a browser inactivity policy; JWT validity and the
server's account/password revocation checks remain enforced independently. Existing
saved sessions without activity metadata start tracking on first use after update.
Consumer sessions are unchanged. Deploy the updated shared API, auth and login JS
together; no database migration or longer access-token lifetime is required.

Complete customer imports (meter number, installation date and all three document
checks complete) automatically become Installed and Active, even when the workbook
has Approved/Inactive values. Explicitly Disconnected connections retain their
status. Incomplete records retain the existing import validation/status rules;
missing meter/date pairs and invalid dates are rejected in review. Billing still
requires the current barangay setup and saved consumption. Imported credentials
remain temporary submitter-number passwords with a required first-login change.
This change requires no database migration and does not update previously imported
customers automatically.

## Customer records and billing entry navigation

Customer Management has no single or bulk delete operation. Customer DELETE and
bulk-delete API endpoints are unavailable; use connection status updates to retain
customer and financial history. No records are deleted by this change.
After a successful Save Consumer Entry, billing selects the next unsaved customer
in the barangay, wrapping to earlier unsaved entries. When all entries are saved,
Generate Bills becomes available. Failed saves keep the current customer/input.

Node.js 22 or newer. The migration files reproduce the 18 tables entered manually
in phpMyAdmin. Database commands manage schema history and the office seed.
No admin account, sample customers or passwords are seeded by migrations.

Migration `020_remove_unused_document_details.sql` removes the retired contract
and acknowledgement dates, applicant and representative CTC details, and document
notes from `application_documents`. It permanently deletes values in those
columns; back up the existing database before applying it. The three document
checklist flags remain. Keep migration 014 unchanged so existing migration
checksums stay valid. New databases run 014 and then 020 in sequence.

Migration `021_create_late_fee_assessments.sql` adds late-fee period tracking.
Meter Entry suggests 10% of unpaid charges every seven Philippine calendar days
from each bill's due date (first charge on due date + 7), rounding each increment
to cents. Unbilled increments compound; previously billed unpaid penalties keep
their source bill's clock. Payments settle ordinary charges before carried
penalties in assessment order, using the Philippine payment date. This allocation
is used for suggestions only; recorded payment totals are unchanged.

The existing Late fee field remains editable. Saving approves its displayed
amount, including zero; saved entries retain that approved amount on reload.
Generation adds it to the new bill and records the assessed periods atomically,
including waived periods. Old bills are not silently rewritten by a background
job. A conflicting assessed period blocks generation and requires resaving the
entry. Legacy manual late fees have no historical period metadata and remain
ordinary charges; do not assume they cover previously assessed periods.

## API authentication

Run `npm run dev` after configuring the database and JWT variables in `.env`.
Use `npm run admin:create` to create an admin interactively; there is no public
admin registration endpoint.

- `GET /api/v1/health`: public API health check.
- `POST /api/v1/auth/login`: JSON username/password; returns a short-lived access token.
- `GET /api/v1/auth/me`: requires `Authorization: Bearer <accessToken>`.
- `GET /api/v1/barangays`: requires an active admin and a valid access token.
- `POST /api/v1/barangays`: register an official service area (admin-only).
- `DELETE /api/v1/barangays/:id`: remove an unused service area (admin-only).

Add JSON body:

```json
{
  "psgcCode": "0500513001",
  "name": "Barangay Agol",
  "municipality": "Pio Duran",
  "province": "Albay"
}
```

Codes and names must match `src/data/pio-duran-barangays.json`, copied from the
existing admin directory. Official names are normalized to their display names.
Location defaults to Pio Duran, Albay; additional input fields are rejected.
POST returns 201; PUT returns 200; missing IDs return 404; duplicates and changing
an in-use service area's identity return 409. PUT preserves `is_active`. Writes
and activity logs share one transaction. Unchanged PUTs do not write an audit row.
If all 33 directory entries have been seeded, trying to add one again returns 409.
Deletion checks customers, billing setups, bills and announcement targets, and
returns 409 for linked entries. The delete and activity log commit together.
The list includes `customer_count` from database customers, not browser sample data.

In Postman, log in, copy `data.accessToken`, then select Authorization → Bearer Token
on the protected request and paste the token. Missing/invalid/expired tokens return
401. An authenticated consumer attempting admin access receives 403. Authentication
looks up the current user on every request, so deactivation or a role change takes
effect without waiting for token expiry. Responses do not expose password hashes.

The admin website now uses this API for login and session checks. Start the API
with `npm run dev`, then open `html/login.html` using Live Server on port 5500.
Keep both processes running. `CORS_ORIGINS` in `.env` must include the frontend's
exact origin (for example `http://127.0.0.1:5500`). Restart the API after changing it.

Frontend API settings live in `js/shared/api-config.js` at the repository root.
Localhost/127.0.0.1 use port 3000; production defaults to same-origin `/api/v1`.
Change that public URL for separate API hosting. Do not put secrets in that file.
The access token is stored in sessionStorage for the current browser tab. The old
demo session flag and hardcoded password no longer grant admin access. Protected
pages verify `/auth/me` before displaying content. Expired tokens require re-login.
Logout clears the local token; it does not revoke already issued tokens on the server.

The Barangay and Customer pages use the API. Failed requests display errors and
allow retry; there is no localStorage/sample-data fallback. Billing, payments,
dashboard and other modules still use their previous localStorage records until
their integration is implemented. Local records are not imported automatically.
The consumer app login is also not yet integrated.
Tokens expire after the configured lifetime (default 15 minutes); refresh tokens
and logout revocation are not implemented yet.

## Customer API

All customer endpoints require an active admin's Bearer token:

- `GET /api/v1/customers?page=1&limit=10&search=Ana&barangayId=1&status=registered&type=Residential`
- `GET /api/v1/customers/:id` — application, documents, estimate, active meter, bills and payments.
- `POST /api/v1/customers` — create an application, optionally provisioning consumer credentials.
- `PUT /api/v1/customers/:id` — update the current application; requires its latest `revision`.
- `PATCH /api/v1/customers/:id/status` — Active/Inactive, reason and current revision.
- `POST /api/v1/customers/import` — atomic import of up to 100 pending applications.

Creation body example (omit username/password to provision login later):

```json
{
  "firstName": "Ana",
  "middleName": "",
  "lastName": "Reyes",
  "extensionName": "",
  "gender": "Female",
  "contact": "+639123456789",
  "address": "Purok 1",
  "street": "",
  "barangayId": "1",
  "customerType": "Residential",
  "serviceStatus": "Approved",
  "natureOfWork": "New connection",
  "certificateReceived": true,
  "contractReceived": true
}
```

Fields use camelCase, matching the admin form. The server generates immutable
account/submitter/application references and assigns application/approval dates
and the authenticated approving administrator. The pre-save form shows references
as assigned on save. Installation requires meter number, installation date and
acknowledgement. New Installed connections start Active; other new records start
Inactive. Complete installation before activating an existing connection.

Customer, application, document checklist, estimates, meter and optional consumer
user are saved in a single transaction, along with an activity log. Consumer users
always receive the `consumer` role. Passwords are Argon2id-hashed and never returned;
leaving the edit password blank preserves the current hash. Frontend password
suggestions contain a random UUID suffix independent of public account references.
Username/meter duplicates return 409 and roll back all writes. Credentials and
immutable references cannot be changed via unexpected payload fields.

Edits use a fingerprint to reject stale submissions. Readings/meter identity are
protected once meter entries/bills exist. A billed account cannot change barangay
or customer type through this form. Meter replacement and billing are separate
workflows, not implicit edits of historical records. Activation changes preserve
bills/payments and create connection history and activity entries atomically.

The customer table uses server pagination (10 rows per page), search, filters and
database summary counts. Profile and printed applications read database records.
Unsaved print previews remain tab-local and never create database rows. Add resets
the form after success; Edit returns to the table. Existing passwords are not
autogenerated/reset just because an existing profile was opened.

Use the customer Excel (.xlsx) template for importing existing records: `account`,
`firstName`, `lastName`, `gender`, `contact`, `address` and `barangay` are required;
middle/extension name, street and customer type are optional. Excel limit: 1 MB,
100 rows; JSON requests still have the global 100 KB limit. Duplicate accounts or
invalid rows reject the entire import. Credentials are assigned individually
afterward. The old full-name-only browser CSV template is not accepted.
Export Excel downloads all customers matching the current filters, across pages,
using these same columns; passwords and hashes are excluded. This is a customer
data export, not a full account/database restore. Existing duplicate accounts are
rejected, not overwritten. After import the filters reset and the table refreshes.
SheetJS CE 0.20.3 is vendored in `js/vendor` with its license for offline use.

Opt-in integration test, local XAMPP only, from CMD in `server`:

```cmd
set CUSTOMER_INTEGRATION_TEST=1
node --env-file=.env --test --test-isolation=none tests/customer.integration.test.js
set CUSTOMER_INTEGRATION_TEST=
```

This test requires create/drop database privileges and creates a uniquely named
`pwss_customer_test_*` database, then drops that database in cleanup. It never
changes the configured application's tables or creates real customer accounts.

## Setup

In a terminal opened at `water_system`:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `.env` for the intended database. Local XAMPP commonly uses `127.0.0.1`, port
`3306`, database `water_system`, user `root`, and an empty password. Use your actual
settings. For a VPS, use a dedicated user and password. Never commit `.env`.
Commit the generated `package-lock.json` after install; deployments can then use `npm ci`.

The database must already exist with utf8mb4 encoding. The runner does not create
databases or install MySQL/MariaDB. The user needs DDL permissions for migrations
and metadata visibility for schema inspection. Current target: MariaDB 10.4.32;
MySQL 8.0.16+ is the intended alternative (both should be integration-tested before deployment).

## Existing XAMPP database (the tables already exist)

```powershell
npm run db:status
npm run db:baseline -- --through 016_create_office_settings.sql
npm run db:status
```

Baseline verifies the original tables' columns, types, defaults, nullability,
generated consumption expression, required indexes, foreign keys, InnoDB engine,
utf8mb4 charset and office singleton check. Missing/different definitions stop it
with a list of differences. Extra indexes and unrelated tables are allowed.
Do not use baseline merely to silence a migration failure.

Baseline creates `schema_migrations` and records the original 16 files together
in one transaction. It does not recreate tables or change business records.
Future migration files remain pending. Run this while the application is stopped
so another tool cannot alter the schema while it is being checked.

## Empty database (local or VPS)

Create the empty database in your database administration tool first:

```sql
CREATE DATABASE water_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Then configure `.env` for that database:

```powershell
npm run db:migrate
npm run db:seed:office
npm run db:status
```

Migrate creates tables in filename order. It refuses untracked existing tables.
The office seed is optional and repeatable; it preserves an existing office row.
Seeds do not run automatically with migrate or baseline.

## Later changes and failures

Add a new numbered SQL file such as `017_add_example_column.sql`; never edit or
rename applied files. SHA-256 checksums detect changes (CRLF and LF are equivalent).
`db:status` is read-only. Other commands use a database advisory lock to prevent
concurrent runs of this runner.

Back up a live database before schema changes. MySQL/MariaDB DDL implicitly commits:
a failed multi-statement migration may have created some tables already. A durable
`running`/`failed` record blocks automatic retry and later migrations. Inspect the
database, repair it to the reviewed intended schema, and reconcile the history
deliberately; there is no automatic reset, drop, rollback or repair command.

All migration SQL is trusted repository code. The CLI enables multiple statements
only for these local files. The future API must use separate connections with
multiple statements disabled and parameterized queries.

## Validation

```powershell
npm test
```

Tests use the Node test runner with no database dependency. They verify migration
ordering, the initial schema contract, checksum/history guards, baseline refusal,
and migration failure tracking using database doubles. They do not substitute for
running migrations and baseline against a disposable MySQL/MariaDB database.

If an execution sandbox blocks child processes, run the same tests in one process
(Node 24 supports this flag):

```powershell
node --test --test-isolation=none
```

### Billing setup API

Admin authentication is required for both endpoints:

- `GET /api/v1/billing-setups?month=YYYY-MM` lists saved setups for that month.
- `PUT /api/v1/billing-setups` saves a setup with `barangayId`, `month`, `due` (YYYY-MM-DD) and `rate` (decimal string).

Writes require an active registered barangay, the current Philippine month, a valid due date on or after today, and a positive rate with at most two decimals. Each barangay/month has one setup. Identical saves do not duplicate records or activity logs. Changes are blocked after meter entries reference the setup. Setup writes and activity logs commit together.

The Monthly Billing setup modal now loads and saves through these endpoints, without falling back to browser billing setups. The customer meter list and saved readings are also database-backed; bill generation and the Generated Bills table are also database-backed. No new migration is needed; this uses the existing `billing_setups` table.

Run setup tests with `node --test --test-isolation=none tests/billing-setup.test.js tests/frontend-billing-setup.test.js`. The opt-in disposable MariaDB test in `tests/customer.integration.test.js` also checks setup authentication, save/reload, idempotency and the used-setup guard.

### Meter entry API

Admin-only endpoints:

- `GET /api/v1/meter-entries?setupId=ID` returns the setup, eligible active installed customer meters, and saved entries.
- `PUT /api/v1/meter-entries` accepts `setupId`, `customerId`, `meterId`, `previous`, `consumption`, optional `connectionCharge`, `late`, `other`, and the returned `revision` when editing an existing entry.

The server locks the setup, customer and meter, verifies the current Philippine billing month, checks the assigned meter and previous reading, and rejects already billed accounts. Consumption has up to three decimals; charges have up to two decimals. Current reading is generated by MariaDB from previous reading plus consumption. A save records an activity log in the same transaction and leaves the meter's official current reading unchanged until bill generation. Existing entries require their current revision to prevent overwriting another session's work.

The Monthly Billing page now loads customers and entries from the API and does not use local customer samples or saved browser meter drafts. Connection/reconnection charges are entered explicitly as amounts; no browser fee defaults are applied. Generate Bills is enabled after all eligible customer entries are saved; preview and generation use server-side billing transactions. No schema migration is required.


### Bill generation API

Admin-only endpoints:

- `POST /api/v1/bills/preview` accepts `setupId` and returns server-calculated bill previews plus a revision.
- `POST /api/v1/bills/generate` accepts `setupId` and that preview `revision`.
- `GET /api/v1/bills` supports `page`, `limit` (max 100), `search`, `month`, `due`, and `status` (`Paid`, `Unpaid`, `Overdue`, `outstanding`).

Preview does not save bills. Every eligible active installed customer in the selected setup must have a saved meter entry. Generation locks and rechecks the setup, customer meters and entries; changed previews, past due dates and duplicate bills are rejected. Water charge uses integer arithmetic and half-up rounding to cents. Bill insertions, meter current readings, Billed entry status and the activity log commit together; any failure rolls back the whole batch. Existing bill uniqueness constraints remain the final race guard. Zero consumption is accepted. No automatic late-charge policy is added.

The Monthly Billing page uses the server preview for confirmation. Unsaved meter edits must be saved before generating. Generated Bills now reads database bills and payment-derived balances with server-side filtering and pagination; it does not read local browser financial records. Payment entry, payment history, receipts and balances are also database-backed. This uses the existing bills table without a new migration.

Tests include exact rounding, stale previews, preview cancellation, server pagination, concurrent generation requests and a deliberately failed audit insert in a disposable MariaDB database to verify rollback of the bill, meter and entry status.


### Payments and receipts API

Admin-only endpoints:

- `POST /api/v1/payments` accepts `billId`, `amount`, `expectedBalance`, `method`, optional `reference` / `remarks`, and a unique `requestKey` (16-64 letters, digits, underscores or hyphens).
- `GET /api/v1/payments` supports `page`, `limit`, `search`, `customerId`, `method`, `from`, `to`; response includes matching totals and collections today.
- `GET /api/v1/payments/:id` returns the saved receipt, bill readings/charges, customer and office details.
- Bill lists additionally support `billId`, `customerId` and `barangayId` for cashier selection and balance views.

Supported methods match the existing database: Cash and Bank transfer. Bank transfers require a reference. GCash has been removed from the prototype dropdowns rather than misclassifying it as another method. No migration is required.

A bill is locked before checking its balance. Payments use integer cents, support partial settlement and reject stale balances, overpayment, zero/negative amounts and client-supplied dates/receipt numbers. Receipt numbers and UTC paid timestamps are server-generated; date filters and displays use Philippine time. The payment and activity log commit together. Reusing the same request key with the same bill, cashier and payment fields returns the original receipt, including after the bill is fully paid; changing that request's payload is rejected. Retrying the same review after a network failure preserves its request key.

Receipt history reconstructs balances immediately before/after that payment using earlier payment IDs, so later payments do not change an old receipt's balance. The cashier preview is not printable before a successful server save; saving updates the preview with the canonical receipt. Payment history, receipts and bill balances no longer read browser financial records. Browser-cached legacy payments are not imported automatically.

Automated tests cover payment validation, partial settlement, idempotency, stale balances, concurrent cashiers, rollback on an injected audit failure, historical receipt balances and the async receipt/printing flow. The live MariaDB checks run only in a generated disposable test database.

### Automatic barangay registration during customer import

Excel imports can submit a registered `barangayId` or an official Pio Duran `barangayName` (not both). Names are case-insensitive and accept the Barangay/Brgy prefix or official aliases. Only import requests can use names to register missing areas; ordinary Add/Edit still requires a registered ID. Inactive areas are not silently reactivated.

`POST /api/v1/customers/import/preview` validates the rows and checks current accounts/areas without writing. It returns the customer count and `barangaysToRegister` for confirmation. The final import revalidates everything, registers each missing official area once, and saves customers and audit logs together. A failed customer row rolls back new areas and their audit logs as well. The import result includes `barangaysRegistered`.

The UI shows checking, resolving barangays and saving stages with an indeterminate progress bar, then refreshes the customer table and barangay filter and reports the saved counts. Purok may be supplied in the street column when the address column is absent; a plain street name is never guessed as a Purok.

### Reviewed partial customer imports

The Bulk Upload review now returns `rows` with the Excel row number, customer/account label, ready/rejected status and reason, plus `count`, `rejectedCount`, `barangaysToRegister` and a review `revision`. Invalid customer fields, existing account numbers and later duplicate account numbers within the workbook are reported per row. Structural workbook errors (invalid headers, formulas or oversized files) still reject the file before review.

The UI displays every reviewed row in a scrollable Excel-style table, using red text for rejected rows. With no ready rows it offers no save action. Otherwise the action explicitly says Import N customers and submits all source rows plus `reviewRevision` to `/customers/import`. The server rechecks under transaction locks, rejects a stale review, then saves only the reviewed ready subset. New barangays are registered only for accepted rows. The accepted subset remains atomic if a database/audit error occurs; rejected customers never overwrite existing records. The result includes `rejectedCount` and `rejectedRows` for the success summary. Legacy requests without a review revision retain the strict all-or-nothing import behavior.

Account number remains the required reliable duplicate identifier for this import format; missing account numbers are reported as rejected rows, not guessed from a name.

Barangay names come from the official directory. Barangay editing is removed from the UI and API; PUT requests to `/api/v1/barangays/:id` return 404. Existing records are unchanged.

### Dashboard

`GET /api/v1/dashboard` requires an authenticated admin. It returns customer and service-area counts, bill counts and outstanding balances, collections today/this month/all time, six monthly collection totals, bill status counts, and six-month billed consumption per registered barangay. Approved or Installed latest applications count as registered customers.

The queries share one transaction snapshot. Payment totals are grouped per bill before calculating balances; paid bills and partial payments are counted once. Due dates use the Philippine calendar day, and UTC payment timestamps are converted to Philippine dates for collection groups. Monetary values remain decimal strings in the API. Missing months and areas without billed consumption return zero.

The admin dashboard loads this endpoint after session verification and offers Refresh with loading and retry feedback. It no longer loads sample customers or reads financial records from browser storage. No migration is required.

### Verified existing-consumer import and temporary passwords

Apply `017_add_temporary_consumer_password.sql` before deploying this version. For local
XAMPP use `npm run db:migrate` from `server`. For the existing Aiven database run
`node scripts/migrate-aiven.js "C:\Users\user\Downloads\ca.pem"` and enter the Aiven
host/port/user/password when prompted. This checks existing migration history and
applies only pending migrations. Do not re-import the SQL backup.

New bulk uploads are for office-verified existing consumers: applications are Approved
with document checks complete, not Installed or active until installation is verified.
Each accepted row gets a unique name-based username, an account login, and a submitter
number whose Argon2 hash is used as the temporary password. The plaintext password is
not stored in users or exported to Excel. The submitter number remains an office-visible
identifier, so it is only an initial credential and must be replaced at first login.
The customer table shows a red Temporary password indicator while the flag is set.
Rejected rows create no credentials. Normal Add Consumer status/password rules remain
unchanged. Previously imported customers are not automatically modified or reset.

`POST /api/v1/auth/login` accepts `username` containing a username or consumer account
number. Ambiguous identifiers fail authentication. Login and `/auth/me` return
`mustChangePassword`. Flagged accounts can access only `/auth/me` and
`POST /auth/change-password`, with `{ currentPassword, newPassword }`. The latter verifies
the current password, rejects reuse, hashes the new value, clears the flag and increments
the account token version in the same transaction as its audit event. Sign in again after
changing password; prior access tokens are invalid. Admin password replacements also
invalidate previous consumer access tokens.

The consumer app now uses the API for login and password changes, with a required
first-login screen and a profile Change password action. Tokens are held in memory.
Set `EXPO_PUBLIC_API_URL` to override its default Render API URL; browser-based Expo
previews also require their exact origin in API `CORS_ORIGINS`. Other consumer app
screens still use prototype data; their billing/profile data APIs are separate work.


Notifications: apply migration 018 before deploying the notifications routes. Admin
`GET /api/v1/notifications`, `GET /api/v1/notifications/recipients`, and
`POST /api/v1/notifications` support database drafts or Published advisories with a
snapshot of the selected all/barangay/customer audience. Creating a notice and
its recipient links/audit entry is transactional. Only Published, nonexpired
advisories appear in `GET /api/v1/notifications/mine` for the authenticated linked
consumer, alongside their own recent bills, payments and latest application statuses.
The consumer Announcements screen loads this feed with a manual refresh. This is
an in-app feed, without background push, SMS delivery or unread tracking. Other
consumer screens may still use prototype data. Existing browser-only drafts are
not imported automatically. Recipient snapshots apply to new notices; legacy
announcements without recipient links remain hidden from the consumer feed.

Local: `npm run db:migrate`. Aiven: run `node scripts/migrate-aiven.js "path/to/ca.pem"`
before deploying migration-dependent code. The customer cleanup helper also
removes announcement recipient links when clearing customer records.


Consumer profile and submission-only feedback:
- Consumer-only `GET /api/v1/consumer/profile`, `GET /api/v1/consumer/feedback`,
  `POST /api/v1/consumer/feedback` (category/message only, 1500 characters maximum).
  Customer identity comes exclusively from the authenticated user's linked record.
- Admin-only `GET /api/v1/feedback` (search/status/page) and
  `PATCH /api/v1/feedback/:id` (status only: New/In progress/Resolved).
- No reply endpoint. Existing internal notes and legacy admin messages are not
  exposed to consumers. Submission/status changes are transactional with audit logs.
  These features use existing feedback tables; no additional migration is needed.


Consumer financial records: `GET /api/v1/consumer/finances?billsPage=1&paymentsPage=1`
returns account-wide summary and latest bill plus 20 bills and 20 payments per
page. Authentication determines the linked customer. Reads share a transaction;
MySQL calculates decimal-string balances, Philippine-date overdue status and
historical receipt balances using payment order. No mutation/payment collection
is allowed through this endpoint. No new migration is required.


Migration 019 provides persisted notification read state. Consumer-only POST
`/api/v1/notifications/read` accepts accessible feed IDs. Phone push registration
routes and the delivery worker were removed; notifications are in-app only.
The migration remains unchanged because it has already been applied locally;
its unused device/delivery tables do not start any background service.
