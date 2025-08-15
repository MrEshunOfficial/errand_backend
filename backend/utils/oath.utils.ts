// utils/oauth.utils.ts
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { IUser } from "../types/user.types";

// Google OAuth verification
export const verifyGoogleToken = async (idToken: string) => {
  try {
    // Ensure we have the Google Client ID
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
    }

    console.log(
      "Verifying Google token with Client ID:",
      process.env.GOOGLE_CLIENT_ID
    );

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error("Invalid Google token - no payload");
    }

    if (!payload.email) {
      throw new Error("No email found in Google token");
    }

    console.log("Google token verified successfully for:", payload.email);

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || "Google User",
      avatar: payload.picture || null,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    console.error("Google token verification failed:", error);
    throw new Error(
      `Google token verification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// Apple OAuth verification with proper key verification
export const verifyAppleToken = async (idToken: string) => {
  try {
    // Apple's public key endpoint
    const client = jwksClient({
      jwksUri: "https://appleid.apple.com/auth/keys",
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });

    // Decode token header to get the key ID
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid Apple token format");
    }

    const { header, payload } = decoded;

    if (!header.kid) {
      throw new Error("No key ID found in Apple token header");
    }

    // Get the signing key
    const key = await client.getSigningKey(header.kid);
    const signingKey = key.getPublicKey();

    // Verify the token
    const verifiedPayload = jwt.verify(idToken, signingKey, {
      algorithms: ["RS256"],
      audience: process.env.APPLE_CLIENT_ID, // Your Apple service ID
      issuer: "https://appleid.apple.com",
    }) as any;

    console.log(
      "Apple token verified successfully for:",
      verifiedPayload.email
    );

    return {
      id: verifiedPayload.sub,
      email: verifiedPayload.email,
      name: verifiedPayload.name || "Apple User",
      avatar: null,
      emailVerified:
        verifiedPayload.email_verified === "true" ||
        verifiedPayload.email_verified === true,
    };
  } catch (error) {
    console.error("Apple token verification failed:", error);
    throw new Error(
      `Apple token verification failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// Fallback Apple verification for development (less secure)
export const verifyAppleTokenDev = async (idToken: string) => {
  try {
    console.warn(
      "Using development Apple token verification - not recommended for production"
    );

    // For development only - decode without verification
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid Apple token");
    }

    const payload = decoded.payload as any;

    return {
      id: payload.sub,
      email: payload.email || `apple_${payload.sub}@privaterelay.appleid.com`,
      name: payload.name || "Apple User",
      avatar: null,
      emailVerified:
        payload.email_verified === "true" || payload.email_verified === true,
    };
  } catch (error) {
    console.error("Apple token verification failed:", error);
    throw new Error("Apple token verification failed");
  }
};

// Generate username from email for OAuth users
export const generateUsernameFromEmail = (email: string): string => {
  return email.split("@")[0] + Math.random().toString(36).substring(2, 6);
};

// utils/auth.utils.ts

/**
 * Check if email is super admin
 */
export const isSuperAdminEmail = (email: string): boolean => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) {
    return false;
  }
  return email.toLowerCase() === superAdminEmail.toLowerCase();
};

/**
 * Apply super admin properties to user document
 */
export const applySuperAdminProperties = (userDoc: IUser) => {
  userDoc.systemRole = "super_admin";
  userDoc.systemAdminName = process.env.SUPER_ADMIN_NAME;
  userDoc.isSuperAdmin = true;
  userDoc.isAdmin = true;
  userDoc.isVerified = true;
  return userDoc;
};

/**
 * Create a standardized user response object
 */
export const createUserResponse = (user: IUser) => {
  return { ...user };
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): string | null => {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  return null;
};
