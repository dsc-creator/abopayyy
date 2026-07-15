import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Single config doc backing System Settings, Services Control, and Pricing
// Management. Reading this doc client-side (customer app) before initiating
// a deposit/transfer/airtime/data/bill purchase is how you'd actually
// enforce maintenanceMode/servicesEnabled — see the note in AdminSettings.jsx.
const DEFAULTS = {
  general: { supportEmail: "", supportPhone: "", minTransfer: 100, maxTransfer: 500000 },
  maintenanceMode: false,
  servicesEnabled: { deposits: true, transfers: true, airtime: true, data: true, bills: true },
  pricing: { transferFeeFlat: 0, transferFeePercent: 0, airtimeDiscountPercent: 0, dataDiscountPercent: 0, billFeeFlat: 0 },
};

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const ref = db.collection("systemSettings").doc("config");

  if (req.method === "GET") {
    try {
      const snap = await ref.get();
      res.status(200).json({ settings: snap.exists ? { ...DEFAULTS, ...snap.data() } : DEFAULTS });
    } catch (err) {
      console.error("admin/settings GET error:", err);
      res.status(500).json({ error: "Failed to load settings." });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const updates = req.body || {};
      await ref.set(
        { ...updates, updatedAt: new Date().toISOString(), updatedBy: admin.uid },
        { merge: true }
      );
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("admin/settings POST error:", err);
      res.status(500).json({ error: "Failed to save settings." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
