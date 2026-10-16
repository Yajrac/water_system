# Pio Duran admin website

Plain HTML, CSS and JavaScript. No Python, framework, package installation or build step.
Open `index.html` to enter the admin login. Serve the folder with your editor's local
web preview for shared saved records: storage on direct file:// pages varies by browser.

html/ contains the admin pages. css/shared.css holds shared theme rules;
css/admin.css holds forms, dialogs and print layout. Each page has its own readable
script in js/. store.js handles browser records and bill calculation; shared.js
contains small UI helpers and the mobile menu. No build scripts are needed.

All admin pages share a water-blue design. Current records appear as summary
cards. Use the theme switch in the sidebar for light or dark mode; the
selection is remembered in this browser. theme.js applies the saved theme
before the page is drawn, and follows the device preference on first visit.

Start by adding customers or importing a CSV using the downloaded template.
Export Excel records as CSV first. Invalid or duplicate rows reject the whole import.
Meter readings are entered through Billing once an account has a bill.

Generate one bill per customer per month. Rates use progressive tiers: the first
10 cubic meters, next 10, next 10, then remaining consumption. Monthly charges
and selected connection fees are added. Late fees and other charges are explicit
approved amounts entered by the admin. Rates are provisional samples for LGU
confirmation. Saving new rates does not recalculate existing bills.

Payments are linked to a bill. Duplicate receipt numbers and overpayments are
rejected. Partial payments leave a remaining balance. Customer history, dashboard
and reports all use the same saved records. Reports export CSV and can be printed.

Notifications are drafts only, targeted to all customers, a barangay or one customer.
SMS, app delivery and automatic alerts are not connected. The customer APK is out of scope.

This is a local prototype. Records stay in this browser and clearing site data removes
them. There is no server database, server authentication, cross-device synchronization or
mobile account provisioning. Settings can export a JSON copy for reference.

The Add Customer form records applicant/address details, residential/commercial
type, application and installation dates, account/cluster/meter references,
installation estimates, contract/CTC details and accessories acknowledgement.
Supporting-document checkboxes are admin records of received paper documents;
they are not digital signatures. Applications can be saved as Pending; approval
and installation require their supporting details. Installation estimates are
recorded separately and are not automatically charged again on a monthly bill.

Project barangays are Brgy 1–5, Caratagan and Banawan. Old unsupported barangays
are kept visible until corrected, rather than silently reassigned. CSV templates
include optional application fields; the original six-column CSV is also accepted.

calendar.js supplies the styled date picker; manual keyboard date entry is retained.
validation.js contains small shared validation helpers. Receipt identifiers stay
as text (numeric or alphanumeric, including leading zeroes); payment amounts
must be positive numbers with no more than two decimal places. Invalid dates,
duplicate receipts and overpayments are rejected.

New manual applications receive readonly account and application references on
successful save: PWSS-YYYY-00001 and APP-YYYY-00001. Cancelled or invalid forms
do not allocate references, and editing preserves them. Existing CSV account
references are retained; missing application references are generated.

Manual contact numbers are required Philippine mobile numbers: 09 plus nine
digits, or +639 plus nine digits, without spaces. Landlines are not included.

Save Application creates a Pending record. Register Customer is disabled until
the barangay certificate and signed contract are verified, status is Approved
or Installed, and approval date and approver are entered. Installed service also
requires its signed acknowledgement, installation date, meter number and installer.
The same checks run during submission. Registered records cannot be saved back
as an application to bypass verification. Only registered customers are offered
for new bills and notification drafts; historical bills and payments are retained.

Print saved application opens customer-application.html. It follows the supplied
paper application fields, with a second page for recorded contract/accessories
details. Signature lines stay blank; signed originals remain separate. The print
page uses application.css and customer-application.js and has no build dependency.

Add Customer and Edit now use the full-page form at html/customer-form.html.
js/customer-form.js handles validation and saving; js/customers.js handles the
list, filters and CSV import. Saving returns to the customer list with a confirmation.

Billing is split into three linked pages: billing.html (Meter Entry),
generated-bills.html (saved bills), and rates-fees.html (configuration).
Meter entries and generated bills show ten records per page, with search and
filters. pagination.js provides the small Previous/Next controls. Unfinished
meter entries are kept in session storage for the current browser tab while
switching pages or sections. Generate entered bills processes all entered
readings, including filtered or off-page records, and rechecks the saved meter
readings before committing the batch. The draft clears after a successful save.

Billing cycle management on the Meter Entry page manages the active cycle.
Its controls are in js/billing-cycle.js. Rates & Fees only manages charges.
The initial cycle is the
current month. Open selected cycle changes the working month after confirmation.
Previously closed months can be reopened. Back to current month immediately
returns to the current cycle, without closing periods or changing existing bills,
payments or readings. Draft entries stay separate for each cycle.

Meter Entry uses the active month as a readonly field. Generation checks the
saved cycle again, blocks previous years/future months and inactive periods, and
records the actual Manila date in generatedOn. Due dates cannot precede that
date. Old bills keep their original data and show "Not recorded" if their
generation date was not saved. Historical bills remain viewable and payable;
payments on new bills cannot predate their generation date. Meter drafts are
stored separately per cycle so they cannot silently move into another month.

Cycle management uses separate Month and Year dropdowns; existing current-year,
and future-month restrictions still apply. Duplicate bills and generating an older
bill after a newer one for the same customer are still blocked. Generated Bills has an
"Unpaid bills due on" date picker. Selecting a date shows current outstanding
balances due exactly on that date, including partial payments, with customer
names and a remaining-balance total. This is a due-date filter, not a historical
"balance as of" report. Clear the date to return to other date/status filters.

For local testing, data/sample-customers.json contains 20 fictional, ready-to-bill
customer records across all seven barangays. data/TESTING.md explains how to
load them without replacing existing records and walks through bill generation
using suggested meter readings. Visiting Customers fetches the JSON through
js/sample-customers.js and adds missing samples to browser storage. Existing
records and edits are preserved. Use a local web preview URL for fetch to work.

## Local login preview

The login page is html/login.html. The demo credentials are `admin` / `Admin123!`.
auth.js stores a sign-in flag in sessionStorage for the current tab, redirects
unsigned visitors to Login, and provides Logout. It preserves a local requested
page after login. This is a frontend navigation demo, not secure authentication;
credentials are visible in the source and no server verifies requests. Replace
this flow with server-backed authentication before deployment. Logging out does
not delete customer or billing records.

Forgot Password opens html/forgot-password.html. Recovery controls are disabled
and explain that no reset email is sent. No password reset service is connected.

Payment navigation links three separate pages: record-payment.html for receipt
entry, payment-history.html for recorded payments, and bill-balances.html for
remaining balances. Each page has its own script. A selected customer is carried
through the navigation links so customer-specific history stays easy to follow.

Record Payment searches customers by name or account without a customer dropdown.
A unique result or exact account automatically loads the customer. Multiple results
appear as clickable name/account/barangay cards to distinguish duplicate names.
The matched customer
shows their account, barangay and total unpaid balance, and lists only that
customer's outstanding bills. Changing the search clears the previous selection
to avoid posting against the wrong account. Search results show at most 20 matches;
refine the search for larger lists. Payment submission also checks bill ownership.

Payment History has live name/account/receipt search without a customer dropdown,
inclusive date-range and payment-method filters, three totals, and ten receipts
per page. View Receipt opens a printable dialog. New payments save bill-total and
balance snapshots. For older payments, the balance after a receipt is reconstructed
in recording order; the receipt also shows the current remaining balance separately.

Payment receipt numbers are readonly and assigned on successful save in the form
RCP-YYYY-00001. The sequence checks existing payments; failed validation does not
allocate a number. Existing manually entered references remain unchanged. The saved
reference is shown in the confirmation message, payment history and receipt view.
