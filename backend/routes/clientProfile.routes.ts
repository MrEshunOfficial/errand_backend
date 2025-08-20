// routes/clientProfile.routes.ts
import express from "express";
import { 
  authenticateToken, 
  requireAdmin,
} from "../middleware/auth.middleware.js";
import ClientProfileController from "../controllers/clientProfile.controller.js";

const router = express.Router();

// ===================================================================
// PUBLIC CLIENT PROFILE ROUTES - NO AUTHENTICATION REQUIRED
// ===================================================================
// CRITICAL: These routes must come BEFORE router.use(authenticateToken)

// Public client verification status - MOST SPECIFIC FIRST
router.get("/public/:id/verification", ClientProfileController.getClientVerificationStatus);

// Public client profile by profile ID - SPECIFIC PATTERN
router.get("/public/by-profile/:profileId", ClientProfileController.getPublicClientProfileByProfileId);

// Public individual client profile - PARAMETERIZED ROUTES LAST
router.get("/public/:id", ClientProfileController.getPublicClientProfile);
router.get("/metrics/:id", ClientProfileController.getClientReliabilityMetrics);

// ===================================================================
// AUTHENTICATION REQUIRED FOR ALL ROUTES BELOW
// ===================================================================
router.use(authenticateToken);

// ===================================================================
// CURRENT USER'S CLIENT PROFILE ROUTES - SPECIFIC ROUTES FIRST
// ===================================================================
router.post("/", ClientProfileController.createClientProfile);
router.get("/", ClientProfileController.getMyClientProfile);
router.put("/", ClientProfileController.updateMyClientProfile);

// ===================================================================
// ADMIN CLIENT PROFILE DISCOVERY ROUTES - SPECIFIC ROUTES BEFORE PARAMETERIZED
// ===================================================================
router.get("/all", requireAdmin, ClientProfileController.getAllClientProfiles);
router.get("/high-risk", requireAdmin, ClientProfileController.getHighRiskClients);

// ===================================================================
// CLIENT PROFILE MANAGEMENT BY PROFILE ID - SPECIFIC PATTERN BEFORE GENERIC :id
// ===================================================================
router.get(
  "/by-profile/:profileId",
  requireAdmin,
  ClientProfileController.getClientProfileByProfileId
);

// ===================================================================
// CLIENT PROFILE MANAGEMENT BY SPECIFIC ID - PARAMETERIZED ROUTES
// ===================================================================
router.get("/:id", requireAdmin, ClientProfileController.getClientProfileById);
router.put("/:id", requireAdmin, ClientProfileController.updateClientProfile);
router.delete("/:id", requireAdmin, ClientProfileController.deleteClientProfile);

// ===================================================================
// SPECIALIZED CLIENT PROFILE ROUTES WITH MULTIPLE PARAMETERS - MOST SPECIFIC LAST
// ===================================================================
router.patch(
  "/:id/trust-score",
  requireAdmin,
  ClientProfileController.updateTrustScore
);
router.post(
  "/:id/preferred-services",
  requireAdmin,
  ClientProfileController.addPreferredService
);
router.delete(
  "/:id/preferred-services/:serviceId",
  requireAdmin,
  ClientProfileController.removePreferredService
);
router.post(
  "/:id/preferred-providers",
  requireAdmin,
  ClientProfileController.addPreferredProvider
);
router.delete(
  "/:id/preferred-providers/:providerId",
  requireAdmin,
  ClientProfileController.removePreferredProvider
);

export default router;