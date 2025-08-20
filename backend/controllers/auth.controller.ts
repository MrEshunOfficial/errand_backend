// controllers/auth.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Types } from "mongoose";
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
  AuthenticatedRequest,
} from "../types/user.types";
import {
  SystemRole,
  UserStatus,
  ModerationStatus,
  AuthProvider,
} from "../types/base.types";
import {
  getVerificationEmailTemplate,
  getResetPasswordEmailTemplate,
} from "../utils/useEmailTemplate";
import { isSuperAdminEmail, applySuperAdminProperties } from "../utils/controller-utils/controller.utils";

// Helper functions to reduce repetition
const sendErrorResponse = (res: Response, status: number, message: string) => {
  res.status(status).json({ message });
};

const sendSuccessResponse = (res: Response, status: number, message: string, data?: any) => {
  res.status(status).json({ message, ...data });
};

const validateRequired = (fields: Record<string, any>, res: Response): boolean => {
  const missing = Object.entries(fields).find(([_, value]) => !value);
  if (missing) {
    sendErrorResponse(res, 400, `${missing[0]} is required`);
    return false;
  }
  return true;
};

const validatePassword = (password: string, res: Response): boolean => {
  if (password.length < 6) {
    sendErrorResponse(res, 400, "Password must be at least 6 characters long");
    return false;
  }
  return true;
};

const updateUserSecurity = (user: any, updates: Record<string, any>) => {
  if (!user.security) user.security = {};
  Object.assign(user.security, updates);
};

const getUserResponse = (user: any) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  systemRole: user.systemRole,
  isVerified: user.isVerified,
  isAdmin: user.isAdmin,
  isSuperAdmin: user.isSuperAdmin,
  provider: user.provider,
  avatar: user.avatar,
  lastLogin: user.lastLogin,
  status: user.status,
  security: user.security,
  moderation: user.moderation,
  createdAt: user.createdAt,
});

const handleAsync = (fn: Function) => async (req: Request, res: Response) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(`Controller error:`, error);
    sendErrorResponse(res, 500, "Internal server error");
  }
};

// AUTHENTICATION METHODS
export const signup = handleAsync(async (req: Request<{}, AuthResponse, SignupRequestBody>, res: Response<AuthResponse>) => {
  const { name, email, password } = req.body;

  if (!validateRequired({ name, email, password }, res) || !validatePassword(password, res)) return;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) return sendErrorResponse(res, 400, "User already exists");

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const isSuper = isSuperAdminEmail(email);

  const newUser = new User({
    name: name.trim(),
    email: email.toLowerCase(),
    password: hashedPassword,
    provider: AuthProvider.CREDENTIALS,
    verificationToken,
    verificationExpires: new Date(Date.now() + 60 * 60 * 1000),
    lastLogin: new Date(),
    security: { lastLoginAt: new Date() },
  });

  if (isSuper) {
    applySuperAdminProperties(newUser);
    newUser.isVerified = true;
    newUser.verificationToken = undefined;
    newUser.verificationExpires = undefined;
  }

  await newUser.save();

  // Send verification email for non-super admins
  if (!isSuper) {
    try {
      await sendEmail({
        to: email,
        subject: "Verify Your Email Address",
        html: getVerificationEmailTemplate(name, verificationToken),
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }
  }

  const token = generateTokenAndSetCookie(res, newUser._id.toString());

  sendSuccessResponse(res, 201, "User created successfully", {
    user: getUserResponse(newUser),
    token,
  });
});

export const login = handleAsync(async (req: Request<{}, AuthResponse, LoginRequestBody>, res: Response<AuthResponse>) => {
  const { email, password } = req.body;

  if (!validateRequired({ email, password }, res)) return;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || user.provider !== AuthProvider.CREDENTIALS || !user.password) {
    return sendErrorResponse(res, 400, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return sendErrorResponse(res, 400, "Invalid email or password");

  if (!user.isVerified && !user.isSuperAdmin) {
    return res.status(401).json({
      message: "Please verify your email before logging in",
      requiresVerification: true,
      email: user.email,
    });
  }

  user.lastLogin = new Date();
  updateUserSecurity(user, { lastLoginAt: new Date() });
  await user.save();

  const token = generateTokenAndSetCookie(res, user._id.toString());

  sendSuccessResponse(res, 200, "Login successful", {
    user: getUserResponse(user),
    token,
  });
});

export const logout = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  if (userId) {
    try {
      const user = await User.findById(userId);
      if (user) {
        updateUserSecurity(user, { lastLoggedOut: new Date() });
        await user.save();
      }
    } catch (updateError) {
      console.error("Failed to update logout timestamp:", updateError);
    }
  }

  res.clearCookie("token");
  sendSuccessResponse(res, 200, "Logout successful");
});

// EMAIL VERIFICATION METHODS
export const verifyEmail = handleAsync(async (req: Request<{}, AuthResponse, VerifyEmailRequestBody>, res: Response<AuthResponse>) => {
  const { token } = req.body;

  if (!validateRequired({ token }, res)) return;

  const user = await User.findOne({
    verificationToken: token,
    verificationExpires: { $gt: new Date() },
  }).select("+verificationToken +verificationExpires");

  if (!user) return sendErrorResponse(res, 400, "Invalid or expired verification token");

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save();

  sendSuccessResponse(res, 200, "Email verified successfully", {
    user: getUserResponse(user),
  });
});

export const resendVerification = handleAsync(async (req: Request<{}, AuthResponse, ResendVerificationRequestBody>, res: Response<AuthResponse>) => {
  const { email } = req.body;

  if (!validateRequired({ email }, res)) return;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return sendSuccessResponse(res, 200, "If the email exists and is unverified, a verification email has been sent");
  }

  if (user.isVerified) return sendErrorResponse(res, 400, "Email is already verified");
  if (user.provider !== AuthProvider.CREDENTIALS) {
    return sendErrorResponse(res, 400, "This account doesn't require email verification");
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  user.verificationToken = verificationToken;
  user.verificationExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  try {
    await sendEmail({
      to: user.email,
      subject: "Verify Your Email Address",
      html: getVerificationEmailTemplate(user.name, verificationToken),
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return sendErrorResponse(res, 500, "Failed to send verification email");
  }

  sendSuccessResponse(res, 200, "Verification email sent successfully");
});

// PASSWORD MANAGEMENT METHODS
export const forgotPassword = handleAsync(async (req: Request<{}, AuthResponse, ResetPasswordRequestBody>, res: Response<AuthResponse>) => {
  const { email } = req.body;

  if (!validateRequired({ email }, res)) return;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return sendSuccessResponse(res, 200, "If the email exists, a reset link has been sent");
  }

  if (user.provider !== AuthProvider.CREDENTIALS) {
    return sendErrorResponse(res, 400, "This account uses OAuth authentication and doesn't have a password to reset");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

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
    return sendErrorResponse(res, 500, "Failed to send reset email");
  }

  sendSuccessResponse(res, 200, "Password reset link sent to your email");
});

export const resetPassword = handleAsync(async (req: Request<{}, AuthResponse, UpdatePasswordRequestBody>, res: Response<AuthResponse>) => {
  const { token, password } = req.body;

  if (!validateRequired({ token, password }, res) || !validatePassword(password, res)) return;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) return sendErrorResponse(res, 400, "Invalid or expired reset token");

  const hashedPassword = await bcrypt.hash(password, 12);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  updateUserSecurity(user, { passwordChangedAt: new Date() });
  await user.save();

  sendSuccessResponse(res, 200, "Password reset successful");
});

export const changePassword = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  if (!validateRequired({ currentPassword, newPassword }, res) || !validatePassword(newPassword, res)) return;

  const user = await User.findById(userId).select("+password");
  if (!user) return sendErrorResponse(res, 404, "User not found");

  if (user.provider !== AuthProvider.CREDENTIALS || !user.password) {
    return sendErrorResponse(res, 400, "Password change not available for OAuth accounts");
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) return sendErrorResponse(res, 400, "Current password is incorrect");

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  updateUserSecurity(user, { passwordChangedAt: new Date() });
  await user.save();

  sendSuccessResponse(res, 200, "Password changed successfully");
});

// TOKEN MANAGEMENT
export const refreshToken = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  const token = generateTokenAndSetCookie(res, user._id.toString());

  sendSuccessResponse(res, 200, "Token refreshed successfully", {
    user: getUserResponse(user),
    token,
  });
});

// ACCOUNT MANAGEMENT
export const deleteAccount = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  await user.softDelete();
  res.clearCookie("token");

  sendSuccessResponse(res, 200, "Account deleted successfully");
});

export const restoreAccount = handleAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!validateRequired({ email }, res)) return;

  const user = await User.findOne({ email: email.toLowerCase() }, null, { includeSoftDeleted: true });
  if (!user || !user.isDeleted) return sendErrorResponse(res, 404, "Deleted account not found");

  await user.restore();

  sendSuccessResponse(res, 200, "Account restored successfully", {
    user: getUserResponse(user),
  });
});

// ADMIN METHODS
const requireAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
  const user = req.user;
  if (!user?.isAdmin) {
    sendErrorResponse(res, 403, "Admin access required");
    return false;
  }
  return true;
};

const requireSuperAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
  const user = req.user;
  if (!user?.isSuperAdmin) {
    sendErrorResponse(res, 403, "Super admin access required");
    return false;
  }
  return true;
};

export const getAllUsers = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { page = 1, limit = 10, search, status, role } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  if (status) query.status = status;
  if (role) query.systemRole = role;

  const [users, total] = await Promise.all([
    User.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  sendSuccessResponse(res, 200, "Users retrieved successfully", {
    users: users.map(getUserResponse),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
});

export const updateUserRole = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const { userId } = req.params;
  const { systemRole } = req.body;

  if (!validateRequired({ systemRole }, res)) return;

  if (!Object.values(SystemRole).includes(systemRole)) {
    return sendErrorResponse(res, 400, "Invalid system role");
  }

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  user.systemRole = systemRole;
  await user.save();

  sendSuccessResponse(res, 200, "User role updated successfully", {
    user: getUserResponse(user),
  });
});

export const updateUserStatus = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const { status, reason } = req.body;
  const adminId = req.userId;

  if (!validateRequired({ status }, res)) return;

  if (!Object.values(UserStatus).includes(status)) {
    return sendErrorResponse(res, 400, "Invalid user status");
  }

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  user.status = status;
  if (!user.moderation) user.moderation = {} as any;
  user.moderation.statusChangedBy = new Types.ObjectId(adminId);
  user.moderation.statusChangedAt = new Date();
  if (reason) user.moderation.statusReason = reason;

  await user.save();

  sendSuccessResponse(res, 200, "User status updated successfully", {
    user: getUserResponse(user),
  });
});

export const moderateUser = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const { moderationStatus, notes, warningsCount } = req.body;
  const adminId = req.userId;

  if (!validateRequired({ moderationStatus }, res)) return;

  if (!Object.values(ModerationStatus).includes(moderationStatus)) {
    return sendErrorResponse(res, 400, "Invalid moderation status");
  }

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  if (!user.moderation) user.moderation = {} as any;
  user.moderation.moderationStatus = moderationStatus;
  user.moderation.lastModeratedBy = new Types.ObjectId(adminId);
  user.moderation.lastModeratedAt = new Date();
  if (notes) user.moderation.moderationNotes = notes;
  if (typeof warningsCount === 'number') user.moderation.warningsCount = warningsCount;

  await user.save();

  sendSuccessResponse(res, 200, "User moderated successfully", {
    user: getUserResponse(user),
  });
});

export const getUserById = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  sendSuccessResponse(res, 200, "User retrieved successfully", {
    user: getUserResponse(user),
  });
});

export const deleteUser = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const { userId } = req.params;
  const adminId = req.userId;

  const user = await User.findById(userId);
  if (!user) return sendErrorResponse(res, 404, "User not found");

  await user.softDelete(adminId);

  sendSuccessResponse(res, 200, "User deleted successfully");
});

export const restoreUser = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const { userId } = req.params;

  const user = await User.findById(userId, null, { includeSoftDeleted: true });
  if (!user || !user.isDeleted) return sendErrorResponse(res, 404, "Deleted user not found");

  await user.restore();

  sendSuccessResponse(res, 200, "User restored successfully", {
    user: getUserResponse(user),
  });
});

export const getModerationStats = handleAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const stats = await User.aggregate([
    {
      $group: {
        _id: "$moderation.moderationStatus",
        count: { $sum: 1 }
      }
    }
  ]);

  const userStatusStats = await User.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  sendSuccessResponse(res, 200, "Moderation stats retrieved successfully", {
    moderationStats: stats,
    userStatusStats,
  });
});