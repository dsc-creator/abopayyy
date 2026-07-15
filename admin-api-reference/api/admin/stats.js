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
    let todaysDeposits = 0;
    let monthlyDeposits = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

    const activeUidsToday = new Set();
    const allUsers = [];
    const allTransactions = [];

    // 7-day revenue-vs-failed buckets, oldest first
    const dayBuckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      dayBuckets[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), revenue: 0, failed: 0 };
    }
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

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
        const txDate = tx.date ? new Date(tx.date) : null;

        if (txDate && txDate >= startOfToday) {
          transactionsToday += 1;
          activeUidsToday.add(doc.id);
          if (tx.type === "credit") todaysDeposits += tx.amount || 0;
        }
        if (txDate && txDate >= startOfMonth && tx.type === "credit") {
          monthlyDeposits += tx.amount || 0;
        }
        if (txDate && txDate >= sevenDaysAgo && tx.type === "credit") {
          const key = txDate.toISOString().slice(0, 10);
          if (dayBuckets[key]) dayBuckets[key].revenue += tx.amount || 0;
        }

        allTransactions.push({ ...tx, uid: doc.id, userEmail: data.email });
      });
    });

    // Failed attempts — written by logFailedTransaction() in functions/index.js
    // whenever a transfer/airtime/data/bill purchase fails after the balance
    // check passes (see functions/index.js for the exact call sites).
    let failedTransactionsToday = 0;
    const failedSnap = await db
      .collection("failedTransactions")
      .where("timestamp", ">=", sevenDaysAgo.toISOString())
      .get();
    failedSnap.forEach((doc) => {
      const data = doc.data();
      const ts = new Date(data.timestamp);
      if (ts >= startOfToday) failedTransactionsToday += 1;
      const key = ts.toISOString().slice(0, 10);
      if (dayBuckets[key]) dayBuckets[key].failed += data.amount || 0;
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
      // Successful == recorded transactions today, since a failed attempt
      // never gets written into a user's `transactions` array (it only
      // lands in `failedTransactions` — see functions/index.js).
      successfulTransactionsToday: transactionsToday,
      failedTransactionsToday,
      activeUsersToday: activeUidsToday.size,
      todaysDeposits,
      monthlyDeposits,
      revenueVsFailed: Object.values(dayBuckets),
      recentUsers: allUsers.slice(0, 5),
      recentTransactions: allTransactions.slice(0, 5),
    });
  } catch (err) {
    console.error("admin/stats error:", err);
    res.status(500).json({ error: err.message || "Failed to load stats." });
  }
}
