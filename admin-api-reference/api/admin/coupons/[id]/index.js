import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const { action } = req.body || {}; // "toggle" | "delete"
  const ref = db.collection("coupons").doc(id);

  try {
    if (action === "delete") {
      await ref.delete();
      return res.status(200).json({ success: true });
    }
    if (action === "toggle") {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "Coupon not found." });
      await ref.update({ active: !snap.data().active });
      return res.status(200).json({ success: true });
    }
    res.status(400).json({ error: "action must be 'toggle' or 'delete'." });
  } catch (err) {
    console.error("admin/coupons/[id] error:", err);
    res.status(500).json({ error: "Failed to update coupon." });
  }
}
