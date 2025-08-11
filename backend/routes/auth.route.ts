// routes/auth.routes.ts;
import express from "express";
import {
  signup,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getProfile,
  googleAuth,
  appleAuth,
  linkProvider,
  resendVerification,
} from "../controllers/auth.controllers";

import {
  authenticateToken,
  requireVerification,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
// In your auth routes file
router.post("/resend-verification", resendVerification);

// OAuth routes
router.post("/google", googleAuth);
router.post("/apple", appleAuth);

// Protected routes
// Make sure this is how you're using it
router.get("/profile", authenticateToken, getProfile);
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
