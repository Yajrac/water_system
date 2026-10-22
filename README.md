# Pio Duran Water Supply ? Admin Website

A plain HTML, CSS, and JavaScript admin website for managing water supply customer records, billing, and payments.

## Features

- Barangay registry, disconnected-account tracking, and customer feedback management.

- Customer registration, profiles, document checks, and account activation.
- Monthly meter readings, bill generation, and configurable rates and fees.
- Full or partial payments, payment history, and printable receipts.
- Dashboard charts, account reports, and consumption by barangay.
- Notification drafts, search filters, light/dark mode, and a collapsible sidebar.
- Responsive layouts and skeleton loading for fetched sample data.


## Run locally

Start MySQL in XAMPP. In CMD, start the backend:

```cmd
cd server
npm run dev
```

Open the project with Live Server (port 5500), then open the root `index.html`.
Use the admin account created with `npm run admin:create`. The old preview password
does not work anymore. See [server setup](server/README.md) if configuring a new machine.

The frontend requires no build step. Keep the backend and Live Server running.
Opening HTML directly with `file://` does not support API login. If using another
frontend port, update `CORS_ORIGINS` in `server/.env` and restart the backend.

## Current scope

Admin login uses the Express/MariaDB API, with per-tab access tokens, server session
verification, logout and expired-session handling. The Barangay registry uses the
API for listing, adding and deleting, with database customer counts.
Customer Management uses database search/pagination, profiles, transactional
registration/editing, Excel import/export, activation history and hashed consumer credentials.
Existing browser sample customers are not imported automatically. Use the updated
Excel template if importing actual existing customer records.
Billing, payments, dashboard and other frontend business pages still use
localStorage while integration proceeds.
The consumer app has not yet been connected. Password reset and actual notification
delivery are not implemented. Reports support preview, print and Excel export.


### Admin passwords

Run `npm run admin:create` from `server` to provision an admin with a temporary password (8?128 characters). New admins must replace it in Settings at first sign-in. Existing admins can change their own password in Settings using their current password, a new password, and confirmation. There are no uppercase, number, or symbol requirements. Password changes invalidate previous sessions and require sign-in with the new password. Existing accounts are not automatically reset.


### Customer Excel export and import

Customer exports include applicant/contact/address fields, account and submitter references, username, service/connection status, dates, meter readings/details, document checks/details, and installation estimate inputs. Importing the exported file into an empty destination preserves these values; duplicate accounts, usernames, submitter/application references and meter numbers are rejected. Passwords, password hashes, uploaded files, bills, payments and activity history are not part of this customer workbook. New imported logins use the submitter number as a temporary password and must change it at first login. Older templates without status/check columns retain the Approved/completed-check defaults. Import up to 100 rows per file.
