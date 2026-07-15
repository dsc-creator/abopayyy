import { auth, db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { uid } = req.query;
  if (uid === admin.uid) {
    return res.status(400).json({ error: "You can't revoke your own admin access." });
  }

  try {
    const user = await auth.getUser(uid);
    const claims = { ...(user.customClaims || {}) };
    delete claims.admin;
    await auth.setCustomUserClaims(uid, claims);
    await db.collection("adminAuditLog").add({
      action: "revoke_admin",
      targetUid: uid,
      targetEmail: user.email || "",
      byUid: admin.uid,
      byEmail: admin.email || "",
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("admin/admins/[uid]/revoke error:", err);
    res.status(500).json({ error: "Failed to revoke admin access." });
  }
}
