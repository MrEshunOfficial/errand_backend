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

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// OAuth authentication routes
router.post("/google", googleAuth);
router.post("/apple", appleAuth);

// Protected OAuth routes (requires authentication)
router.post("/link-provider", authenticateToken, linkProvider);

// User info and authentication status routes
router.get("/me", authenticateToken, (req, res) => {
  // Get current authenticated user's profile
  res.json({
    message: "User profile retrieved successfully",
    user: req.user,
    userId: req.userId,
  });
});

router.get("/status", authenticateToken, (req, res) => {
  // Check authentication status - used by frontend for auth state
  res.json({
    isAuthenticated: true,
    user: req.user
      ? {
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
        }
      : null,
  });
});

// Access level validation routes (for role-based access control)
router.get(
  "/verify-access/verified",
  authenticateToken,
  requireVerification,
  (req, res) => {
    // Validate user has verified email - used before accessing verified-only features
    res.json({
      message: "User has verified email access",
      verified: true,
      user: {
        id: req.user?._id,
        email: req.user?.email,
        isVerified: req.user?.isVerified,
      },
    });
  }
);

router.get(
  "/verify-access/admin",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    // Validate admin access - used before showing admin dashboard/features
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
  }
);

router.get(
  "/verify-access/super-admin",
  authenticateToken,
  requireSuperAdmin,
  (req, res) => {
    // Validate super admin access - used before showing system admin features
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
  }
);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    message: "Auth service is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
