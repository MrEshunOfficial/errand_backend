// routes/profile.routes.ts
import express from "express";
import {
  getProfile,
  updateProfile,
  updateProfileRole,
  updateProfileLocation,
  getProfileCompleteness,
  requireProfileRole,
  attachProfile,
} from "../controllers/profile.controller.js"; // Added .js extension
import { authenticateToken } from "../middleware/auth.middleware.js"; // Added .js extension
import { UserRole } from "../types/user.types.js"; // Added .js extension

const router = express.Router();

// All profile routes require authentication - this applies the middleware to all routes below
router.use(authenticateToken);

// Basic profile routes
router.get("/", getProfile);
router.put("/", updateProfile);
router.get("/completeness", getProfileCompleteness);

// Specific profile update routes
router.patch("/role", updateProfileRole);
router.patch("/location", updateProfileLocation);

// Role-based access routes
router.get(
  "/client-dashboard",
  requireProfileRole(UserRole.CUSTOMER),
  (req, res) => {
    res.json({
      message: "Welcome to client dashboard",
      profile: (req as any).profile,
    });
  }
);

router.get(
  "/provider-dashboard",
  requireProfileRole(UserRole.PROVIDER),
  (req, res) => {
    res.json({
      message: "Welcome to service provider dashboard",
      profile: (req as any).profile,
    });
  }
);

// Admin profile routes
router.get(
  "/admin-profiles",
  requireProfileRole(UserRole.ADMIN),
  (req, res) => {
    res.json({ message: "Admin access to all profiles" });
  }
);

// Routes that might need profile context but don't require specific roles
router.get("/with-context", attachProfile, (req, res) => {
  const profile = (req as any).profile;
  res.json({
    message: "Route with profile context",
    hasProfile: !!profile,
    profileRole: profile?.role || null,
  });
});

export default router;
