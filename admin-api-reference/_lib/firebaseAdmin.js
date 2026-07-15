import admin from "firebase-admin";

// Initializes the Firebase Admin SDK once per serverless runtime.
// Requires these env vars on your Vercel project (Settings → Environment Variables):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the private_key from your service account JSON;
//                            Vercel strips real newlines from env vars, so this
//                            code un-escapes literal "\n" sequences below)
//
// Get these three values from: Firebase Console → Project Settings →
// Service accounts → Generate new private key.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export const auth = admin.auth();
export const db = admin.firestore();
export default admin;
