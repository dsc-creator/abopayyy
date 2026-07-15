import { auth, db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Lists every Firebase Auth user carrying the `admin: true` custom claim,
// and grants that claim to a user by email (POST). There's no separate
// "admins" collection — admin-ness lives entirely on the Auth custom claim,
// same as scripts/grant-admin.js.
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    try {
      const admins = [];
      let pageToken;
      do {
        const page = await auth.listUsers(1000, pageToken);
        page.users.forEach((u) => {
          if (u.customClaims?.admin === true) {
            admins.push({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName || "",
              createdAt: u.metadata.creationTime,
              lastLogin: u.metadata.lastSignInTime,
              disabled: u.disabled,
            });
          }
        });
        pageToken = page.pageToken;
      } while (pageToken);
      return res.status(200).json({ admins });
    } catch (err) {
      console.error("admin/admins GET error:", err);
      return res.status(500).json({ error: "Failed to load admins." });
    }
  }

  if (req.method === "POST") {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email is required." });
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
      await db.collection("adminAuditLog").add({
        action: "grant_admin",
        targetUid: user.uid,
        targetEmail: email,
        byUid: admin.uid,
        byEmail: admin.email || "",
        timestamp: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("admin/admins POST error:", err);
      if (err.code === "auth/user-not-found") {
        return res.status(404).json({ error: "No account found with that email. They need to sign up first." });
      }
      return res.status(500).json({ error: "Failed to grant admin access." });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
