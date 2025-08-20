// routes/auth.routes.ts
import express from "express";
import {
  authenticateToken,
  requireVerification,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.middleware";
import {
  signup,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
  changePassword,
  refreshToken,
  deleteAccount,
  restoreAccount,
  // Admin methods
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  moderateUser,
  getUserById,
  deleteUser,
  restoreUser,
  getModerationStats,
} from "../controllers/auth.controller";
import {
  googleAuth,
  appleAuth,
  linkProvider,
} from "../controllers/oauth.controller";

const router = express.Router();

// Public authentication routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

// Email verification routes
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Password management routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authenticateToken, changePassword);

// OAuth authentication routes
router.post("/google", googleAuth);
router.post("/apple", appleAuth);
router.post("/link-provider", authenticateToken, linkProvider);

// Token management
router.post("/refresh-token", authenticateToken, refreshToken);

// Account management routes
router.delete("/account", authenticateToken, deleteAccount);
router.post("/restore-account", restoreAccount);

// User profile routes
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    message: "User profile retrieved successfully",
    user: req.user,
    userId: req.userId,
  });
});

router.get("/status", authenticateToken, (req, res) => {
  res.json({
    isAuthenticated: true,
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isVerified: req.user.isVerified,
      isAdmin: req.user.isAdmin,
      isSuperAdmin: req.user.isSuperAdmin,
      systemRole: req.user.systemRole,
      provider: req.user.provider,
      avatar: req.user.avatar,
      lastLogin: req.user.lastLogin,
      status: req.user.status,
    } : null,
  });
});

// Access verification routes (simplified)
router.get("/verify-access/verified", authenticateToken, requireVerification, (req, res) => {
  res.json({
    message: "User has verified email access",
    verified: true,
    user: {
      id: req.user?._id,
      email: req.user?.email,
      isVerified: req.user?.isVerified,
    },
  });
});

router.get("/verify-access/admin", authenticateToken, requireAdmin, (req, res) => {
  res.json({
    message: "User has admin access",
    isAdmin: true,
    user: {
      id: req.user?._id,
      name: req.user?.name,
      email: req.user?.email,
      isAdmin: req.user?.isAdmin,
      systemRole: req.user?.systemRole,
    },
  });
});

router.get("/verify-access/super-admin", authenticateToken, requireSuperAdmin, (req, res) => {
  res.json({
    message: "User has super admin access",
    isSuperAdmin: true,
    user: {
      id: req.user?._id,
      name: req.user?.name,
      email: req.user?.email,
      isSuperAdmin: req.user?.isSuperAdmin,
      systemRole: req.user?.systemRole,
      systemAdminName: req.user?.systemAdminName,
    },
  });
});

// Admin routes - User management
router.get("/admin/users", authenticateToken, requireAdmin, getAllUsers);
router.get("/admin/users/:userId", authenticateToken, requireAdmin, getUserById);
router.patch("/admin/users/:userId/status", authenticateToken, requireAdmin, updateUserStatus);
router.patch("/admin/users/:userId/moderate", authenticateToken, requireAdmin, moderateUser);
router.get("/admin/stats/moderation", authenticateToken, requireAdmin, getModerationStats);

// Super Admin routes
router.patch("/admin/users/:userId/role", authenticateToken, requireSuperAdmin, updateUserRole);
router.delete("/admin/users/:userId", authenticateToken, requireSuperAdmin, deleteUser);
router.post("/admin/users/:userId/restore", authenticateToken, requireSuperAdmin, restoreUser);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    message: "Auth service is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;