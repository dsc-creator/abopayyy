import { db } from "../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../_lib/requireAdmin.js";

// Powers Sales Stats + Profit & Loss. Same MVP scan-the-users-collection
// approach as /admin/stats. "Profit" here = total transaction volume
// (a rough revenue proxy) minus manually-logged expenses (see /admin/expenses)
// — there's no real fee-tracking system yet, so treat this as directional,
// not exact accounting.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { days = "30" } = req.query;
    const windowDays = Math.min(Number(days) || 30, 90);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (windowDays - 1));

    const buckets = {}; // "YYYY-MM-DD" -> { credit, debit, count }
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      buckets[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), credit: 0, debit: 0, count: 0 };
    }

    const snap = await db.collection("users").get();
    let totalCreditVolume = 0;
    let totalDebitVolume = 0;
    let totalCount = 0;

    snap.forEach((doc) => {
      (doc.data().transactions || []).forEach((tx) => {
        const txDate = new Date(tx.date);
        if (isNaN(txDate) || txDate < since) return;
        const key = txDate.toISOString().slice(0, 10);
        if (!buckets[key]) return;
        buckets[key].count += 1;
        totalCount += 1;
        if (tx.type === "credit") {
          buckets[key].credit += tx.amount || 0;
          totalCreditVolume += tx.amount || 0;
        } else {
          buckets[key].debit += tx.amount || 0;
          totalDebitVolume += tx.amount || 0;
        }
      });
    });

    const expensesSnap = await db
      .collection("expenses")
      .where("date", ">=", since.toISOString())
      .get();
    let totalExpenses = 0;
    const expenses = [];
    expensesSnap.forEach((d) => {
      const data = d.data();
      totalExpenses += data.amount || 0;
      expenses.push({ id: d.id, ...data });
    });
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      series: Object.values(buckets),
      totals: {
        totalCreditVolume,
        totalDebitVolume,
        totalCount,
        totalExpenses,
        netProfit: totalCreditVolume - totalDebitVolume - totalExpenses,
      },
      expenses,
    });
  } catch (err) {
    console.error("admin/finance error:", err);
    res.status(500).json({ error: err.message || "Failed to load finance data." });
  }
}
