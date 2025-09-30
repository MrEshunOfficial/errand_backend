import express from "express";
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";
import ProviderProfileController from "../controllers/providerProfile.controller.js";

const router = express.Router();

// Public routes
router.get("/public/search", ProviderProfileController.searchPublicProviders.bind(ProviderProfileController));
router.get("/public/browse", ProviderProfileController.getPublicProviderProfiles.bind(ProviderProfileController));
router.get("/public/:id", ProviderProfileController.getPublicProviderProfile.bind(ProviderProfileController));

// Authenticated routes
router.use(authenticateToken);

router.post("/", ProviderProfileController.createProviderProfile.bind(ProviderProfileController));
router.get("/me", ProviderProfileController.getMyProviderProfile.bind(ProviderProfileController));
router.put("/me", ProviderProfileController.updateMyProviderProfile.bind(ProviderProfileController));

router.patch(
  "/me/toggle-availability",
  ProviderProfileController.toggleMyAvailability.bind(ProviderProfileController)
);

router.post(
  "/me/service-offerings",
  ProviderProfileController.addMyServiceOffering.bind(ProviderProfileController)
);
router.delete(
  "/me/service-offerings/:serviceId",
  ProviderProfileController.removeMyServiceOffering.bind(ProviderProfileController)
);

router.patch(
  "/me/working-hours",
  ProviderProfileController.updateMyWorkingHours.bind(ProviderProfileController)
);

router.get(
  "/statistics",
  requireSuperAdmin,
  ProviderProfileController.getProviderStatistics.bind(ProviderProfileController)
);

router.get("/all", requireAdmin, ProviderProfileController.getAllProviderProfiles.bind(ProviderProfileController));
router.get("/available", requireAdmin, ProviderProfileController.getAvailableProviders.bind(ProviderProfileController));
router.get("/top-rated", requireAdmin, ProviderProfileController.getTopRatedProviders.bind(ProviderProfileController));
router.get("/high-risk", requireAdmin, ProviderProfileController.getHighRiskProviders.bind(ProviderProfileController));
router.get(
  "/overdue-assessments",
  requireAdmin,
  ProviderProfileController.getOverdueRiskAssessments.bind(ProviderProfileController)
);

router.patch(
  "/bulk/risk-assessments",
  requireSuperAdmin,
  ProviderProfileController.bulkUpdateRiskAssessments.bind(ProviderProfileController)
);

router.get(
  "/by-profile/:profileId",
  requireAdmin,
  ProviderProfileController.getProviderProfileByProfileId.bind(ProviderProfileController)
);
router.get(
  "/by-status/:status",
  requireAdmin,
  ProviderProfileController.getProvidersByStatus.bind(ProviderProfileController)
);
router.get(
  "/by-risk-level/:riskLevel",
  requireAdmin,
  ProviderProfileController.getProvidersByRiskLevel.bind(ProviderProfileController)
);

router.get("/:id", requireAdmin, ProviderProfileController.getProviderProfileById.bind(ProviderProfileController));
router.put("/:id", requireAdmin, ProviderProfileController.updateProviderProfile.bind(ProviderProfileController));
router.delete("/:id", requireAdmin, ProviderProfileController.deleteProviderProfile.bind(ProviderProfileController));

router.patch(
  "/:id/operational-status",
  requireAdmin,
  ProviderProfileController.updateOperationalStatus.bind(ProviderProfileController)
);
router.patch(
  "/:id/toggle-availability",
  requireAdmin,
  ProviderProfileController.toggleAvailability.bind(ProviderProfileController)
);
router.patch(
  "/:id/performance-metrics",
  requireAdmin,
  ProviderProfileController.updatePerformanceMetrics.bind(ProviderProfileController)
);
router.post("/:id/penalties", requireAdmin, ProviderProfileController.addPenalty.bind(ProviderProfileController));
router.patch(
  "/:id/working-hours",
  requireAdmin,
  ProviderProfileController.updateWorkingHours.bind(ProviderProfileController)
);

router.post(
  "/:id/service-offerings",
  requireAdmin,
  ProviderProfileController.addServiceOffering.bind(ProviderProfileController)
);
router.delete(
  "/:id/service-offerings/:serviceId",
  requireAdmin,
  ProviderProfileController.removeServiceOffering.bind(ProviderProfileController)
);

router.patch(
  "/:id/risk-assessment",
  requireAdmin,
  ProviderProfileController.updateRiskAssessment.bind(ProviderProfileController)
);
router.get(
  "/:id/risk-score",
  requireAdmin,
  ProviderProfileController.getProviderRiskScore.bind(ProviderProfileController)
);
router.get(
  "/:id/risk-history",
  requireAdmin,
  ProviderProfileController.getRiskAssessmentHistory.bind(ProviderProfileController)
);
router.patch(
  "/:id/schedule-assessment",
  requireAdmin,
  ProviderProfileController.scheduleNextAssessment.bind(ProviderProfileController)
);

export default router;