import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Queues an email or SMS campaign into `commsCampaigns/{id}`:
//   { channel: "email"|"sms", subject, message, audience, status: "queued",
//     createdAt, createdBy }
// IMPORTANT: this only queues — it does not actually send anything. Actual
// delivery needs a provider wired in:
//   Email: Resend, SendGrid, or Mailgun (a Cloud Function that reads
//          `status: "queued"` rows and calls their send API)
//   SMS:   Termii or Africa's Talking are the common choices for Nigerian
//          numbers (Twilio also works but is pricier for NG routes)
// Add the provider's API key as a secret, then a small Cloud Function or
// cron job that processes the queue.
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    try {
      const { channel = "all" } = req.query;
      let query = db.collection("commsCampaigns");
      if (channel !== "all") query = query.where("channel", "==", channel);
      const snap = await query.orderBy("createdAt", "desc").limit(50).get();
      res.status(200).json({ campaigns: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      console.error("admin/comms GET error:", err);
      res.status(500).json({ error: err.message || "Failed to load campaigns." });
    }
    return;
  }

  if (req.method === "POST") {
    const { channel, subject, message } = req.body || {};
    if ((channel !== "email" && channel !== "sms") || !message) {
      return res.status(400).json({ error: "channel ('email'|'sms') and message are required." });
    }
    try {
      const doc = await db.collection("commsCampaigns").add({
        channel,
        subject: subject || null,
        message,
        audience: "all",
        status: "queued", // no provider wired in — see file header
        createdAt: new Date().toISOString(),
        createdBy: admin.uid,
      });
      res.status(200).json({ success: true, id: doc.id });
    } catch (err) {
      console.error("admin/comms POST error:", err);
      res.status(500).json({ error: "Failed to queue campaign." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
