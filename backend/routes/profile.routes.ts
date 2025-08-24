// routes/profile.routes.ts
import express from "express";
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
} from "../middleware/auth.middleware.js";

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// ===================================================================
// PROFILE ANALYTICS (Admin only) - MOST SPECIFIC FIRST
// ===================================================================
router.get("/analytics", requireAdmin, getProfileAnalytics as any);

// ===================================================================
// PROFILE SEARCH AND FILTERING - SPECIFIC ROUTES BEFORE PARAMETERIZED
// ===================================================================
router.get("/search", searchProfiles as any);
router.get("/by-location", getProfilesByLocation as any);

// ===================================================================
// ADMIN PROFILE DISCOVERY ROUTES - SPECIFIC STATUS ROUTES
// ===================================================================
router.get("/all", requireAdmin, getAllProfiles as any);
router.get("/incomplete", requireAdmin, getIncompleteProfiles as any);
router.get(
  "/marketplace-active",
  requireAdmin,
  getMarketplaceActiveProfiles as any
);
router.get(
  "/pending-moderation",
  requireAdmin,
  getPendingModerationProfiles as any
);

// ===================================================================
// PROFILE BULK OPERATIONS (Admin only)
// ===================================================================
router.post(
  "/recalculate-completeness",
  requireAdmin,
  recalculateProfileCompleteness as any
);
router.post(
  "/recalculate-completeness/:userId",
  requireAdmin,
  recalculateProfileCompleteness as any
);

// ===================================================================
// CURRENT USER PROFILE ROUTES - SPECIFIC ROUTES FIRST
// ===================================================================
router.get("/completeness", getProfileCompleteness as any);
router.get("/with-context", getProfileWithContext as any);
router.get("/batch-operations", batchProfileOperations as any);
router.get("/activity-summary", getProfileActivitySummary as any);
router.get("/export", exportProfileData as any);

// Current user profile management - BASE ROUTES
router.get("/", getProfile as any);
router.put("/", updateProfile as any);
router.delete("/", deleteProfile as any);

// ===================================================================
// CURRENT USER SPECIFIC PROFILE UPDATE ROUTES
// ===================================================================
router.patch("/role", updateProfileRole as any);
router.patch("/location", updateProfileLocation as any);
router.patch("/marketplace-status", updateMarketplaceStatus as any);
router.patch("/restore", restoreProfile as any);
router.patch("/initiate-verification", initiateProfileVerification as any);

// ===================================================================
// CURRENT USER PREFERENCE MANAGEMENT ROUTES
// ===================================================================
router.put("/preferences", updateProfilePreferences as any);
router.patch("/preferences/specific", updateSpecificPreference as any);
router.patch("/preferences/bulk", bulkUpdatePreferences as any);

// ===================================================================
// CURRENT USER SOCIAL MEDIA MANAGEMENT
// ===================================================================
router.post("/social-media", addSocialMediaHandle as any);
router.delete("/social-media/:handleId", removeSocialMediaHandle as any);

// ===================================================================
// PROFILE ROUTES BY STATUS (Admin only)
// ===================================================================
// SPECIFIC STATUS PATTERN ROUTES - Before generic parameterized routes
router.get("/by-status/:status", requireAdmin, getProfilesByStatus as any);
router.get(
  "/by-verification-status/:status",
  requireAdmin,
  getProfilesByVerificationStatus as any
);
router.get(
  "/by-moderation-status/:status",
  requireAdmin,
  getProfilesByModerationStatus as any
);

// ===================================================================
// ADMIN PROFILE MANAGEMENT ROUTES
// ===================================================================
// ADMIN VERIFICATION AND MODERATION ROUTES
router.patch(
  "/verification-status",
  requireAdmin,
  updateVerificationStatus as any
);
router.patch("/moderation-status", requireAdmin, updateModerationStatus as any);
router.post("/moderate-content", requireAdmin, moderateProfileContent as any);

export default router;
