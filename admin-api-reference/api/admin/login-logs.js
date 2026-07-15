import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Reads the `loginLogs` top-level collection, written by the `logLogin`
// callable Cloud Function (see functions/index.js) right after every
// successful sign-in (email/password, Google, and the admin login screen
// all funnel through the same AuthContext.login/loginWithGoogle calls).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { search = "", cursor = "", limit = "30" } = req.query;
    const pageSize = Math.min(Number(limit) || 30, 100);

    let query = db.collection("loginLogs").orderBy("timestamp", "desc").limit(pageSize + 1);
    if (cursor) query = query.startAfter(new Date(cursor));

    const snap = await query.get();
    const docs = snap.docs.slice(0, pageSize);
    const hasMore = snap.docs.length > pageSize;

    let logs = docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      logs = logs.filter(
        (l) => (l.email || "").toLowerCase().includes(q) || (l.uid || "").toLowerCase().includes(q)
      );
    }

    const nextCursor = hasMore ? docs[docs.length - 1].data().timestamp : null;

    res.status(200).json({ logs, nextCursor });
  } catch (err) {
    console.error("admin/login-logs error:", err);
    res.status(500).json({ error: "Failed to load login logs." });
  }
}
