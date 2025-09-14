import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/category.controller";

const router = express.Router();

router.get("/", CategoryController.getCategories);
router.get("/with-services", CategoryController.getCategoriesWithServices);
router.get("/parents", CategoryController.getParentCategories);
router.get("/search", CategoryController.searchCategories);
router.get("/parents/:parentId/subcategories", CategoryController.getSubcategories);
router.get("/slug/:slug", CategoryController.getCategoryBySlug);
router.get("/:id", CategoryController.getCategoryById);

router.get("/deleted/all", authenticateToken, requireAdmin, CategoryController.getDeletedCategories);
router.get("/deleted/:id", authenticateToken, requireAdmin, CategoryController.getDeletedCategoryById);
router.get("/moderation/pending", authenticateToken, requireAdmin, CategoryController.getPendingCategories);

router.post("/", authenticateToken, requireAdmin, CategoryController.createCategory as any);
router.put("/:id", authenticateToken, requireAdmin, CategoryController.updateCategory as any);
router.delete("/:id", authenticateToken, requireAdmin, CategoryController.deleteCategory as any);

router.patch("/:id/restore", authenticateToken, requireAdmin, CategoryController.restoreCategory as any);
router.patch("/:id/toggle-status", authenticateToken, requireAdmin, CategoryController.toggleCategoryStatus as any);
router.patch("/:id/moderate", authenticateToken, requireAdmin, CategoryController.moderateCategory as any);
router.patch("/moderate/bulk", authenticateToken, requireAdmin, CategoryController.bulkModerateCategories as any);
router.patch("/display-order", authenticateToken, requireAdmin, CategoryController.updateDisplayOrder as any);

export default router;