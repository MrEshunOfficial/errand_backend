// utils/oauth.utils.ts
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

// Google OAuth verification
export const verifyGoogleToken = async (idToken: string) => {
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid Google token");
    }

    return {
      id: payload.sub,
      email: payload.email!,
      name: payload.name!,
      avatar: payload.picture,
      emailVerified: payload.email_verified,
    };
  } catch (error) {
    throw new Error("Google token verification failed");
  }
};

// Apple OAuth verification
export const verifyAppleToken = async (idToken: string) => {
  try {
    // Apple uses JWT tokens that need to be verified against Apple's public keys
    // This is a simplified version - in production, you'd fetch Apple's public keys
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid Apple token");
    }

    const payload = decoded.payload as any;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || "Apple User",
      avatar: null,
      emailVerified: payload.email_verified === "true",
    };
  } catch (error) {
    throw new Error("Apple token verification failed");
  }
};

// Generate username from email for OAuth users
export const generateUsernameFromEmail = (email: string): string => {
  return email.split("@")[0] + Math.random().toString(36).substring(2, 6);
};
