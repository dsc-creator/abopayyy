import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    // NOTE: reads the whole users collection into memory. Fine for an MVP
    // with a modest user base; once you have thousands of users, keep a
    // running counters document (updated in the same transaction as
    // deposits/transfers) instead of recomputing totals on every request.
    const snap = await db.collection("users").get();

    let totalUsers = 0;
    let totalBalance = 0;
    let totalTransactionCount = 0;
    let totalTransactionVolume = 0;
    let newUsersToday = 0;
    let transactionsToday = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const allUsers = [];
    const allTransactions = [];

    snap.forEach((doc) => {
      const data = doc.data();
      totalUsers += 1;
      totalBalance += data.balance || 0;
      if (data.createdAt && new Date(data.createdAt) >= startOfToday) newUsersToday += 1;

      allUsers.push({
        uid: doc.id,
        fullName: data.fullName || "",
        email: data.email || "",
        createdAt: data.createdAt || null,
      });

      (data.transactions || []).forEach((tx) => {
        totalTransactionCount += 1;
        totalTransactionVolume += tx.amount || 0;
        if (tx.date && new Date(tx.date) >= startOfToday) transactionsToday += 1;
        allTransactions.push({ ...tx, uid: doc.id, userEmail: data.email });
      });
    });

    allUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      totalUsers,
      totalBalance,
      totalTransactionCount,
      totalTransactionVolume,
      newUsersToday,
      transactionsToday,
      recentUsers: allUsers.slice(0, 5),
      recentTransactions: allTransactions.slice(0, 5),
    });
  } catch (err) {
    console.error("admin/stats error:", err);
    res.status(500).json({ error: "Failed to load stats." });
  }
}
