import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import { CategoryImageController } from "../controllers/categoryImage.controller";

const router = express.Router();

router.get("/:id/images", CategoryImageController.getImage);
router.get("/slug/:slug/images", CategoryImageController.getImageBySlug);
router.get("/images/batch", CategoryImageController.getBatchImages);

router.post("/", authenticateToken, requireAdmin, CategoryImageController.uploadImage);
router.put("/:id/images", authenticateToken, requireAdmin, CategoryImageController.updateImage);
router.patch("/:id/images/replace", authenticateToken, requireAdmin, CategoryImageController.replaceImage);
router.delete("/:id/images", authenticateToken, requireAdmin, CategoryImageController.deleteImage);

export default router;
