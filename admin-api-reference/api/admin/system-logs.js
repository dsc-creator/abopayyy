import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Reads `systemLogs/{id}`: { source, level: "info"|"warn"|"error", message,
// timestamp, ...extra }. Cloud Functions write here on notable events —
// currently just paystackWebhook error handling (see functions/index.js).
// Add more `db.collection("systemLogs").add(...)` calls at other failure
// points (purchaseAirtime, purchaseData, payBill, initiateTransfer) as you
// find you want visibility into them.
//
// "Cron Jobs" specifically — scheduled background tasks — aren't set up in
// this project yet. Firebase's equivalent is `onSchedule` from
// "firebase-functions/v2/scheduler"; add one to functions/index.js and log
// its runs here the same way once you have a recurring job to run.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { limit = "50" } = req.query;
    const snap = await db.collection("systemLogs").orderBy("timestamp", "desc").limit(Math.min(Number(limit) || 50, 200)).get();
    res.status(200).json({ logs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    console.error("admin/system-logs error:", err);
    res.status(500).json({ error: "Failed to load system logs." });
  }
}
