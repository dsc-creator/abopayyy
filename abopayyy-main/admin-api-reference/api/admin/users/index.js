import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { search = "", cursor = "", limit = "20" } = req.query;
    const pageSize = Math.min(Number(limit) || 20, 100);

    // NOTE: Firestore has no full-text search. This does a simple
    // case-insensitive "contains" match in memory, which is fine for a few
    // thousand users. For a larger user base, either add indexed prefix
    // fields for `where` queries, or plug in a search service like
    // Algolia/Typesense (fairly common pairing with Firestore).
    const snap = await db.collection("users").orderBy("createdAt", "desc").get();

    let users = [];
    snap.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        balance: data.balance || 0,
        accountNumber: data.accountNumber || "",
        createdAt: data.createdAt || null,
        suspended: !!data.suspended,
      });
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q)
      );
    }

    const startIndex = cursor ? users.findIndex((u) => u.uid === cursor) + 1 : 0;
    const page = users.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + pageSize < users.length ? page[page.length - 1]?.uid : null;

    res.status(200).json({ users: page, nextCursor });
  } catch (err) {
    console.error("admin/users error:", err);
    res.status(500).json({ error: "Failed to load users." });
  }
}
