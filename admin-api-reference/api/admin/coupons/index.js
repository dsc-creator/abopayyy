import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// `coupons/{id}`: { code, type: "percent"|"fixed", value, maxUses, usedCount,
//   expiresAt, active, createdAt, createdBy }
// This endpoint manages coupons from the admin side. Actually redeeming a
// code (incrementing usedCount, validating expiry/maxUses) needs to happen
// inside a trusted server function at the point of use — e.g. inside
// verifyDeposit in functions/index.js — not written here since there's no
// coupon-entry field in the deposit flow yet.
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    try {
      const snap = await db.collection("coupons").orderBy("createdAt", "desc").get();
      res.status(200).json({ coupons: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      console.error("admin/coupons GET error:", err);
      res.status(500).json({ error: "Failed to load coupons." });
    }
    return;
  }

  if (req.method === "POST") {
    const { code, type, value, maxUses, expiresAt } = req.body || {};
    if (!code || (type !== "percent" && type !== "fixed") || !value) {
      return res.status(400).json({ error: "code, type ('percent'|'fixed'), and value are required." });
    }
    try {
      const doc = await db.collection("coupons").add({
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        maxUses: maxUses ? Number(maxUses) : null,
        usedCount: 0,
        expiresAt: expiresAt || null,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: admin.uid,
      });
      res.status(200).json({ success: true, id: doc.id });
    } catch (err) {
      console.error("admin/coupons POST error:", err);
      res.status(500).json({ error: "Failed to create coupon." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
