import { db } from "../../../_lib/firebaseAdmin.js";
import { requireAdmin } from "../../../_lib/requireAdmin.js";

// Expects each user doc to optionally carry a `kyc` object, written by the
// customer-facing KYC submission flow:
//   kyc: {
//     status: "pending" | "verified" | "rejected",
//     idType: "NIN" | "BVN" | "Drivers License" | "Passport",
//     idNumber: string,
//     idImageUrl: string,
//     selfieUrl: string,
//     submittedAt: ISO string,
//     reviewedAt: ISO string | null,
//     reviewedBy: string | null,   // admin uid
//     note: string | null,
//   }
// Users with no `kyc` field haven't submitted anything yet and are excluded.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const { status = "pending" } = req.query;

    // NOTE: same MVP caveat as /admin/users and /admin/stats — scans the
    // whole users collection in memory. Move to a top-level `kycSubmissions`
    // collection with a `status` field once volume grows, so this becomes a
    // real indexed where() query.
    const snap = await db.collection("users").get();

    const submissions = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (!data.kyc) return;
      if (status !== "all" && data.kyc.status !== status) return;
      submissions.push({
        uid: doc.id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        kyc: data.kyc,
      });
    });

    submissions.sort((a, b) => new Date(b.kyc.submittedAt || 0) - new Date(a.kyc.submittedAt || 0));

    res.status(200).json({ submissions });
  } catch (err) {
    console.error("admin/kyc error:", err);
    res.status(500).json({ error: "Failed to load KYC submissions." });
  }
}
