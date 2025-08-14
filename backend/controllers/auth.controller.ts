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
  ResendVerificationRequestBody,
  AuthResponse,
  IUser,
} from "../types/user.types";

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
      provider: "credentials",
      verificationToken,
      verificationExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      lastLogin: new Date(),
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
        provider: newUser.provider,
        lastLogin: newUser.lastLogin,
        createdAt: newUser.createdAt,
      } as any,
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

    // Check if user uses credentials provider
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

    // Check email verification for credential-based users only
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
      } as unknown as IUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

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
      } as any,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendVerification = async (
  req: Request<{}, AuthResponse, ResendVerificationRequestBody>,
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

    // Check if user is credential-based (not OAuth)
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

    // Check if user uses OAuth (no password to reset)
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
