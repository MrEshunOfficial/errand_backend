// routes/category.routes.ts
import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/category.controller";

const router = express.Router();

// ===================================================================
// PUBLIC CATEGORY ROUTES - No authentication required
// ===================================================================

// Get all active categories with filtering and pagination
// Supports: includeServices, includeSubcategories, includeUserData, includeInactive, servicesLimit
router.get("/", CategoryController.getCategories);

// Get categories with services (enhanced endpoint)
// Supports: servicesLimit, popularOnly, includeSubcategories, includeUserData, includeInactive
router.get("/with-services", CategoryController.getCategoriesWithServices);

// Get parent categories only
// Supports: includeSubcategories, includeServicesCount, includeUserData, includeInactive, includeServices, servicesLimit, popularOnly
router.get("/parents", CategoryController.getParentCategories);

// Search categories
// Supports: q (query), limit, includeInactive, parentId, includeUserData
router.get("/search", CategoryController.searchCategories);

// Get subcategories of a parent category
// Supports: includeUserData
router.get(
  "/parents/:parentId/subcategories",
  CategoryController.getSubcategories
);

// Get category by slug (for SEO-friendly URLs)
// Supports: includeSubcategories, includeUserData, includeServices, servicesLimit, popularOnly
router.get("/slug/:slug", CategoryController.getCategoryBySlug);

// Get category by ID
// Supports: includeSubcategories, includeUserData, includeServices, servicesLimit, popularOnly
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