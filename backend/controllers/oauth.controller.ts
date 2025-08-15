// controllers/oauth.controller.ts
import { Request, Response } from "express";
import { User } from "../models/user.model";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie";
import {
  GoogleAuthRequestBody,
  AppleAuthRequestBody,
  AuthResponse,
  OAuthUserData,
} from "../types/user.types";
import { verifyGoogleToken, verifyAppleToken } from "../utils/oath.utils";

// Helper function to check if email is super admin
const isSuperAdminEmail = (email: string): boolean => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) {
    console.warn("SUPER_ADMIN_EMAIL environment variable is not set");
    return false;
  }
  return email.toLowerCase() === superAdminEmail.toLowerCase();
};

// Helper function to apply super admin properties
const applySuperAdminProperties = (userDoc: any) => {
  userDoc.userRole = "super_admin";
  userDoc.systemAdminName = process.env.SUPER_ADMIN_NAME;
  userDoc.isSuperAdmin = true;
  userDoc.isAdmin = true;
  userDoc.isVerified = true;
  return userDoc;
};

// Generic OAuth handler
const handleOAuthAuthentication = async (
  provider: "google" | "apple",
  userData: OAuthUserData,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    // Check if super admin email
    const isSuper = isSuperAdminEmail(userData.email);

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { email: userData.email },
        { provider: provider, providerId: userData.providerId },
      ],
    });

    if (user) {
      // User exists, update last login and provider info if needed
      if (user.provider === "credentials") {
        console.log(
          `Linking ${provider} account to existing credentials account: ${user.email}`
        );

        // Link OAuth account to existing email-based account
        user.provider = provider;
        user.providerId = userData.providerId;
        user.isVerified = true; // OAuth users are verified by default
        if (userData.avatar && !user.avatar) {
          user.avatar = userData.avatar;
        }
      }

      // Apply super admin properties if needed and not already set
      if (isSuper && !user.isSuperAdmin) {
        applySuperAdminProperties(user);
      }

      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      console.log(`Creating new ${provider} user: ${userData.email}`);

      user = new User({
        name: userData.name,
        email: userData.email,
        provider: provider,
        providerId: userData.providerId,
        avatar: userData.avatar,
        isVerified: true, // OAuth users are verified by default
        lastLogin: new Date(),
      });

      // Apply super admin properties if needed
      if (isSuper) {
        applySuperAdminProperties(user);
      }

      await user.save();
    }

    // Generate JWT token
    const token = generateTokenAndSetCookie(res, user._id.toString());

    res.status(200).json({
      message: `${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      } authentication successful`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        systemRole: user.systemRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        provider: user.provider,
        lastLogin: user.lastLogin,
      } as any,
      token,
    });
  } catch (error) {
    console.error(`${provider} auth error:`, error);
    res.status(400).json({
      message: `${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      } authentication failed`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const googleAuth = async (
  req: Request<{}, AuthResponse, GoogleAuthRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ message: "Google ID token is required" });
      return;
    }

    // Verify Google token
    const googleUser = await verifyGoogleToken(idToken);

    // Convert to OAuthUserData format
    const userData: OAuthUserData = {
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.avatar || undefined,
      providerId: googleUser.id,
      provider: "google",
    };

    await handleOAuthAuthentication("google", userData, res);
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(400).json({
      message: "Google authentication failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const appleAuth = async (
  req: Request<{}, AuthResponse, AppleAuthRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { idToken, user: appleUserData } = req.body;

    if (!idToken) {
      res.status(400).json({ message: "Apple ID token is required" });
      return;
    }

    // Verify Apple token
    const appleUser = await verifyAppleToken(idToken);

    // Apple sometimes provides user data separately
    let userName = appleUser.name;
    if (appleUserData?.name) {
      userName = `${appleUserData.name.firstName} ${appleUserData.name.lastName}`;
    }

    // Convert to OAuthUserData format
    const userData: OAuthUserData = {
      email: appleUser.email,
      name: userName,
      providerId: appleUser.id,
      provider: "apple",
    };

    await handleOAuthAuthentication("apple", userData, res);
  } catch (error) {
    console.error("Apple auth error:", error);
    res.status(400).json({
      message: "Apple authentication failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const linkProvider = async (
  req: Request & { userId?: string },
  res: Response
): Promise<void> => {
  try {
    const { provider, idToken } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    let providerUser: {
      id: any;
      avatar: any;
      email?: any;
      name?: any;
      emailVerified?: boolean | undefined;
    };

    if (provider === "google") {
      providerUser = await verifyGoogleToken(idToken);
    } else if (provider === "apple") {
      providerUser = await verifyAppleToken(idToken);
    } else {
      res.status(400).json({ message: "Invalid provider" });
      return;
    }

    // Check if provider account is already linked to another user
    const existingUser = await User.findOne({
      provider: provider,
      providerId: providerUser.id,
      _id: { $ne: userId },
    });

    if (existingUser) {
      res
        .status(400)
        .json({ message: "This account is already linked to another user" });
      return;
    }

    // Check if super admin email and apply properties if needed
    const isSuper = isSuperAdminEmail(user.email);
    if (isSuper && !user.isSuperAdmin) {
      applySuperAdminProperties(user);
    }

    // Link the provider account
    user.provider = provider as "google" | "apple";
    user.providerId = providerUser.id;
    if (providerUser.avatar && !user.avatar) {
      user.avatar = providerUser.avatar;
    }
    user.isVerified = true; // Linking OAuth makes account verified
    await user.save();

    res.status(200).json({
      message: `${provider} account linked successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        isVerified: user.isVerified,
        systemRole: user.systemRole,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
      } as any,
    });
  } catch (error) {
    console.error("Link provider error:", error);
    res.status(500).json({ message: "Failed to link provider account" });
  }
};
