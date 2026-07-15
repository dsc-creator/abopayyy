import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Expects a top-level `accountDeletionRequests/{id}` collection:
//   { uid, email, reason, status: "pending"|"approved"|"rejected",
//     requestedAt, resolvedAt, resolvedBy }
// Nothing in this repo writes to that collection yet — a "Delete my
// account" button somewhere in account settings would create these.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { status = "pending" } = req.query;
    let query = db.collection("accountDeletionRequests");
    if (status !== "all") query = query.where("status", "==", status);
    const snap = await query.orderBy("requestedAt", "desc").limit(100).get();
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ requests });
  } catch (err) {
    console.error("admin/account-deletions error:", err);
    // Firestore needs a composite index for where+orderBy; the error message
    // includes a direct link to create it the first time this runs.
    res.status(500).json({ error: err.message || "Failed to load deletion requests." });
  }
}
