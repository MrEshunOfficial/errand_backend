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
export const getVerificationEmailTemplate = (
  name: string,
  token: string
): string => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h2 style="color: #333;">Welcome to Our Platform, ${name}!</h2>
      <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
      <p><small>This verification link will expire in 1 hour.</small></p>
    </div>
  `;
};

export const getResetPasswordEmailTemplate = (
  name: string,
  token: string
): string => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
      <p><small>This reset link will expire in 1 hour. If you didn't request this, please ignore this email.</small></p>
    </div>
  `;
};
