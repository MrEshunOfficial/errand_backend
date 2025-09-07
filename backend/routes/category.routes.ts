import express from "express";
import { authenticateToken, requireAdmin, optionalAuth } from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/category.controller";

const router = express.Router();

// Public routes with optional authentication (supports role-based filtering)
router.get("/", optionalAuth, CategoryController.getCategories);
router.get("/with-services", optionalAuth, CategoryController.getCategoriesWithServices);
router.get("/parents", optionalAuth, CategoryController.getParentCategories);
router.get("/search", optionalAuth, CategoryController.searchCategories);
router.get("/parents/:parentId/subcategories", optionalAuth, CategoryController.getSubcategories);
router.get("/slug/:slug", optionalAuth, CategoryController.getCategoryBySlug);
router.get("/:id", optionalAuth, CategoryController.getCategoryById);

// Admin moderation routes
router.get("/moderation/pending", authenticateToken, requireAdmin, CategoryController.getPendingCategories);
router.patch("/:id/moderate", authenticateToken, requireAdmin, CategoryController.moderateCategory);
router.patch("/moderate/bulk", authenticateToken, requireAdmin, CategoryController.bulkModerateCategories);

// Protected routes (admin only)
router.post("/", authenticateToken, requireAdmin, CategoryController.createCategory);
router.put("/:id", authenticateToken, requireAdmin, CategoryController.updateCategory);
router.delete("/:id", authenticateToken, requireAdmin, CategoryController.deleteCategory);
router.patch("/:id/restore", authenticateToken, requireAdmin, CategoryController.restoreCategory);
router.patch("/:id/toggle-status", authenticateToken, requireAdmin, CategoryController.toggleCategoryStatus);
router.patch("/display-order", authenticateToken, requireAdmin, CategoryController.updateDisplayOrder);

export default router;