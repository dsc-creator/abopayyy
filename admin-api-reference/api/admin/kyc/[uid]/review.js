import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { uid } = req.query;
  const { status, note } = req.body || {};

  if (status !== "verified" && status !== "rejected") {
    return res.status(400).json({ error: "status must be 'verified' or 'rejected'." });
  }

  const userRef = db.collection("users").doc(uid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: "User not found." });
    if (!snap.data().kyc) return res.status(400).json({ error: "This user has no KYC submission." });

    await userRef.update({
      "kyc.status": status,
      "kyc.reviewedAt": new Date().toISOString(),
      "kyc.reviewedBy": admin.uid,
      "kyc.note": note || null,
    });

    res.status(200).json({ success: true, status });
  } catch (err) {
    console.error("admin/kyc/[uid]/review error:", err);
    res.status(500).json({ error: "Failed to update KYC status." });
  }
}
