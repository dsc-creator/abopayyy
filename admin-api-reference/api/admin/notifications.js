import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Broadcasts an in-app notification by writing to a top-level
// `notifications/{id}` doc: { title, body, audience: "all", createdAt, createdBy }.
// This is in-app only (a bell/inbox the customer app would read via
// onSnapshot) — it does NOT send push notifications or emails. Wiring FCM
// push is a separate step (needs a service worker + FCM tokens per device).
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    try {
      const snap = await db.collection("notifications").orderBy("createdAt", "desc").limit(50).get();
      res.status(200).json({ notifications: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
    } catch (err) {
      console.error("admin/notifications GET error:", err);
      res.status(500).json({ error: "Failed to load notifications." });
    }
    return;
  }

  if (req.method === "POST") {
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: "title and body are required." });
    try {
      const doc = await db.collection("notifications").add({
        title,
        body,
        audience: "all",
        createdAt: new Date().toISOString(),
        createdBy: admin.uid,
      });
      res.status(200).json({ success: true, id: doc.id });
    } catch (err) {
      console.error("admin/notifications POST error:", err);
      res.status(500).json({ error: "Failed to send notification." });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
