import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Expects a top-level `disputes/{id}` collection:
//   { uid, email, transactionRef, reason, status: "open"|"resolved"|"rejected",
//     createdAt, resolvedAt, resolvedBy, resolutionNote, refundAmount }
// Nothing in this repo writes to that collection yet — a "Dispute this
// transaction" action on the transaction detail view would create these.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { status = "open" } = req.query;
    let query = db.collection("disputes");
    if (status !== "all") query = query.where("status", "==", status);
    const snap = await query.orderBy("createdAt", "desc").limit(100).get();
    const disputes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ disputes });
  } catch (err) {
    console.error("admin/disputes error:", err);
    res.status(500).json({ error: err.message || "Failed to load disputes." });
  }
}
