import { db } from "../../../../_lib/firebaseAdmin.js";
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

  const ref = db.collection("pinResetRequests").doc(id);
  try {
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Request not found." });

    if (action === "approve") {
      const { uid } = snap.data();
      // Clears the PIN hash so the user is prompted to set a new one on
      // next login — adjust the field name once the PIN feature exists.
      await db.collection("users").doc(uid).update({ transactionPinHash: null });
    }

    await ref.update({
      status: action === "approve" ? "approved" : "rejected",
      resolvedAt: new Date().toISOString(),
      resolvedBy: admin.uid,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("admin/pin-requests/[id]/resolve error:", err);
    res.status(500).json({ error: "Failed to resolve request." });
  }
}
