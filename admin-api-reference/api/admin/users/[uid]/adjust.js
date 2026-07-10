import crypto from "crypto";
import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

// Manual wallet adjustment, mirroring the idempotent/atomic pattern used
// elsewhere in this project (see creditWallet/debitWallet in functions/index.js):
// one Firestore transaction, a unique reference, balance never goes negative.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { uid } = req.query;
  const { type, amount, reason } = req.body || {};

  if (type !== "credit" && type !== "debit") {
    return res.status(400).json({ error: "type must be 'credit' or 'debit'." });
  }
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number." });
  }

  const userRef = db.collection("users").doc(uid);
  const reference = "ADM-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");

  try {
    const newBalance = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error("User not found.");
      const data = snap.data();
      const existing = data.transactions || [];
      const currentBalance = data.balance || 0;

      if (type === "debit" && currentBalance < numAmount) {
        throw new Error("Insufficient balance for this debit.");
      }

      const nextBalance = type === "credit" ? currentBalance + numAmount : currentBalance - numAmount;
      const tx = {
        id: reference,
        type,
        title: reason || `Manual ${type} by admin`,
        amount: numAmount,
        date: new Date().toISOString(),
        category: "🛠️",
        reference,
        adminAction: true,
        adminUid: admin.uid,
      };

      t.update(userRef, {
        balance: nextBalance,
        transactions: [tx, ...existing].slice(0, 200),
      });

      return nextBalance;
    });

    res.status(200).json({ success: true, newBalance, reference });
  } catch (err) {
    console.error("admin/users/[uid]/adjust error:", err);
    res.status(400).json({ error: err.message || "Failed to adjust wallet." });
  }
}
