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
| `/api/admin/kyc` | GET | KYC submissions, filterable by `status` (pending/verified/rejected/all) |
| `/api/admin/kyc/:uid/review` | POST | Approve or reject a KYC submission |
| `/api/admin/login-logs` | GET | Paginated login history from the `loginLogs` collection |
| `/api/admin/admins` | GET / POST | List admins / grant admin by email |
| `/api/admin/admins/:uid/revoke` | POST | Revoke an admin's access |
| `/api/admin/account-deletions` | GET | Pending/approved/rejected deletion requests |
| `/api/admin/account-deletions/:id/resolve` | POST | Approve (deletes the account) or reject |
| `/api/admin/disputes` | GET | Open/resolved/rejected transfer disputes |
| `/api/admin/disputes/:id/resolve` | POST | Resolve (optionally with a wallet refund) or reject |
| `/api/admin/finance` | GET | Sales stats time series + profit & loss totals |
| `/api/admin/expenses` | POST | Log a manual expense for P&L |
| `/api/admin/api-wallet` | GET | Live VTpass/Paystack balance check |
| `/api/admin/settings` | GET / POST | System settings, service toggles, pricing (one config doc) |
| `/api/admin/coupons` | GET / POST | List / create coupons |
| `/api/admin/coupons/:id` | POST | Toggle active or delete a coupon |
| `/api/admin/notifications` | GET / POST | List / broadcast in-app notifications |
| `/api/admin/pin-requests` | GET | PIN reset request queue |
| `/api/admin/pin-requests/:id/resolve` | POST | Approve or reject a PIN reset |
| `/api/admin/system-logs` | GET | Reads the `systemLogs` collection |
| `/api/admin/comms` | GET / POST | Queue email/SMS campaigns (does not send — see below) |
| `/api/admin/vtu-transactions` | GET | The full VTpass purchase pipeline (airtime/data/bills) |
| `/api/admin/vtu-transactions/:requestId/requery` | POST | Manually re-check a stuck transaction's status with VTpass |

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
  suspended: boolean,   // added by this dashboard
  kyc: {                // added by this dashboard — optional, only present once a user submits
    status: "pending" | "verified" | "rejected",
    idType, idNumber, idImageUrl, selfieUrl,
    submittedAt: ISO string,
    reviewedAt: ISO string | null,
    reviewedBy: string | null,  // admin uid
    note: string | null,
  }
}
```

**Note:** there's no customer-facing KYC submission form in this repo yet —
the KYC Compliance page reviews whatever lands in `kyc`, but nothing writes
it today. That's a separate build (an upload form + Firebase Storage) when
you're ready for it.

### Login Logs

Deploy the `logLogin` callable in `functions/index.js` alongside the
existing ones (`firebase deploy --only functions:logLogin`). It's called
automatically from `AuthContext.login`/`loginWithGoogle` right after a
successful sign-in — including through `/admin/login` — and writes to a
top-level `loginLogs` collection:

```
loginLogs/{autoId}: { uid, email, ip, userAgent, timestamp: ISO string }
```

### Live Chat

Real-time, built on the Firestore client SDK directly (the only feature in
this app that doesn't go through the REST API — see the comment in
`src/firebase.js`). `firestore.rules` scopes `/chats/{uid}` and its
`/messages` subcollection to the owning user and admins only. The floating
widget (`src/components/ChatWidget.jsx`) is mounted globally in `App.jsx`
and shows for signed-in non-admin users; the admin inbox is at
`/admin/live-chat`.

### VTU Transactions (data/airtime/bills via VTpass)

Based on VTpass's actual documented flow
(vtpass.com/documentation — Buying Services, Transaction Status Requery,
Get VTpass Wallet Balance, and the Transaction Update Webhook pages), here's
what changed:

**The core issue VTpass's docs make clear:** a `/pay` call doesn't always
mean "done." VTpass returns code `099` ("processing") for transactions
that are still in flight, and later either delivers or **reverses** them —
communicated via a webhook to a URL you register in your VTpass dashboard,
sent only when their staff resolves something stuck on pending. The
existing code treated `099` the same as `000` (success) and never listened
for that follow-up. If VTpass reversed a transaction after the wallet was
already debited, the money was gone from the user's balance with nothing
crediting it back.

**What's now in place:**

1. **`vtpassRequests/{requestId}`** — a new top-level collection, one doc
   per purchase attempt, written by `purchaseAirtime`/`purchaseData`/
   `payBill` in `functions/index.js` at every stage: `initiated` (VTpass
   called) → `delivered`/`pending` (VTpass's response) → updated again by
   the webhook or an admin requery if it later changes. This is the actual
   "data flow" — one document you can watch move through states, instead
   of only ever seeing the end result.

2. **`exports.vtpassWebhook`** (new Cloud Function, `functions/index.js`) —
   receives VTpass's `transaction-update` callback. If a transaction is
   reported `reversed` or `failed` *after* the wallet was already debited,
   it credits the wallet back automatically (idempotent — checked against
   a `refunded` flag, never double-refunds). **You need to register this
   function's URL in your VTpass merchant dashboard** (Settings → Webhook)
   after deploying — VTpass's docs don't support registering it any other
   way, and there's no signature/secret on their payload to verify against,
   so the handler is deliberately conservative about what it'll act on.

3. **`/admin/vtu-transactions`** (new admin page) — the full pipeline for
   every data/airtime/bill purchase: status badges (initiated → pending →
   delivered/failed/reversed), filterable by status and type, with a
   **Requery** button on anything stuck pending. Requery calls VTpass's
   `POST /api/requery` directly (per their docs) rather than waiting on
   the webhook, and applies the same auto-refund logic if VTpass now
   reports it failed.

4. **`Get VTpass Wallet Balance`** (`GET /api/balance`) was already used
   correctly in `/admin/api-wallet` from the earlier round — confirmed
   against VTpass's docs, no changes needed there.

**Still on you:** register the webhook URL in the VTpass dashboard, and add
`VTPASS_API_KEY`/`VTPASS_PUBLIC_KEY`/`VTPASS_SECRET_KEY` to this admin
backend's environment (separate from the Cloud Functions secrets) so
Requery can authenticate — same requirement as `/admin/api-wallet`.

### What's fully wired up vs. what needs a follow-up decision

Fully working end-to-end once deployed: Admin Management, Account
Deletions, Login Logs, Finance/Sales Stats/P&L, Transfer Disputes, Coupons,
Notifications (in-app), Settings, Live Chat, and the Overview dashboard
(all 8 stat cards + the Revenue vs Failed chart).

Needs something from you before it does anything:
- **Maintenance Mode / Services Control / Pricing** — the values save, but
  no Cloud Function reads them yet. Add a settings lookup at the top of
  `verifyDeposit`/`initiateTransfer`/`purchaseAirtime`/`purchaseData`/`payBill`.
- **Email Management / SMS Message** — messages queue into `commsCampaigns`
  but nothing sends them. Pick a provider (Resend/SendGrid for email,
  Termii/Africa's Talking for SMS in Nigeria) and add a small function that
  processes the queue.
- **KYC Compliance, PIN Management, Transfer Disputes, Account Deletions** —
  the admin review side is real, but nothing in the customer-facing app
  writes the initial submission yet (no KYC upload form, no PIN feature, no
  "dispute this transaction" or "delete my account" button). The expected
  data shape for each is documented in the relevant endpoint file.
- **Referral & Rewards** — not built. There's no referral code or
  `referredBy` field captured at signup to build on top of.
- **Assistant ("RADNI")** — placeholder page only. Needs a decision on
  which LLM API to call and what it should be allowed to access.
- **SMM Management** — not built. This looks like a social-media-marketing
  panel feature from the reference screenshots' source app; it's not
  obviously relevant to a fintech wallet, so it was left out. Flag if you
  actually want a reseller panel here.

### Dashboard stat cards

`/admin/stats` now returns everything the Overview page's 8 stat cards and
the "Revenue vs Failed Amount" chart need: `activeUsersToday`,
`failedTransactionsToday`, `todaysDeposits`, `monthlyDeposits`,
`successfulTransactionsToday`, and a 7-day `revenueVsFailed` series.

"Failed Transactions" is backed by a new top-level `failedTransactions`
collection, written by a `logFailedTransaction()` helper in
`functions/index.js` at every genuine failure point in `initiateTransfer`,
`purchaseAirtime`, `purchaseData`, and `payBill` (provider errors — not
client-side validation errors like a malformed request). A failed attempt
never reaches a user's `transactions` array (the wallet is only ever
debited after the provider confirms success), so "Successful Transactions"
is simply today's recorded transaction count.

## A note on scale

The reference `/admin/stats`, `/admin/users`, and `/admin/transactions`
endpoints read the whole `users` collection into memory to compute totals
and flatten embedded transaction arrays. That's completely fine while your
user base is small-to-medium, and it keeps things simple. Once Abopay grows
past a few thousand users, the natural next step is a dedicated top-level
`transactions` collection (written alongside `creditWallet`/`debitWallet`)
so these become real paginated Firestore queries instead of in-memory scans.
