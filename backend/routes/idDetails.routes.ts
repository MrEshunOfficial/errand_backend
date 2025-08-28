// routes/idDetails.routes.ts
import express from "express";
import {
  updateIdDetails,
  updateIdType,
  updateIdNumber,
  updateIdFile,
  getIdDetails,
  removeIdDetails,
  validateIdDetails,
  getIdDetailsSummary,
} from "../controllers/identity-card.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// All ID details routes require authentication
router.use(authenticateToken);

// ===================================================================
// ID DETAILS VALIDATION AND SUMMARY ROUTES - SPECIFIC ROUTES FIRST
// ===================================================================
router.get("/validate", validateIdDetails as any);
router.get("/summary", getIdDetailsSummary as any);

// ===================================================================
// ID DETAILS MANAGEMENT ROUTES - BASE ROUTES
// ===================================================================
router.get("/", getIdDetails as any);
router.put("/", updateIdDetails as any);
router.delete("/", removeIdDetails as any);

// ===================================================================
// SPECIFIC ID DETAILS UPDATE ROUTES
// ===================================================================
router.put("/type", updateIdType as any);
router.put("/number", updateIdNumber as any);
router.put("/file", updateIdFile as any);

export default router;
