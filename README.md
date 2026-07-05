# Tradex — Crypto Trading Journal

A minimal, TradeZella-inspired crypto trading journal. Log trades, track R-based
performance, find which setups make money, which mistakes cost the most, and
whether you're following your process.

Built with **React + Vite + TypeScript** and **Firebase** (Google Auth,
Firestore, Storage). No custom backend. Deploys cleanly to **Vercel**.

## Features

- Google sign-in; all data scoped privately to your Firebase Auth `uid`
- Dashboard with R-based stats and a cumulative R curve
- Trades table with search, filters, sorting, and CSV export
- Fast Add/Edit trade form with auto-calculated planned R, realized R, and result
- Multiple screenshot uploads per trade (Firebase Storage)
- Reports: setup, mistake, coin, weekday, and long-vs-short performance
- Playbook: setup library with auto-generated stats from linked trades
- Calendar: monthly Net R heat grid with per-day trade drill-down
- Weekly review form with auto week stats and history

## Tech stack

`react` · `react-router-dom` · `firebase` · `recharts` · `date-fns` ·
`lucide-react` · `vite` · `typescript`

---

## 1. Local setup

Requires Node 18+.

```bash
npm install
cp .env.example .env.local   # then fill in your Firebase values
npm run dev
```

Open the printed local URL (default http://localhost:5173).

To build / preview the production bundle:

```bash
npm run build
npm run preview
```

### Required environment variables

All variables are prefixed with `VITE_` so Vite exposes them to the client.
Find these values in the Firebase console under **Project settings -> Your apps ->
SDK setup and configuration**.

| Variable                            | Description                    |
| ----------------------------------- | ------------------------------ |
| `VITE_FIREBASE_API_KEY`             | Web API key                    |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID            |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `your-project.appspot.com`     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID      |
| `VITE_FIREBASE_APP_ID`              | Web app ID                     |

> `.env.local` is git-ignored. Never commit secrets.

---

## 2. Firebase setup

### Create a project and web app

1. Go to the [Firebase console](https://console.firebase.google.com/) and
   **Add project**.
2. Inside the project, click the **Web** icon (`</>`) to register a web app.
3. Copy the config values into your `.env.local` (see table above).

### Enable Google Authentication

1. **Build -> Authentication -> Get started**.
2. Open the **Sign-in method** tab.
3. Enable **Google**, set a support email, and save.
4. Under **Settings -> Authorized domains**, ensure `localhost` is present and add
   your Vercel domain (e.g. `your-app.vercel.app`) after deploying.

### Create Firestore

1. **Build -> Firestore Database -> Create database**.
2. Choose a region; start in production mode.
3. Go to the **Rules** tab and paste the Firestore rules from
   [`firebase.rules.md`](firebase.rules.md), then **Publish**.

The app uses this structure (created automatically as you add data):

```
users/{uid}/trades/{tradeId}
users/{uid}/setups/{setupId}
users/{uid}/reviews/{reviewId}
```

### Create Storage

1. **Build -> Storage -> Get started**.
2. Choose a location.
3. Go to the **Rules** tab and paste the Storage rules from
   [`firebase.rules.md`](firebase.rules.md), then **Publish**.

Screenshots are stored at:

```
users/{uid}/trades/{tradeId}/{filename}
```

---

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New -> Project** and import the repo.
3. Framework preset: **Vite** (build command `npm run build`, output `dist`).
4. Add the six `VITE_FIREBASE_*` environment variables in **Settings ->
   Environment Variables**.
5. **Deploy**.
6. Back in Firebase **Authentication -> Settings -> Authorized domains**, add your
   new Vercel domain so Google sign-in works in production.

`vercel.json` is included to rewrite all routes to `index.html` so client-side
routing (React Router) works on refresh and deep links.

---

## Analytics definitions

- **Result** — `Win` if realized R > 0.1, `Loss` if < -0.1, otherwise `Break Even`
- **Net R** — sum of realized R
- **Win rate** — wins / (wins + losses); break-even trades are excluded
- **Expectancy** — average realized R per trade
- **Profit factor** — gross win R / absolute gross loss R (shown as `—` when no losses)
- **Max drawdown** — largest peak-to-trough drop on the cumulative R curve

Empty states and missing data are handled cleanly; metrics never render `NaN`
or `Infinity`.

## Project structure

```
src/
  components/   layout, sidebar, shared UI, filter bar
  context/      AuthContext, DataContext
  lib/          firebase, analytics, filters, csv, constants
  pages/        Dashboard, Trades, AddTrade, Reports, Playbook, Calendar, Review, Settings
  services/     trades, setups, reviews (Firestore + Storage)
  styles/       theme, layout, components CSS
  types/        shared TypeScript models
```
