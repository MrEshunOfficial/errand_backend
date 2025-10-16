import express from "express";
import {
  authenticateToken,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import ClientProfileController from "../controllers/clientProfile.controller.js";

const router = express.Router();

router.get("/public", ClientProfileController.getPublicClientProfiles);
router.get(
  "/public/by-profile/:profileId",
  ClientProfileController.getPublicClientProfileByProfileId
);
router.get("/public/:id/stats", ClientProfileController.getClientStats);
router.get("/public/:id", ClientProfileController.getPublicClientProfile);

router.use(authenticateToken);

router.post("/", ClientProfileController.createClientProfile);
router.get("/", ClientProfileController.getMyClientProfile);
router.put("/", ClientProfileController.updateMyClientProfile);

router.get("/all", requireAdmin, ClientProfileController.getAllClientProfiles);
router.get(
  "/high-risk",
  requireAdmin,
  ClientProfileController.getHighRiskClients
);
router.get(
  "/by-profile/:profileId",
  requireAdmin,
  ClientProfileController.getClientProfileByProfileId
);
router.get("/:id", requireAdmin, ClientProfileController.getClientProfileById);
router.put("/:id", requireAdmin, ClientProfileController.updateClientProfile);
router.delete(
  "/:id",
  requireAdmin,
  ClientProfileController.deleteClientProfile
);
router.get("/:id/stats", requireAdmin, ClientProfileController.getClientStats);
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
  "/:id/preferred-services",
  requireAdmin,
  ClientProfileController.removePreferredService
);
router.post(
  "/:id/preferred-providers",
  requireAdmin,
  ClientProfileController.addPreferredProvider
);
router.delete(
  "/:id/preferred-providers",
  requireAdmin,
  ClientProfileController.removePreferredProvider
);

export default router;
