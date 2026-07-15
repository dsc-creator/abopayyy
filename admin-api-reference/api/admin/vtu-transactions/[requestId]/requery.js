import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

// Manually re-checks a VTU transaction's status straight from VTpass —
// https://vtpass.com/documentation/re-query-services/. Useful for anything
// stuck on "pending"/"initiated" longer than a minute or two instead of
// waiting on VTpass's webhook (which only fires once their staff resolves
// it — could be a while). If VTpass now reports "reversed"/"failed" for a
// request that was already debited, this refunds the wallet the same way
// the webhook does — with the same once-only guard.
//
// Needs VTPASS_API_KEY / VTPASS_PUBLIC_KEY / VTPASS_SECRET_KEY configured
// on this backend (same values as the Cloud Functions secrets).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { requestId } = req.query;
  const reqRef = db.collection("vtpassRequests").doc(requestId);

  try {
    const snap = await reqRef.get();
    if (!snap.exists) return res.status(404).json({ error: "No VTU request found with that ID." });
    const reqData = snap.data();

    if (!process.env.VTPASS_API_KEY || !process.env.VTPASS_PUBLIC_KEY || !process.env.VTPASS_SECRET_KEY) {
      return res.status(500).json({ error: "VTPASS_* env vars not configured on this backend." });
    }
    const credentials = Buffer.from(`${process.env.VTPASS_PUBLIC_KEY}:${process.env.VTPASS_SECRET_KEY}`).toString("base64");

    const vtRes = await fetch("https://sandbox.vtpass.com/api/requery", {
      method: "POST",
      headers: {
        "api-key": process.env.VTPASS_API_KEY,
        "public-key": process.env.VTPASS_PUBLIC_KEY,
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ request_id: requestId }),
    });
    const vtData = await vtRes.json();
    const freshStatus = vtData?.content?.transactions?.status || null;

    const isFailureUpdate = freshStatus === "reversed" || freshStatus === "failed";
    if (isFailureUpdate && reqData.debited && !reqData.refunded) {
      const userRef = db.collection("users").doc(reqData.uid);
      const reference = "RVSL-" + requestId;
      await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) return;
        const data = userSnap.data();
        const existing = data.transactions || [];
        t.update(userRef, {
          balance: (data.balance || 0) + Number(reqData.amount || 0),
          transactions: [
            {
              id: reference,
              type: "credit",
              title: `Reversal — ${reqData.type} purchase`,
              amount: Number(reqData.amount || 0),
              date: new Date().toISOString(),
              category: "↩️",
              reference,
              adminAction: true,
              adminUid: admin.uid,
            },
            ...existing,
          ].slice(0, 200),
        });
      });
    }

    await reqRef.set(
      {
        status: freshStatus || reqData.status,
        lastRequeriedAt: new Date().toISOString(),
        lastRequeriedBy: admin.uid,
        refunded: isFailureUpdate && reqData.debited ? true : (reqData.refunded || false),
        vtpassRaw: vtData?.response_description || null,
      },
      { merge: true }
    );

    res.status(200).json({ success: true, status: freshStatus, raw: vtData });
  } catch (err) {
    console.error("admin/vtu-transactions/[requestId]/requery error:", err);
    res.status(500).json({ error: err.message || "Requery failed." });
  }
}
