import { adminAuth } from "./firebase-admin";

/**
 * Retrieves the authenticated user from the Request headers.
 * Expects an Authorization header: "Bearer <Firebase_ID_Token>"
 * 
 * @param {Request} req Next.js request object
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken | null>} The decoded user token or null if unauthenticated.
 */
export async function getAuthUser(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.split("Bearer ")[1];
    if (!adminAuth) {
      console.warn("Firebase Admin Auth not initialized.");
      return null;
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("getAuthUser verification error:", error);
    return null;
  }
}
