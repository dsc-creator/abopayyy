# Abopay Admin Dashboard — Setup Guide

This adds a full admin dashboard to the Abopay frontend: an overview page,
a searchable user list, a per-user detail page (with manual wallet
credit/debit and suspend/reactivate), and a global transactions view.

## Important: this repo is frontend-only

This zip only contains the **React frontend** (`src/`). It doesn't include
the actual backend `/api/...` server your app calls — I can see from
`src/api.js` that the frontend already talks to a separate backend at
`VITE_API_URL` (a Vercel serverless project, based on what you've built
previously), which isn't part of this zip.

So this admin dashboard is delivered in two parts:

1. **The admin UI** — done, fully wired into this app, ready to use as-is:
   - `/admin` — overview stats
   - `/admin/users` — searchable user list
   - `/admin/users/:uid` — user detail, credit/debit wallet, suspend account
   - `/admin/transactions` — every transaction across all users
   - Only visible/reachable by accounts with an `admin` custom claim (see below)

2. **Reference backend code**, in `admin-api-reference/`, that you (or I, in
   a follow-up if you share that backend project) need to copy into your
   actual Vercel serverless backend so the endpoints the admin UI calls
   actually exist. It's written to match the same patterns already in this
   project (Firestore, atomic transactions, idempotent references — see
   `functions/index.js` for the style it mirrors).

If you'd like, share the zip/repo for your Abopay backend project in a
follow-up and I'll wire these endpoints directly into it instead of leaving
it as a reference.

## 1. Deploy the admin API endpoints

Copy the contents of `admin-api-reference/` into your backend project so
that these routes exist:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/stats` | GET | Totals + recent signups/transactions for the overview page |
| `/api/admin/users` | GET | Paginated, searchable user list |
| `/api/admin/users/:uid` | GET | Single user + their transactions |
| `/api/admin/users/:uid/adjust` | POST | Manual wallet credit/debit |
| `/api/admin/users/:uid/suspend` | POST | Suspend / reactivate an account |
| `/api/admin/transactions` | GET | Paginated, searchable, filterable transaction feed |

Every route uses `requireAdmin()` (in `admin-api-reference/_lib/requireAdmin.js`)
to verify the caller's Firebase ID token has `admin: true` before doing
anything — so these are safe to deploy even though they expose sensitive data.

Your backend will need the `firebase-admin` package and these environment
variables (from Firebase Console → Project Settings → Service accounts →
Generate new private key):

```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## 2. Grant yourself admin access

Custom claims can only be set server-side, never from the browser (otherwise
anyone could make themselves an admin). Use the included script:

```bash
npm install firebase-admin --save-dev
node scripts/grant-admin.js you@example.com
```

This needs `scripts/serviceAccountKey.json` — download it from Firebase
Console → Project Settings → Service accounts → Generate new private key.
**Never commit this file** (it's already in `.gitignore`).

Sign out and back in to your Abopay account afterward — you'll see an
"Admin Panel" link at the bottom of the regular sidebar, and `/admin` will
be reachable.

## 3. How access control works

- `AuthContext` reads the `admin` custom claim off the signed-in user's
  Firebase ID token (`src/context/AuthContext.jsx`).
- `AdminRoute` (`src/components/AdminRoute.jsx`) guards every `/admin/*`
  route — non-admins are shown an "Access denied" screen, not just redirected.
- `firestore.rules` also grants admins full read/write on the `users`
  collection, in case anything ever reads Firestore directly instead of
  through your API.

## 4. Data model assumptions

The admin dashboard assumes the same `users/{uid}` document shape already
used by the rest of the app (per `firestore.rules` and `functions/index.js`):

```
{
  uid, fullName, email, phone, accountNumber,
  balance: number,
  transactions: [{ id, type: "credit"|"debit", title, amount, date, category, reference, ... }],
  createdAt: ISO string,
  suspended: boolean   // new field this dashboard adds
}
```

## A note on scale

The reference `/admin/stats`, `/admin/users`, and `/admin/transactions`
endpoints read the whole `users` collection into memory to compute totals
and flatten embedded transaction arrays. That's completely fine while your
user base is small-to-medium, and it keeps things simple. Once Abopay grows
past a few thousand users, the natural next step is a dedicated top-level
`transactions` collection (written alongside `creditWallet`/`debitWallet`)
so these become real paginated Firestore queries instead of in-memory scans.
