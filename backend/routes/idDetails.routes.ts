// routes/idDetails.routes.ts
import express from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { updateIdDetails, updateIdField,
  getIdDetails,
  removeIdDetails,
  validateIdDetailsEndpoint,
  getIdDetailsSummary, } from "../controllers/identity-card.controller.js";

const router = express.Router();


router.use(authenticateToken);

router.get("/validate", validateIdDetailsEndpoint as any);
router.get("/summary", getIdDetailsSummary as any);

router.get("/", getIdDetails as any);
router.put("/", updateIdDetails as any);
router.delete("/", removeIdDetails as any);

router.put("/:field", updateIdField as any);

export default router;