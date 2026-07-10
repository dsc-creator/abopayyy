import { auth } from "./firebaseAdmin.js";

/**
 * Verifies the request's Firebase ID token and checks for the `admin`
 * custom claim. Writes an error response and returns null if the request
 * isn't authorized; otherwise returns the decoded token.
 *
 * Usage inside a route handler:
 *   const admin = await requireAdmin(req, res);
 *   if (!admin) return; // response already sent
 */
export async function requireAdmin(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Login required." });
    return null;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (decoded.admin !== true) {
      res.status(403).json({ error: "Admin access required." });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }
}
