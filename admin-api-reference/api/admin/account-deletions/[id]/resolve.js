import { db, auth } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const { action } = req.body || {}; // "approve" | "reject"
  if (action !== "approve" && action !== "reject") {
    return res.status(400).json({ error: "action must be 'approve' or 'reject'." });
  }

  const reqRef = db.collection("accountDeletionRequests").doc(id);
  try {
    const snap = await reqRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Request not found." });
    const { uid } = snap.data();

    if (action === "approve") {
      // Permanently removes the Auth account and Firestore profile.
      // There's no undo — the frontend confirms this with the admin first.
      await auth.deleteUser(uid).catch((err) => {
        if (err.code !== "auth/user-not-found") throw err;
      });
      await db.collection("users").doc(uid).delete();
    }

    await reqRef.update({
      status: action === "approve" ? "approved" : "rejected",
      resolvedAt: new Date().toISOString(),
      resolvedBy: admin.uid,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("admin/account-deletions/[id]/resolve error:", err);
    res.status(500).json({ error: "Failed to process request." });
  }
}
