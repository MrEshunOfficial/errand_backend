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

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-verification", resendVerification);

// OAuth routes
router.post("/google", googleAuth);
router.post("/apple", appleAuth);

// Protected routes
router.post("/link-provider", authenticateToken, linkProvider);

// Routes requiring verification
router.get("/verified", authenticateToken, requireVerification, (req, res) => {
  res.json({ message: "Access granted to verified users" });
});

// Admin routes
router.get("/admin", authenticateToken, requireAdmin, (req, res) => {
  res.json({ message: "Access granted to admins" });
});

// Super admin routes
router.get(
  "/system-admin",
  authenticateToken,
  requireSuperAdmin,
  (req, res) => {
    res.json({ message: "Access granted to super admins" });
  }
);

export default router;

