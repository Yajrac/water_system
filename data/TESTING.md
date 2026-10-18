# Sample customers and generated bills

`sample-customers.json` is an array of 20 fictional residential customers.
All seven project barangays are represented. Names, contacts, references and
document-verification flags are synthetic test values. No actual documents were
verified. All accounts are marked Registered/Installed so they can exercise meter
entry and its two pages of results. The first six customers also include sampleBills and samplePayments for May?October 2026. These fictional records populate dashboard charts, billing history and cash payments.

Each record includes:

- `reading`: the previous meter reading used by the website.
- `suggestedCurrentReading`: a value to type into Meter Entry.
- `expectedTestConsumption`: the difference between those two values.

Open the website with your editor's local web preview and visit Dashboard or Customers.
`js/customers/sample-customers.js` uses `fetch('../data/sample-customers.json')` like an
API call. The list refreshes when loading finishes. The samples are appended to
browser storage so they are also available in Meter Entry, payments and reports.
Opening the site directly with file:// may block fetch; use the local preview URL.

Existing customers, bills, payments, rates, office settings and cycle settings
are retained. Samples matching an existing ID, account or application number
are skipped, so refreshing neither duplicates records nor overwrites edits.
The fixture uses TEST-prefixed references to avoid consuming manual account sequences.

## Chart fixtures

The JSON includes 36 bills and 24 cash payments, with full, partial and unpaid balances. TEST-prefixed IDs and receipts identify fixtures. Existing customer details and existing bills for the same customer/month are preserved. Refreshing does not duplicate fixtures. Months in charts follow the current Philippine date; May?October 2026 fixtures will move outside the six-month window over time.

The first six customers already have October sample bills; use another customer (for example customer 7) for new October billing tests. Ana?s meter example below illustrates the calculation; a duplicate October bill is intentionally blocked.

## How to generate a test bill

1. Open **Billing & Meter Reading → Meter Entry**.
2. Verify that the active cycle is open. Use Manage period in the Monthly Billing card if necessary.
3. Select a due date on or after today.
4. Find Ana Reyes (`TEST-PWSS-00001`). Her previous reading is **100**.
5. Enter **115** as the current reading. Consumption is **15 m³**.
6. Leave connection charge as None, late fee as 0 and other charge as 0.
7. Click **Generate entered bills**. Entries on other pagination pages are included too.
8. Open **Generated Bills** to see the saved record.

With the project's original provisional rates, the example is:

```text
First 10 m³ × 8.50        =  85.00
Next 5 m³ × 11.00        =  55.00
Water charge             = 140.00
Monthly service charge   =  75.00
Current bill total       = 215.00
```

If you changed Rates & Fees, the total follows your saved rates instead.
These sample rates are not a confirmation of the approved PWSS tariff sheet.

The Generate action saves the bill's readings, consumption, charges, billing month,
actual generation date and due date. It then advances that customer's saved meter
reading from 100 to 115. It does not mark the bill Paid, send a message or record a
payment. The Generated Bills page only displays saved bills; opening it does not
generate another bill. The same account cannot receive a second bill for that cycle.

Use Payment History to record a receipt against the bill. A partial payment leaves
a balance; settling the balance changes the status to Paid. An unpaid balance past
its due date is shown as Overdue. For the next cycle, 115 becomes the previous
reading, so a current reading of 130 means another 15 m³, not 130 m³ of consumption.

## Research and limits of this prototype

Maynilad's official explanation identifies meter readings, consumption, charge
breakdowns, invoice references, generation-related service information and due
dates as key parts of a water bill. It also distinguishes prior unpaid amounts
from current charges and lists certain other charges separately. This supports
the general reading → calculation → saved bill → payment flow; its tariff and
specific fee rules must not be copied as PWSS policy.

Source: [Maynilad — How to Read your Water Bill](https://www.mayniladwater.com.ph/how-to-read-your-water-bill/).

In this website, old unpaid bills retain their own balances instead of being added
again to every new bill's total. Fees are included only when entered or selected.
Residential/commercial tariff differences, an official printable billing invoice,
reading dates, corrections/credit notes and automatic penalties would require
their own confirmed rules and implementation. This task adds test data and this
guide; it does not change the billing formula or automatically generate bills.

## Paying several bills

Record Payment defaults to All outstanding bills and fills Amount Paid with the account total. Lower the amount for a partial payment, or select one billing month. Payments are allocated oldest month first using integer centavos. One receipt records the full amount and lists each bill allocation, meter readings and remaining bill balance. Existing single-bill payment records remain supported.

## Monthly Billing period controls

The active month, progress, due date and readings share one Monthly Billing card. Manage period advances one month at a time, with confirmation and a warning for unbilled customers. Future months stay unavailable. Reopen previous cycle requires a reason and retains existing bills and payments. Current-year billing and per-customer duplicate/later-bill checks still apply. Draft readings stay attached to their original month.

## Updated PWSS water rates

New bills use the supplied PWSS rate sheet and the customer type. Residential minimum is PHP70 for 0?10 m?, followed by PHP8, PHP8.50, PHP9 and PHP9.50 for the next four 10 m? brackets. Commercial minimum is PHP100, followed by PHP12, PHP13, PHP14 and PHP15. There is no separate monthly fee on new bills.

Examples: Residential 0 or 10 m? = PHP70; 15 m? = PHP110; 25 m? = PHP192.50; 50 m? = PHP420. Commercial 25 m? = PHP285 and 50 m? = PHP640. Consumption above 50 m? is blocked for both types pending confirmation. Fractional readings are charged progressively and rounded to centavos.

Existing bills and JSON sample bills retain their original amounts, including any old provisional monthly fees. They are historical test fixtures, not examples of the new tariff. Connection and reconnection fees remain separately configured; the rate-sheet image does not confirm those fees. Changing tariffs never recalculates old bills or payments.

## Barangay registry

Open Barangay Registry from the sidebar. The original seven service areas remain the defaults. Add Barangay loads choices from `data/pio-duran-barangays.json`; municipality and province are fixed to Pio Duran, Albay. Registered areas are shared by customer registration, billing/report filters and notification targeting. Existing customer records prevent deletion or replacement of their barangay. Duplicate selections are rejected. Registry entries use the same browser storage as other project records.

Directory source: [PSA PSGC - Pio Duran](https://psa.gov.ph/classification/psgc/barangays/0500513000), 33 barangays listed as of 31 July 2025, checked 18 October 2026. Official Barangay I-V map to the existing Brgy 1-5 labels for compatibility. The local directory works without a third-party API once the project is served locally.

## Current billing mode: flat rate

Billing Setup on Rates & Fees now saves a positive price per cubic meter and due date for a registered barangay in the current month. Continue requires confirmation, then opens Meter Entry for that barangay. New water charges use consumption multiplied by the saved price, rounded to centavos; there is no minimum water charge in flat mode. Examples: 25 m? at PHP8 = PHP200; 55 m? at PHP9 = PHP495; zero consumption = PHP0 water charge. Any manually selected connection, late or other charges are added separately. The setup is required for each barangay/month; historical progressive bills and sample fixtures are not recalculated. Each generated bill stores its rate snapshot. Generation date always uses today in Philippine time. This section supersedes the earlier progressive tariff instructions for new billing.

## Disconnections and feedback

Disconnected Accounts records an active registered customer, reason and current date after confirmation. Disconnected accounts are excluded from new bills; existing bills and payment history remain available. Reconnect updates the service status and records the date without settling balances or charging a fee automatically. Administrative deactivation alone is not recorded as a physical disconnection.

Customer Feedback is entered manually by the admin. Choose a saved customer and category, then save the concern after confirmation. View a record to update its status (New, In progress, Resolved) and notes. Search and status filters apply to both pages. Records use browser storage; no customer app submission or message delivery is connected.
