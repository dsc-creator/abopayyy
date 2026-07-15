import { requireAdmin } from "../../_lib/requireAdmin.js";

// Checks the live balance on your upstream providers — VTpass (airtime/data/
// bills) and Paystack (deposits/transfers). Needs its own env vars on this
// backend (separate from the Cloud Functions secrets in functions/index.js,
// since this runs on a different deployment):
//   VTPASS_API_KEY, VTPASS_SECRET_KEY  (sandbox or live, matching functions/index.js)
//   PAYSTACK_SECRET_KEY
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const result = { vtpass: null, paystack: null, errors: [] };

  try {
    if (process.env.VTPASS_API_KEY && process.env.VTPASS_SECRET_KEY) {
      const vtRes = await fetch("https://sandbox.vtpass.com/api/balance", {
        headers: {
          "api-key": process.env.VTPASS_API_KEY,
          "secret-key": process.env.VTPASS_SECRET_KEY,
        },
      });
      const vtData = await vtRes.json();
      result.vtpass = { balance: vtData?.contents?.balance ?? null, raw: vtData?.response_description };
    } else {
      result.errors.push("VTPASS_API_KEY / VTPASS_SECRET_KEY not configured on this backend.");
    }
  } catch (err) {
    result.errors.push("Failed to reach VTpass: " + err.message);
  }

  try {
    if (process.env.PAYSTACK_SECRET_KEY) {
      const psRes = await fetch("https://api.paystack.co/balance", {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      const psData = await psRes.json();
      if (psData?.status) {
        result.paystack = (psData.data || []).map((b) => ({ currency: b.currency, balance: b.balance / 100 }));
      } else {
        result.errors.push(psData?.message || "Paystack balance check not available on this account.");
      }
    } else {
      result.errors.push("PAYSTACK_SECRET_KEY not configured on this backend.");
    }
  } catch (err) {
    result.errors.push("Failed to reach Paystack: " + err.message);
  }

  res.status(200).json(result);
}
