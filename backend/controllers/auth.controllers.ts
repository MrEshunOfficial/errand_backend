// controllers/auth.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/user.model";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie";
import { sendEmail } from "../utils/sendEmail";
import {
  SignupRequestBody,
  LoginRequestBody,
  ResetPasswordRequestBody,
  VerifyEmailRequestBody,
  UpdatePasswordRequestBody,
  GoogleAuthRequestBody,
  AppleAuthRequestBody,
  AuthResponse,
  UpdateProfileRequestBody,
} from "../types/user.types";
// 🔧 FIX: Correct import path (oauth not oath)
import { verifyGoogleToken, verifyAppleToken } from "../utils/oath.utils.ts";
import {
  getVerificationEmailTemplate,
  getResetPasswordEmailTemplate,
} from "../utils/useEmailTemplate";

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

export const signup = async (
  req: Request<{}, AuthResponse, SignupRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    if (password.length < 6) {
      res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Check if super admin email
    const isSuper = isSuperAdminEmail(email);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      provider: "credentials", // 🔧 ENHANCEMENT: Explicitly set provider
      verificationToken,
      verificationExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Apply super admin properties if needed
    if (isSuper) {
      applySuperAdminProperties(newUser);
    }

    await newUser.save();

    // Send verification email (except for super admin)
    if (!isSuper) {
      try {
        await sendEmail({
          to: email,
          subject: "Verify Your Email Address",
          html: getVerificationEmailTemplate(name, verificationToken),
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue without failing the registration
      }
    } else {
      // Automatically verify super admin
      newUser.isVerified = true;
      newUser.verificationToken = undefined;
      newUser.verificationExpires = undefined;
      await newUser.save();
    }

    // Generate JWT token
    const token = generateTokenAndSetCookie(res, newUser._id.toString());

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        userRole: newUser.userRole,
        isVerified: newUser.isVerified,
        isAdmin: newUser.isAdmin,
        isSuperAdmin: newUser.isSuperAdmin,
        provider: newUser.provider, // 🔧 ENHANCEMENT: Include provider in response
        createdAt: newUser.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (
  req: Request<{}, AuthResponse, LoginRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    // 🔧 ENHANCEMENT: Better provider validation
    if (user.provider !== "credentials") {
      res.status(400).json({
        message:
          "This account uses OAuth authentication. Please use the appropriate login method.",
      });
      return;
    }

    // Check password
    if (!user.password) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    // ✅ CORRECT: Check email verification for credential-based users only
    if (!user.isVerified && !user.isSuperAdmin) {
      res.status(401).json({
        message: "Please verify your email before logging in",
        requiresVerification: true,
        email: user.email,
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateTokenAndSetCookie(res, user._id.toString());

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        provider: user.provider,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
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

    // Check if super admin email
    const isSuper = isSuperAdminEmail(googleUser.email);

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { email: googleUser.email },
        { provider: "google", providerId: googleUser.id },
      ],
    });

    if (user) {
      // User exists, update last login and provider info if needed
      if (user.provider === "credentials") {
        // 🔧 ENHANCEMENT: Better logging for account linking
        console.log(
          `Linking Google account to existing credentials account: ${user.email}`
        );

        // Link Google account to existing email-based account
        user.provider = "google";
        user.providerId = googleUser.id;
        user.isVerified = true; // ✅ OAuth users are verified by default
        if (googleUser.avatar && !user.avatar) {
          user.avatar = googleUser.avatar;
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
      console.log(`Creating new Google user: ${googleUser.email}`);

      user = new User({
        name: googleUser.name,
        email: googleUser.email,
        provider: "google",
        providerId: googleUser.id,
        avatar: googleUser.avatar,
        isVerified: true, // ✅ CORRECT: OAuth users are verified by default
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
      message: "Google authentication successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        provider: user.provider,
        lastLogin: user.lastLogin,
      },
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(400).json({
      message: "Google authentication failed",
      // 🔧 ENHANCEMENT: Better error details for debugging
      // details: error instanceof Error ? error.message : "Unknown error",
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

    // Check if super admin email
    const isSuper = isSuperAdminEmail(appleUser.email);

    // Check if user exists
    let user = await User.findOne({
      $or: [
        { email: appleUser.email },
        { provider: "apple", providerId: appleUser.id },
      ],
    });

    if (user) {
      // User exists, update last login and provider info if needed
      if (user.provider === "credentials") {
        // 🔧 ENHANCEMENT: Better logging for account linking
        console.log(
          `Linking Apple account to existing credentials account: ${user.email}`
        );

        // Link Apple account to existing email-based account
        user.provider = "apple";
        user.providerId = appleUser.id;
        user.isVerified = true; // ✅ OAuth users are verified by default
      }

      // Apply super admin properties if needed and not already set
      if (isSuper && !user.isSuperAdmin) {
        applySuperAdminProperties(user);
      }

      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      console.log(`Creating new Apple user: ${appleUser.email}`);

      user = new User({
        name: userName,
        email: appleUser.email,
        provider: "apple",
        providerId: appleUser.id,
        isVerified: true, // ✅ CORRECT: OAuth users are verified by default
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
      message: "Apple authentication successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        provider: user.provider,
        lastLogin: user.lastLogin,
      },
      token,
    });
  } catch (error) {
    console.error("Apple auth error:", error);
    res.status(400).json({
      message: "Apple authentication failed",
      // 🔧 ENHANCEMENT: Better error details for debugging
      // details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Rest of the functions remain the same...
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyEmail = async (
  req: Request<{}, AuthResponse, VerifyEmailRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ message: "Verification token is required" });
      return;
    }

    // Find user with valid token
    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: new Date() },
    }).select("+verificationToken +verificationExpires");

    if (!user) {
      res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
      return;
    }

    // Update user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendVerification = async (
  req: Request<{}, AuthResponse, { email: string }>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists - security reasons
      res.status(200).json({
        message:
          "If the email exists and is unverified, a verification email has been sent",
      });
      return;
    }

    // Check if user is already verified
    if (user.isVerified) {
      res.status(400).json({ message: "Email is already verified" });
      return;
    }

    // ✅ CORRECT: Check if user is credential-based (not OAuth)
    if (user.provider !== "credentials") {
      res
        .status(400)
        .json({ message: "This account doesn't require email verification" });
      return;
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email Address",
        html: getVerificationEmailTemplate(user.name, verificationToken),
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      res.status(500).json({ message: "Failed to send verification email" });
      return;
    }

    res.status(200).json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (
  req: Request<{}, AuthResponse, ResetPasswordRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(200).json({
        message: "If the email exists, a reset link has been sent",
      });
      return;
    }

    // 🔧 ENHANCEMENT: Check if user uses OAuth (no password to reset)
    if (user.provider !== "credentials") {
      res.status(400).json({
        message:
          "This account uses OAuth authentication and doesn't have a password to reset",
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: getResetPasswordEmailTemplate(user.name, resetToken),
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({ message: "Failed to send reset email" });
      return;
    }

    res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (
  req: Request<{}, AuthResponse, UpdatePasswordRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: "Token and password are required" });
      return;
    }

    if (password.length < 6) {
      res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
      return;
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
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
    user.isVerified = true; // ✅ CORRECT: Linking OAuth makes account verified
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
        userRole: user.userRole,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error("Link provider error:", error);
    res.status(500).json({ message: "Failed to link provider account" });
  }
};

export const getProfile = async (
  req: Request & { userId?: string },
  res: Response
): Promise<void> => {
  try {
    console.log("getProfile called with userId:", req.userId);

    if (!req.userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const user = await User.findById(req.userId);
    console.log("User found in getProfile:", user ? "Yes" : "No");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        provider: user.provider,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateProfile = async (
  req: Request<{}, AuthResponse, UpdateProfileRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const updates = req.body;
    const userId = (req as any).userId;

    // Validate allowed updates
    const allowedUpdates = [
      "name",
      "phone",
      "avatar",
      "address",
      "preferences",
      "bio",
    ];
    const requestedUpdates = Object.keys(updates);
    const isValidUpdate = requestedUpdates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      res.status(400).json({ message: "Invalid updates" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        preferences: user.preferences,
        userRole: user.userRole,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
