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
} from "../controllers/profile.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import ClientProfileController from "../controllers/clientProfile.controller.js";
import ProviderProfileController from "../controllers/providerProfile.controller.js";

const router = express.Router();

// All profile routes require authentication
router.use(authenticateToken);

// ===================================================================
// MAIN PROFILE ROUTES - Core profile management functionality
// ===================================================================

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
router.patch("/marketplace-status", updateMarketplaceStatus as any);

// Preference management routes
router.put("/preferences", updateProfilePreferences as any);
router.patch("/preferences/specific", updateSpecificPreference as any);
router.patch("/preferences/bulk", bulkUpdatePreferences as any);

// Profile lifecycle routes
router.delete("/", deleteProfile as any);
router.patch("/restore", restoreProfile as any);

// ===================================================================
// CLIENT PROFILE ROUTES - Client-specific profile functionality
// ===================================================================

// Current user's client profile routes
router.post("/client-profile", ClientProfileController.createClientProfile);
router.get("/client-profile", ClientProfileController.getMyClientProfile);
router.put("/client-profile", ClientProfileController.updateMyClientProfile);

// Client profile management by specific ID (mainly for admin use)
router.get(
  "/client-profiles/:id",
  ClientProfileController.getClientProfileById
);
router.put("/client-profiles/:id", ClientProfileController.updateClientProfile);
router.delete(
  "/client-profiles/:id",
  ClientProfileController.deleteClientProfile
);

// Client profile management by profile ID (admin use)
router.get(
  "/client-profiles/by-profile/:profileId",
  ClientProfileController.getClientProfileByProfileId
);

// Specialized client profile routes
router.patch(
  "/client-profiles/:id/trust-score",
  ClientProfileController.updateTrustScore
);
router.post(
  "/client-profiles/:id/preferred-services",
  ClientProfileController.addPreferredService
);
router.delete(
  "/client-profiles/:id/preferred-services/:serviceId",
  ClientProfileController.removePreferredService
);
router.post(
  "/client-profiles/:id/preferred-providers",
  ClientProfileController.addPreferredProvider
);
router.delete(
  "/client-profiles/:id/preferred-providers/:providerId",
  ClientProfileController.removePreferredProvider
);

// Admin routes for client profiles
router.get("/client-profiles", ClientProfileController.getAllClientProfiles);
router.get(
  "/client-profiles/high-risk",
  ClientProfileController.getHighRiskClients
);

// ===================================================================
// PROVIDER PROFILE ROUTES - Provider-specific profile functionality
// ===================================================================

// Current user's provider profile routes
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
  ProviderProfileController.updateProviderProfile
);

// Provider profile management by specific ID (mainly for admin use)
router.get(
  "/provider-profiles/:id",
  ProviderProfileController.getProviderProfileById
);
router.put(
  "/provider-profiles/:id",
  ProviderProfileController.updateProviderProfile
);
router.delete(
  "/provider-profiles/:id",
  ProviderProfileController.deleteProviderProfile
);

// Provider profile management by profile ID (admin use)
router.get(
  "/provider-profiles/by-profile/:profileId",
  ProviderProfileController.getProviderProfileByProfileId
);

// Provider operational status management
router.patch(
  "/provider-profiles/:id/operational-status",
  ProviderProfileController.updateOperationalStatus
);
router.patch(
  "/provider-profiles/:id/toggle-availability",
  ProviderProfileController.toggleAvailability
);

// Provider performance management
router.patch(
  "/provider-profiles/:id/performance-metrics",
  ProviderProfileController.updatePerformanceMetrics
);
router.post(
  "/provider-profiles/:id/penalties",
  ProviderProfileController.addPenalty
);

// Provider service offering management
router.post(
  "/provider-profiles/:id/service-offerings",
  ProviderProfileController.addServiceOffering
);
router.delete(
  "/provider-profiles/:id/service-offerings/:serviceId",
  ProviderProfileController.removeServiceOffering
);

// Provider working hours management
router.patch(
  "/provider-profiles/:id/working-hours",
  ProviderProfileController.updateWorkingHours
);

// Admin routes for provider profiles - Discovery and filtering
router.get(
  "/provider-profiles",
  ProviderProfileController.getAllProviderProfiles
);
router.get(
  "/provider-profiles/available",
  ProviderProfileController.getAvailableProviders
);
router.get(
  "/provider-profiles/top-rated",
  ProviderProfileController.getTopRatedProviders
);
router.get(
  "/provider-profiles/high-risk",
  ProviderProfileController.getHighRiskProviders
);

export default router;
