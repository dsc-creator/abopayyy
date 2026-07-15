import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Manual expense ledger (hosting, provider fees, payroll, etc.) so
// Profit & Loss reflects more than raw transaction volume.
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "POST") {
    const { label, amount, date } = req.body || {};
    if (!label || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "label and a positive amount are required." });
    }
    try {
      const doc = await db.collection("expenses").add({
        label,
        amount: Number(amount),
        date: date || new Date().toISOString(),
        loggedBy: admin.uid,
      });
      return res.status(200).json({ success: true, id: doc.id });
    } catch (err) {
      console.error("admin/expenses POST error:", err);
      return res.status(500).json({ error: "Failed to log expense." });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
