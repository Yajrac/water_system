# PWSS Consumer App

React Native + Expo SDK 57 prototype for Pio Duran Water Supply System.

## Run

From this folder:

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go. Keep your phone and computer on the same local network.

## Consumer login

Login now uses the Express API and accepts a consumer username or account number.
The default public API is `https://water-system-1.onrender.com/api/v1`; override it
with `EXPO_PUBLIC_API_URL` before starting Expo. A physical phone cannot use your
computer's `localhost` address. For Expo web, add the preview's exact origin to the
backend `CORS_ORIGINS`.

Apply server migration 017 before using this version. Newly bulk-uploaded verified
consumers receive a submitter-number temporary password. Login requires changing it
before the tab screens become available. Password changes verify the current password,
invalidate the old session and return to login. Profile also offers Change password.
Tokens are held in memory only, so restarting the app requires signing in again.

Other screens still show fictional prototype records; they have not yet been connected
to consumer billing/profile APIs. Feedback messages remain in memory. Online payment
and notification delivery are not connected.

## Structure

- `src/app/`: Expo Router routes and navigation.
- `src/features/`: screens and logic grouped by feature.
- `src/components/consumer/`: reusable controls and layouts.
- `src/data/`: fictional sample records.
- `src/theme/`: colors and formatting.

Portrait orientation, compact headers, small corner radii, single-border inputs and two-space indentation. Existing unused template components remain available.

## Checks

```sh
npx tsc --noEmit
npx expo lint
```

The template has no ESLint setup yet. Its first lint run requires a working connection to install tooling. Review audit findings before release; do not force incompatible dependency upgrades.


Profile and feedback now use the authenticated API: `/api/v1/consumer/profile`
returns only the linked consumer's public profile fields. Home identity and meter
number use that same profile. Feedback is submission-only with category/message,
server storage and the consumer's own submission history. Admin Feedback can view
submissions and change review status, with no reply/chat endpoint. Other financial
screens and Home totals/advisory preview still contain sample data pending their
own integration. Deploy the updated backend before testing these screens against
Render; local and hosted accounts remain separate. No new migration is required
for profile/feedback (uses existing migration 010 tables).
