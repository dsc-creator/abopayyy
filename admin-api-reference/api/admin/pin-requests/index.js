import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Expects `pinResetRequests/{id}`: { uid, email, status: "pending"|"approved"|"rejected",
// requestedAt, resolvedAt, resolvedBy }. There's no transaction-PIN feature
// in the app yet (no `transactionPinHash` field on users, no PIN entry on
// transfers) — this manages reset *requests* for whenever that ships, same
// as the KYC/disputes/account-deletions endpoints.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { status = "pending" } = req.query;
    let query = db.collection("pinResetRequests");
    if (status !== "all") query = query.where("status", "==", status);
    const snap = await query.orderBy("requestedAt", "desc").limit(100).get();
    res.status(200).json({ requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("admin/pin-requests error:", err);
    res.status(500).json({ error: err.message || "Failed to load PIN reset requests." });
  }
}
