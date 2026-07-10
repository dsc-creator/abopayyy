import { db, auth } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { uid } = req.query;
  const { suspended } = req.body || {};
  if (typeof suspended !== "boolean") {
    return res.status(400).json({ error: "suspended must be true or false." });
  }

  try {
    await db.collection("users").doc(uid).update({ suspended });
    // Also disable the underlying Firebase Auth account, so a suspended
    // user is actually locked out — not just flagged in Firestore.
    await auth.updateUser(uid, { disabled: suspended });
    res.status(200).json({ success: true, suspended });
  } catch (err) {
    console.error("admin/users/[uid]/suspend error:", err);
    res.status(500).json({ error: "Failed to update account status." });
  }
}
