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
  updateProfilePreferences,
  updateSpecificPreference,
  bulkUpdatePreferences,
  deleteProfile,
  restoreProfile,
  updateMarketplaceStatus,
  // Admin profile management controllers
  updateVerificationStatus,
  updateModerationStatus,
  initiateProfileVerification,
  getAllProfiles,
  getProfilesByStatus,
  getProfilesByVerificationStatus,
  getProfilesByModerationStatus,
  getIncompleteProfiles,
  getMarketplaceActiveProfiles,
  recalculateProfileCompleteness,
  // Profile search and filtering
  searchProfiles,
  getProfilesByLocation,
  // Profile analytics
  getProfileAnalytics,
  // Profile social media management
  addSocialMediaHandle,
  removeSocialMediaHandle,
  // Profile moderation utilities
  moderateProfileContent,
  getPendingModerationProfiles,
  // Profile export/import
  exportProfileData,
  // Profile activity tracking
  getProfileActivitySummary,
} from "../controllers/profile.controller.js";
import { 
  authenticateToken, 
  requireAdmin,
  requireSuperAdmin 
} from "../middleware/auth.middleware.js";
import ClientProfileController from "../controllers/clientProfile.controller.js";
import ProviderProfileController from "../controllers/providerProfile.controller.js";

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// ===================================================================
// MAIN PROFILE ROUTES - Core profile management functionality
// ===================================================================

// Profile analytics (Admin only) - MOST SPECIFIC FIRST
router.get("/analytics", requireAdmin, getProfileAnalytics as any);

// Profile search and filtering - SPECIFIC ROUTES BEFORE PARAMETERIZED
router.get("/search", searchProfiles as any);
router.get("/by-location", getProfilesByLocation as any);

// Admin profile discovery routes - SPECIFIC STATUS ROUTES
router.get("/all", requireAdmin, getAllProfiles as any);
router.get("/incomplete", requireAdmin, getIncompleteProfiles as any);
router.get("/marketplace-active", requireAdmin, getMarketplaceActiveProfiles as any);
router.get("/pending-moderation", requireAdmin, getPendingModerationProfiles as any);

// Profile bulk operations (Admin only)
router.post("/recalculate-completeness", requireAdmin, recalculateProfileCompleteness as any);
router.post("/recalculate-completeness/:userId", requireAdmin, recalculateProfileCompleteness as any);

// Current user profile routes - SPECIFIC ROUTES FIRST
router.get("/completeness", getProfileCompleteness as any);
router.get("/with-context", getProfileWithContext as any);
router.get("/batch-operations", batchProfileOperations as any);
router.get("/activity-summary", getProfileActivitySummary as any);
router.get("/export", exportProfileData as any);

// Current user profile management
router.get("/", getProfile as any);
router.put("/", updateProfile as any);
router.delete("/", deleteProfile as any);

// Current user specific profile update routes
router.patch("/role", updateProfileRole as any);
router.patch("/location", updateProfileLocation as any);
router.patch("/marketplace-status", updateMarketplaceStatus as any);
router.patch("/restore", restoreProfile as any);
router.patch("/initiate-verification", initiateProfileVerification as any);

// Current user preference management routes
router.put("/preferences", updateProfilePreferences as any);
router.patch("/preferences/specific", updateSpecificPreference as any);
router.patch("/preferences/bulk", bulkUpdatePreferences as any);

// Current user social media management
router.post("/social-media", addSocialMediaHandle as any);
router.delete("/social-media/:handleId", removeSocialMediaHandle as any);

// ===================================================================
// PROFILE ROUTES BY STATUS (Admin only)
// ===================================================================
// SPECIFIC STATUS PATTERN ROUTES - Before generic parameterized routes

router.get("/by-status/:status", requireAdmin, getProfilesByStatus as any);
router.get("/by-verification-status/:status", requireAdmin, getProfilesByVerificationStatus as any);
router.get("/by-moderation-status/:status", requireAdmin, getProfilesByModerationStatus as any);

// ===================================================================
// ADMIN PROFILE MANAGEMENT ROUTES
// ===================================================================
// ADMIN VERIFICATION AND MODERATION ROUTES

// Profile verification and moderation (Admin only)
router.patch("/verification-status", requireAdmin, updateVerificationStatus as any);
router.patch("/moderation-status", requireAdmin, updateModerationStatus as any);
router.post("/moderate-content", requireAdmin, moderateProfileContent as any);

// ===================================================================
// CLIENT PROFILE ROUTES - Client-specific profile functionality
// ===================================================================

// Current user's client profile routes - SPECIFIC ROUTES FIRST
router.post("/client-profile", ClientProfileController.createClientProfile);
router.get("/client-profile", ClientProfileController.getMyClientProfile);
router.put("/client-profile", ClientProfileController.updateMyClientProfile);

// Admin client profile discovery routes - SPECIFIC ROUTES BEFORE PARAMETERIZED
router.get(
  "/client-profiles",
  requireAdmin,
  ClientProfileController.getAllClientProfiles
);
router.get(
  "/client-profiles/high-risk",
  requireAdmin,
  ClientProfileController.getHighRiskClients
);

// Client profile management by profile ID - SPECIFIC PATTERN BEFORE GENERIC :id
router.get(
  "/client-profiles/by-profile/:profileId",
  requireAdmin,
  ClientProfileController.getClientProfileByProfileId
);

// Client profile management by specific ID - PARAMETERIZED ROUTES LAST
router.get(
  "/client-profiles/:id",
  requireAdmin,
  ClientProfileController.getClientProfileById
);
router.put(
  "/client-profiles/:id", 
  requireAdmin,
  ClientProfileController.updateClientProfile
);
router.delete(
  "/client-profiles/:id",
  requireAdmin,
  ClientProfileController.deleteClientProfile
);

// Specialized client profile routes with multiple parameters - MOST SPECIFIC LAST
router.patch(
  "/client-profiles/:id/trust-score",
  requireAdmin,
  ClientProfileController.updateTrustScore
);
router.post(
  "/client-profiles/:id/preferred-services",
  requireAdmin,
  ClientProfileController.addPreferredService
);
router.delete(
  "/client-profiles/:id/preferred-services/:serviceId",
  requireAdmin,
  ClientProfileController.removePreferredService
);
router.post(
  "/client-profiles/:id/preferred-providers",
  requireAdmin,
  ClientProfileController.addPreferredProvider
);
router.delete(
  "/client-profiles/:id/preferred-providers/:providerId",
  requireAdmin,
  ClientProfileController.removePreferredProvider
);

// ===================================================================
// PROVIDER PROFILE ROUTES - Provider-specific profile functionality
// ===================================================================

// Current user's provider profile routes - SPECIFIC ROUTES FIRST
router.post(
  "/provider-profile",
  ProviderProfileController.createProviderProfile as any
);
router.get(
  "/provider-profile",
  ProviderProfileController.getMyProviderProfile as any
);
router.put(
  "/provider-profile",
  ProviderProfileController.updateMyProviderProfile as any
);

// Current user's provider sub-resource management - SPECIFIC NESTED ROUTES
router.patch(
  "/provider-profile/toggle-availability",
  ProviderProfileController.toggleMyAvailability as any
);
router.post(
  "/provider-profile/service-offerings",
  ProviderProfileController.addMyServiceOffering as any
);
router.delete(
  "/provider-profile/service-offerings",
  ProviderProfileController.removeMyServiceOffering as any
);
router.patch(
  "/provider-profile/working-hours",
  ProviderProfileController.updateMyWorkingHours as any
);

// ===================================================================
// PROVIDER STATISTICS AND ANALYTICS ROUTES (Super Admin only)
// ===================================================================
// CRITICAL: These MUST come before any parameterized routes

// Provider statistics (super admin only - system-wide analytics)
router.get(
  "/provider-profiles/statistics",
  requireSuperAdmin,
  ProviderProfileController.getProviderStatistics
);

// ===================================================================
// PROVIDER DISCOVERY AND FILTERING ROUTES (Admin only)
// ===================================================================
// SPECIFIC DISCOVERY ROUTES - Before parameterized routes

// General discovery routes
router.get(
  "/provider-profiles",
  requireAdmin,
  ProviderProfileController.getAllProviderProfiles
);
router.get(
  "/provider-profiles/available",
  requireAdmin,
  ProviderProfileController.getAvailableProviders
);
router.get(
  "/provider-profiles/top-rated",
  requireAdmin,
  ProviderProfileController.getTopRatedProviders
);
router.get(
  "/provider-profiles/high-risk",
  requireAdmin,
  ProviderProfileController.getHighRiskProviders
);
router.get(
  "/provider-profiles/overdue-assessments",
  requireAdmin,
  ProviderProfileController.getOverdueRiskAssessments
);

// ===================================================================
// PROVIDER BULK OPERATIONS (Super Admin only)
// ===================================================================
// BULK ROUTES - Before individual parameterized routes

// Bulk risk operations
router.patch(
  "/provider-profiles/bulk/risk-assessments",
  requireSuperAdmin,
  ProviderProfileController.bulkUpdateRiskAssessments
);

// ===================================================================
// PROVIDER ROUTES BY SPECIFIC PATTERNS (Admin only)
// ===================================================================
// SPECIFIC PATTERN ROUTES - Before generic :id routes

// Provider profile management by profile ID
router.get(
  "/provider-profiles/by-profile/:profileId",
  requireAdmin,
  ProviderProfileController.getProviderProfileByProfileId
);

// Filter by status and risk level
router.get(
  "/provider-profiles/by-status/:status",
  requireAdmin,
  ProviderProfileController.getProvidersByStatus
);
router.get(
  "/provider-profiles/by-risk-level/:riskLevel",
  requireAdmin,
  ProviderProfileController.getProvidersByRiskLevel
);

// ===================================================================
// PROVIDER ADMIN ROUTES BY ID - Generic parameterized routes
// ===================================================================
// BASIC CRUD - Single parameter routes

// Provider profile management by specific ID
router.get(
  "/provider-profiles/:id",
  requireAdmin,
  ProviderProfileController.getProviderProfileById
);
router.put(
  "/provider-profiles/:id",
  requireAdmin,
  ProviderProfileController.updateProviderProfile
);
router.delete(
  "/provider-profiles/:id",
  requireAdmin,
  ProviderProfileController.deleteProviderProfile
);

// ===================================================================
// PROVIDER SUB-RESOURCE MANAGEMENT (Admin only)
// ===================================================================
// SPECIFIC SUB-RESOURCE ROUTES - Single ID with specific actions

// Provider operational status management
router.patch(
  "/provider-profiles/:id/operational-status",
  requireAdmin,
  ProviderProfileController.updateOperationalStatus
);
router.patch(
  "/provider-profiles/:id/toggle-availability",
  requireAdmin,
  ProviderProfileController.toggleAvailability
);

// Provider performance management
router.patch(
  "/provider-profiles/:id/performance-metrics",
  requireAdmin,
  ProviderProfileController.updatePerformanceMetrics
);
router.post(
  "/provider-profiles/:id/penalties",
  requireAdmin,
  ProviderProfileController.addPenalty
);

// Provider working hours management
router.patch(
  "/provider-profiles/:id/working-hours",
  requireAdmin,
  ProviderProfileController.updateWorkingHours
);

// ===================================================================
// PROVIDER RISK MANAGEMENT ROUTES (Admin only)
// ===================================================================
// RISK-SPECIFIC SUB-RESOURCE ROUTES

// Risk assessment management
router.patch(
  "/provider-profiles/:id/risk-assessment",
  requireAdmin,
  ProviderProfileController.updateRiskAssessment
);
router.get(
  "/provider-profiles/:id/risk-score",
  requireAdmin,
  ProviderProfileController.getProviderRiskScore
);
router.get(
  "/provider-profiles/:id/risk-history",
  requireAdmin,
  ProviderProfileController.getRiskAssessmentHistory
);
router.patch(
  "/provider-profiles/:id/schedule-assessment",
  requireAdmin,
  ProviderProfileController.scheduleNextAssessment
);

// ===================================================================
// PROVIDER SERVICE OFFERING MANAGEMENT (Admin only)
// ===================================================================
// MOST SPECIFIC ROUTES - Multiple parameters

// Provider service offering management - TWO PARAMETERS
router.post(
  "/provider-profiles/:id/service-offerings",
  requireAdmin,
  ProviderProfileController.addServiceOffering
);
router.delete(
  "/provider-profiles/:id/service-offerings/:serviceId",
  requireAdmin,
  ProviderProfileController.removeServiceOffering
);

export default router;