/**
 * Grants (or revokes) the `admin` custom claim on a Firebase user account.
 * This is the ONLY way to unlock the Admin Dashboard for an account — it
 * can't be done from the browser, on purpose (that would let anyone make
 * themselves an admin).
 *
 * ── One-time setup ───────────────────────────────────────────────────────
 *   1. Firebase Console → Project Settings → Service accounts →
 *      "Generate new private key". Save the downloaded file as
 *      serviceAccountKey.json in this same scripts/ folder.
 *      (It's already covered by .gitignore — never commit this file.)
 *   2. From the project root: npm install firebase-admin --save-dev
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   node scripts/grant-admin.js you@example.com            # grant admin
 *   node scripts/grant-admin.js you@example.com --revoke    # revoke admin
 *
 * After running this, the person must sign out and back in (or wait for
 * their Firebase ID token to naturally refresh, ~1 hour) before the
 * Admin Dashboard link appears.
 */
const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("./serviceAccountKey.json");
} catch {
  console.error(
    "Missing scripts/serviceAccountKey.json.\n" +
      "Download it from Firebase Console → Project Settings → Service accounts → " +
      "Generate new private key, then save it at scripts/serviceAccountKey.json."
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: node scripts/grant-admin.js user@example.com [--revoke]");
    process.exit(1);
  }

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: !revoke });

  console.log(`${revoke ? "Revoked" : "Granted"} admin claim for ${email} (uid: ${user.uid}).`);
  console.log("They need to sign out and back in to see the change take effect immediately.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
