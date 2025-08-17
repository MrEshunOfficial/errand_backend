// routes/category.routes.ts
import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";
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
// PROTECTED CATEGORY ROUTES - Authentication required
// ===================================================================

// Create new category
router.post("/", authenticateToken, CategoryController.createCategory as any);

// Update category
router.put("/:id", authenticateToken, CategoryController.updateCategory as any);

// Soft delete category
router.delete(
  "/:id",
  authenticateToken,
  CategoryController.deleteCategory as any
);

// Restore deleted category
router.patch(
  "/:id/restore",
  authenticateToken,
  CategoryController.restoreCategory as any
);

// Toggle category active status
router.patch(
  "/:id/toggle-status",
  authenticateToken,
  CategoryController.toggleCategoryStatus as any
);

// Update display order for multiple categories
router.patch(
  "/display-order",
  authenticateToken,
  CategoryController.updateDisplayOrder as any
);

export default router;
