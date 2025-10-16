import express from "express";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";
import ProviderProfileController from "../controllers/providerProfile.controller.js";

const router = express.Router();

// =============================================================================
// PUBLIC ROUTES (No authentication required)
// =============================================================================
router.get(
  "/public/search",
  ProviderProfileController.searchPublicProviders
);

router.get(
  "/public/browse",
  ProviderProfileController.getPublicProviderProfiles
);

router.get(
  "/public/:id",
  ProviderProfileController.getPublicProviderProfile
);

// =============================================================================
// AUTHENTICATED ROUTES (Token required)
// =============================================================================
router.use(authenticateToken);

// Provider profile management (token-based)
router.post(
  "/",
  ProviderProfileController.createProviderProfile
);

router.get(
  "/me",
  ProviderProfileController.getMyProviderProfile
);

router.put(
  "/me",
  ProviderProfileController.updateMyProviderProfile
);

// Availability management (token-based)
router.patch(
  "/me/toggle-availability",
  ProviderProfileController.toggleMyAvailability
);

// Service offerings management (token-based)
router.post(
  "/me/service-offerings",
  ProviderProfileController.addMyServiceOffering
);

router.delete(
  "/me/service-offerings/:serviceId",
  ProviderProfileController.removeMyServiceOffering
);

// Working hours management (token-based)
router.patch(
  "/me/working-hours",
  ProviderProfileController.updateMyWorkingHours
);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// Statistics (Super Admin only)
router.get(
  "/statistics",
  requireSuperAdmin,
  ProviderProfileController.getProviderStatistics
);

// Bulk operations (Super Admin only)
router.patch(
  "/bulk/risk-assessments",
  requireSuperAdmin,
  ProviderProfileController.bulkUpdateRiskAssessments
);

// Provider listings (Admin only)
router.get(
  "/all",
  requireAdmin,
  ProviderProfileController.getAllProviderProfiles
);

router.get(
  "/available",
  requireAdmin,
  ProviderProfileController.getAvailableProviders
);

router.get(
  "/top-rated",
  requireAdmin,
  ProviderProfileController.getTopRatedProviders
);

router.get(
  "/high-risk",
  requireAdmin,
  ProviderProfileController.getHighRiskProviders
);

// Filtering by criteria (Admin only)
router.get(
  "/by-profile/:profileId",
  requireAdmin,
  ProviderProfileController.getProviderProfileByProfileId
);

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

// Individual provider management (Admin only)
router.get(
  "/:id",
  requireAdmin,
  ProviderProfileController.getProviderProfileById
);

router.put(
  "/:id",
  requireAdmin,
  ProviderProfileController.updateProviderProfile
);

router.delete(
  "/:id",
  requireAdmin,
  ProviderProfileController.deleteProviderProfile
);

// Operational status management (Admin only)
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

// Performance metrics (Admin only)
router.patch(
  "/:id/performance-metrics",
  requireAdmin,
  ProviderProfileController.updatePerformanceMetrics
);

// Penalties (Admin only)
router.post(
  "/:id/penalties",
  requireAdmin,
  ProviderProfileController.addPenalty
);

// Working hours management (Admin only)
router.patch(
  "/:id/working-hours",
  requireAdmin,
  ProviderProfileController.updateWorkingHours
);

// Service offerings management (Admin only)
router.post(
  "/:id/service-offerings",
  requireAdmin,
  ProviderProfileController.addServiceOffering
);

router.delete(
  "/:id/service-offerings/:serviceId",
  requireAdmin,
  ProviderProfileController.removeServiceOffering
);

// Risk assessment management (Admin only)
router.patch(
  "/:id/risk-assessment",
  requireAdmin,
  ProviderProfileController.updateRiskAssessment
);

router.get(
  "/:id/risk-score",
  requireAdmin,
  ProviderProfileController.getProviderRiskScore
);

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

export default router;