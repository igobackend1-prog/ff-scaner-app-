# FF Scanner App

React Native + Expo scanner app for Farmers Factory hub operations.

## Roles
- **Hub Manager** — Receive boxes, run QC checks, log wastage
- **Driver** — View delivery route, scan-to-dispatch packs, confirm deliveries

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS or Android)

## Setup

### 1. Install dependencies
```bash
cd ff-scanner-app
npm install
```

### 2. Set environment variables

Get the **Anon Key** from Supabase → Project Settings → API (not the service role key).

Create a `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=https://bvbfnguqpuctdvfztuda.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Run
```bash
npx expo start
```
Scan the QR code with Expo Go on your phone.

## Supabase Setup Required

Make sure the ERP Supabase has these tables (from FFERPv2_Master_Migration.sql):
- `profiles` — with `role` (hub_manager | driver), `hub_id` columns
- `boxes` — with `status`, `box_code`, `product_id`, `hub_id`, `weight_kg`
- `inventory_log` — auto-triggers update on `inventory` table
- `wastage_log`
- `delivery_packs` — with `driver_id`, `route_date`, `status`
- `delivery_pack_items`

## Phone OTP Auth

The app uses Supabase Phone OTP (SMS). To enable:
1. Supabase Dashboard → Authentication → Providers → Phone
2. Enable SMS provider (Twilio / MessageBird)
3. Add your Twilio Account SID, Auth Token, and sender number

## Project Structure

```
src/
├── lib/
│   └── supabase.ts          # Supabase client + all DB helper functions
├── types/
│   └── index.ts             # TypeScript interfaces
├── context/
│   └── AuthContext.tsx      # Auth state (session, profile, role)
├── navigation/
│   └── AppNavigator.tsx     # Routes based on role
├── screens/
│   ├── auth/
│   │   └── LoginScreen.tsx  # Phone OTP login
│   ├── hub/
│   │   ├── HubDashboard.tsx      # Stats + recent activity
│   │   ├── ScanReceiveScreen.tsx # Scan box to receive
│   │   ├── QCScreen.tsx          # QC pass/fail flow
│   │   └── WastageScreen.tsx     # Log wastage
│   └── driver/
│       ├── DriverDashboard.tsx       # Today's packs
│       ├── ScanDispatchScreen.tsx    # Scan pack to dispatch
│       └── DeliveryConfirmScreen.tsx # Confirm delivery at door
└── components/
    └── ScannerCamera.tsx    # Reusable camera with QR/barcode scanner
```

## Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Build APK (Android)
eas build --platform android --profile preview

# Build for iOS
eas build --platform ios
```

Update `app.json` with your real EAS project ID from `eas build:configure`.
