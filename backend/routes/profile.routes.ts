// routes/profile.routes.ts
import express, { Response } from "express";
import {
  getProfile,
  updateProfile,
  updateProfileRole,
  updateProfileLocation,
  getProfileCompleteness,
  getProfileWithContext,
  batchProfileOperations,
  requireProfileRole,
  attachProfile,
} from "../controllers/profile.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { UserRole, AuthenticatedRequest } from "../types/user.types.js";

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// Basic profile routes
router.get("/", getProfile as any);
router.put("/", updateProfile as any);

// Profile completeness and context routes
router.get("/completeness", getProfileCompleteness as any);
router.get("/with-context", getProfileWithContext as any);
router.get("/batch-operations", batchProfileOperations as any);

// Specific profile update routes
router.patch("/role", updateProfileRole as any);
router.patch("/location", updateProfileLocation as any);

// Role-based access routes (business logic roles only)
router.get(
  "/client-dashboard",
  requireProfileRole(UserRole.CUSTOMER),
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message: "Welcome to client dashboard",
      profile: req.profile,
    });
  }
);

router.get(
  "/provider-dashboard",
  requireProfileRole(UserRole.PROVIDER),
  (req: AuthenticatedRequest, res: Response) => {
    res.json({
      message: "Welcome to service provider dashboard",
      profile: req.profile,
    });
  }
);

// Routes that need profile context but don't require specific roles
router.get(
  "/context-aware",
  attachProfile,
  (req: AuthenticatedRequest, res: Response) => {
    const profile = req.profile;
    res.json({
      message: "Route with profile context",
      hasProfile: !!profile,
      profileRole: profile?.role || null,
    });
  }
);

export default router;
