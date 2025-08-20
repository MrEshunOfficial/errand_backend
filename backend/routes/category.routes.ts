// routes/category.routes.ts
import express from "express";
import { 
  authenticateToken, 
  requireAdmin 
} from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/category.controller";

const router = express.Router();

// ===================================================================
// PUBLIC CATEGORY ROUTES - No authentication required
// ===================================================================

// Get all active categories with filtering and pagination
router.get("/", CategoryController.getCategories);

// Get parent categories only
router.get("/parents", CategoryController.getParentCategories);

// Search categories
router.get("/search", CategoryController.searchCategories);

// Get subcategories of a parent category
router.get(
  "/parents/:parentId/subcategories",
  CategoryController.getSubcategories
);

// Get category by slug (for SEO-friendly URLs)
router.get("/slug/:slug", CategoryController.getCategoryBySlug);

// Get category by ID
router.get("/:id", CategoryController.getCategoryById);

// ===================================================================
// ADMIN CATEGORY ROUTES - Admin authentication required
// ===================================================================

// Create new category (admin only)
router.post(
  "/", 
  authenticateToken, 
  requireAdmin,
  CategoryController.createCategory as any
);

// Update category (admin only)
router.put(
  "/:id", 
  authenticateToken, 
  requireAdmin,
  CategoryController.updateCategory as any
);

// Soft delete category (admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  CategoryController.deleteCategory as any
);

// Restore deleted category (admin only)
router.patch(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  CategoryController.restoreCategory as any
);

// Toggle category active status (admin only)
router.patch(
  "/:id/toggle-status",
  authenticateToken,
  requireAdmin,
  CategoryController.toggleCategoryStatus as any
);

// Update display order for multiple categories (admin only)
router.patch(
  "/display-order",
  authenticateToken,
  requireAdmin,
  CategoryController.updateDisplayOrder as any
);

export default router;
