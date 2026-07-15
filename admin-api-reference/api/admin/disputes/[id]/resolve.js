import crypto from "crypto";
import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const { action, note, refundAmount } = req.body || {}; // action: "resolve" | "reject"
  if (action !== "resolve" && action !== "reject") {
    return res.status(400).json({ error: "action must be 'resolve' or 'reject'." });
  }

  const disputeRef = db.collection("disputes").doc(id);
  try {
    const snap = await disputeRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Dispute not found." });
    const dispute = snap.data();

    // Resolving with a refund credits the user's wallet, using the same
    // atomic-transaction pattern as /admin/users/[uid]/adjust.
    if (action === "resolve" && refundAmount > 0) {
      const userRef = db.collection("users").doc(dispute.uid);
      const reference = "REFUND-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
      await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new Error("User not found.");
        const data = userSnap.data();
        const existing = data.transactions || [];
        const nextBalance = (data.balance || 0) + Number(refundAmount);
        t.update(userRef, {
          balance: nextBalance,
          transactions: [
            {
              id: reference,
              type: "credit",
              title: `Dispute refund — ${dispute.transactionRef || id}`,
              amount: Number(refundAmount),
              date: new Date().toISOString(),
              category: "⚖️",
              reference,
              adminAction: true,
              adminUid: admin.uid,
            },
            ...existing,
          ].slice(0, 200),
        });
      });
    }

    await disputeRef.update({
      status: action === "resolve" ? "resolved" : "rejected",
      resolvedAt: new Date().toISOString(),
      resolvedBy: admin.uid,
      resolutionNote: note || null,
      refundAmount: action === "resolve" ? Number(refundAmount) || 0 : 0,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("admin/disputes/[id]/resolve error:", err);
    res.status(500).json({ error: err.message || "Failed to resolve dispute." });
  }
}
