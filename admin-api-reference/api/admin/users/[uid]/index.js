import { db } from "../../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { uid } = req.query;
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found." });
    res.status(200).json({ user: { uid: doc.id, ...doc.data() } });
  } catch (err) {
    console.error("admin/users/[uid] error:", err);
    res.status(500).json({ error: "Failed to load user." });
  }
}
