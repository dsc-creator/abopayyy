import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Reads the `vtpassRequests/{requestId}` collection written by
// purchaseAirtime/purchaseData/payBill in functions/index.js — one doc per
// VTU purchase attempt, tracking it through initiated -> delivered/pending/
// failed/reversed. This is the actual "data flow" for VTpass purchases:
// initiated (we've called VTpass) -> delivered (success) | pending
// (VTpass still processing — needs a requery or will resolve via webhook)
// | failed (never charged) | reversed (charged, then VTpass reversed it —
// wallet has already been auto-refunded by vtpassWebhook in that case).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { status = "all", type = "all", limit = "50" } = req.query;
    let query = db.collection("vtpassRequests").orderBy("createdAt", "desc");
    if (status !== "all") query = query.where("status", "==", status);
    if (type !== "all") query = query.where("type", "==", type);
    const snap = await query.limit(Math.min(Number(limit) || 50, 200)).get();
    res.status(200).json({ requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("admin/vtu-transactions error:", err);
    // Firestore needs a composite index for where+where+orderBy combos —
    // the error message includes a direct link to create it the first time
    // a given status+type combination runs.
    res.status(500).json({ error: err.message || "Failed to load VTU transactions." });
  }
}
