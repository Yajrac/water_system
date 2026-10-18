# PWSS Consumer App

React Native + Expo SDK 57 prototype for Pio Duran Water Supply System.

## Run

From this folder:

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go. Keep your phone and computer on the same local network.

## Demo account

- Username: `ana.reyes`
- Password: `AnaDemo123!`

Prototype login only. Fictional records are independent of the admin website. No backend, online payment, live authentication or notification delivery is connected. Feedback messages are in memory and reset on app reload or logout.

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
