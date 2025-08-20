// routes/providerProfile.routes.ts
import express from "express";
import { 
  authenticateToken, 
  requireAdmin,
  requireSuperAdmin 
} from "../middleware/auth.middleware.js";
import ProviderProfileController from "../controllers/providerProfile.controller.js";

const router = express.Router();

// ===================================================================
// PUBLIC PROVIDER PROFILE ROUTES - NO AUTHENTICATION REQUIRED
// ===================================================================
// CRITICAL: These routes must come BEFORE router.use(authenticateToken)

// Public provider search and discovery - MOST SPECIFIC FIRST
router.get("/public/search", ProviderProfileController.searchPublicProviders);
router.get("/public/browse", ProviderProfileController.getPublicProviderProfiles);

// Public individual provider profile - PARAMETERIZED ROUTES LAST
router.get("/public/:id", ProviderProfileController.getPublicProviderProfile);

// ===================================================================
// AUTHENTICATION REQUIRED FOR ALL ROUTES BELOW
// ===================================================================
router.use(authenticateToken);

// ===================================================================
// CURRENT USER'S PROVIDER PROFILE ROUTES - SPECIFIC ROUTES FIRST
// ===================================================================
router.post("/", ProviderProfileController.createProviderProfile as any);
router.get("/", ProviderProfileController.getMyProviderProfile as any);
router.put("/", ProviderProfileController.updateMyProviderProfile as any);

// ===================================================================
// CURRENT USER'S PROVIDER SUB-RESOURCE MANAGEMENT - SPECIFIC NESTED ROUTES
// ===================================================================
router.patch("/toggle-availability", ProviderProfileController.toggleMyAvailability as any);
router.post("/service-offerings", ProviderProfileController.addMyServiceOffering as any);
router.delete("/service-offerings", ProviderProfileController.removeMyServiceOffering as any);
router.patch("/working-hours", ProviderProfileController.updateMyWorkingHours as any);

// ===================================================================
// PROVIDER STATISTICS AND ANALYTICS ROUTES (Super Admin only)
// ===================================================================
// CRITICAL: These MUST come before any parameterized routes
router.get("/statistics", requireSuperAdmin, ProviderProfileController.getProviderStatistics);

// ===================================================================
// PROVIDER DISCOVERY AND FILTERING ROUTES (Admin only)
// ===================================================================
// SPECIFIC DISCOVERY ROUTES - Before parameterized routes
router.get("/all", requireAdmin, ProviderProfileController.getAllProviderProfiles);
router.get("/available", requireAdmin, ProviderProfileController.getAvailableProviders);
router.get("/top-rated", requireAdmin, ProviderProfileController.getTopRatedProviders);
router.get("/high-risk", requireAdmin, ProviderProfileController.getHighRiskProviders);
router.get("/overdue-assessments", requireAdmin, ProviderProfileController.getOverdueRiskAssessments);

// ===================================================================
// PROVIDER BULK OPERATIONS (Super Admin only)
// ===================================================================
// BULK ROUTES - Before individual parameterized routes
router.patch(
  "/bulk/risk-assessments",
  requireSuperAdmin,
  ProviderProfileController.bulkUpdateRiskAssessments
);

// ===================================================================
// PROVIDER ROUTES BY SPECIFIC PATTERNS (Admin only)
// ===================================================================
// SPECIFIC PATTERN ROUTES - Before generic :id routes
router.get(
  "/by-profile/:profileId",
  requireAdmin,
  ProviderProfileController.getProviderProfileByProfileId
);

// Filter by status and risk level
router.get(
  "/by-status/:status",
  requireAdmin,
  ProviderProfileController.getProvidersByStatus
);
router.get(
  "/by-risk-level/:riskLevel",
  requireAdmin,
  ProviderProfileController.getProvidersByRiskLevel
);

// ===================================================================
// PROVIDER ADMIN ROUTES BY ID - Generic parameterized routes
// ===================================================================
// BASIC CRUD - Single parameter routes
router.get("/:id", requireAdmin, ProviderProfileController.getProviderProfileById);
router.put("/:id", requireAdmin, ProviderProfileController.updateProviderProfile);
router.delete("/:id", requireAdmin, ProviderProfileController.deleteProviderProfile);

// ===================================================================
// PROVIDER SUB-RESOURCE MANAGEMENT (Admin only)
// ===================================================================
// SPECIFIC SUB-RESOURCE ROUTES - Single ID with specific actions

// Provider operational status management
router.patch(
  "/:id/operational-status",
  requireAdmin,
  ProviderProfileController.updateOperationalStatus
);
router.patch(
  "/:id/toggle-availability",
  requireAdmin,
  ProviderProfileController.toggleAvailability
);

// Provider performance management
router.patch(
  "/:id/performance-metrics",
  requireAdmin,
  ProviderProfileController.updatePerformanceMetrics
);
router.post("/:id/penalties", requireAdmin, ProviderProfileController.addPenalty);

// Provider working hours management
router.patch(
  "/:id/working-hours",
  requireAdmin,
  ProviderProfileController.updateWorkingHours
);

// ===================================================================
// PROVIDER RISK MANAGEMENT ROUTES (Admin only)
// ===================================================================
// RISK-SPECIFIC SUB-RESOURCE ROUTES
router.patch(
  "/:id/risk-assessment",
  requireAdmin,
  ProviderProfileController.updateRiskAssessment
);
router.get("/:id/risk-score", requireAdmin, ProviderProfileController.getProviderRiskScore);
router.get(
  "/:id/risk-history",
  requireAdmin,
  ProviderProfileController.getRiskAssessmentHistory
);
router.patch(
  "/:id/schedule-assessment",
  requireAdmin,
  ProviderProfileController.scheduleNextAssessment
);

// ===================================================================
// PROVIDER SERVICE OFFERING MANAGEMENT (Admin only)
// ===================================================================
// MOST SPECIFIC ROUTES - Multiple parameters
router.post("/:id/service-offerings", requireAdmin, ProviderProfileController.addServiceOffering);
router.delete(
  "/:id/service-offerings/:serviceId",
  requireAdmin,
  ProviderProfileController.removeServiceOffering
);

export default router;