import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { search = "", type = "", cursor = "", limit = "30" } = req.query;
    const pageSize = Math.min(Number(limit) || 30, 100);

    // Same caveat as /admin/stats and /admin/users: this flattens every
    // user's embedded `transactions` array in memory. Fine for an MVP;
    // once the platform grows, move transactions into their own top-level
    // Firestore collection so this can become a real paginated query
    // (orderBy("date").startAfter(cursor).limit(pageSize)).
    const snap = await db.collection("users").get();
    let transactions = [];
    snap.forEach((doc) => {
      const data = doc.data();
      (data.transactions || []).forEach((tx) => {
        transactions.push({ ...tx, uid: doc.id, userEmail: data.email });
      });
    });

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (type) transactions = transactions.filter((tx) => tx.type === type);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      transactions = transactions.filter(
        (tx) =>
          (tx.title || "").toLowerCase().includes(q) ||
          (tx.reference || "").toLowerCase().includes(q) ||
          (tx.userEmail || "").toLowerCase().includes(q)
      );
    }

    const startIndex = cursor ? transactions.findIndex((tx) => tx.id === cursor) + 1 : 0;
    const page = transactions.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + pageSize < transactions.length ? page[page.length - 1]?.id : null;

    res.status(200).json({ transactions: page, nextCursor });
  } catch (err) {
    console.error("admin/transactions error:", err);
    res.status(500).json({ error: "Failed to load transactions." });
  }
}
