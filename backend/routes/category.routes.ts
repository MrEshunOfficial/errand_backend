import express from "express";
import {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} from "../middleware/auth.middleware";
import { CategoryController } from "../controllers/category.controller";
import { FileUploadController } from "../controllers/filupload.controller";

const router = express.Router();

/* ------------------ PUBLIC ROUTES ------------------ */

// More specific first
router.get(
  "/with-services",
  optionalAuth,
  CategoryController.getCategoriesWithServices
);
router.get("/parents", optionalAuth, CategoryController.getParentCategories);
router.get(
  "/parents/:parentId/subcategories",
  optionalAuth,
  CategoryController.getSubcategories
);
router.get("/search", optionalAuth, CategoryController.searchCategories);
router.get("/slug/:slug", optionalAuth, CategoryController.getCategoryBySlug);
router.get("/", optionalAuth, CategoryController.getCategories); // keep this last among public base routes
router.get("/:id", optionalAuth, CategoryController.getCategoryById);

/* ------------------ ADMIN MODERATION ROUTES ------------------ */

router.get(
  "/moderation/pending",
  authenticateToken,
  requireAdmin,
  CategoryController.getPendingCategories
);
router.patch(
  "/moderate/bulk",
  authenticateToken,
  requireAdmin,
  CategoryController.bulkModerateCategories
);
router.patch(
  "/:id/moderate",
  authenticateToken,
  requireAdmin,
  CategoryController.moderateCategory
);

/* ------------------ PROTECTED (ADMIN ONLY) ------------------ */

router.post(
  "/",
  authenticateToken,
  requireAdmin,
  CategoryController.createCategory
);
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  CategoryController.updateCategory
);
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  CategoryController.deleteCategory
);
router.patch(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  CategoryController.restoreCategory
);
router.patch(
  "/:id/toggle-status",
  authenticateToken,
  requireAdmin,
  CategoryController.toggleCategoryStatus
);
router.patch(
  "/display-order",
  authenticateToken,
  requireAdmin,
  CategoryController.updateDisplayOrder
);

/* ------------------ CATEGORY IMAGE MANAGEMENT ------------------ */

// Uploads
router.post(
  "/upload/category/:categoryId",
  authenticateToken,
  requireAdmin,
  FileUploadController.uploadFile
);

// Direct category file access
router.get("/category/:categoryId", FileUploadController.getFile);
router.delete(
  "/category/:categoryId",
  authenticateToken,
  requireAdmin,
  FileUploadController.deleteFile
);

// Batch operations
router.post("/images/batch", (req, res) => {
  (req.params as any).operation = "get";
  return FileUploadController.batchFileOperation(req, res);
});
router.post("/batch/:operation", FileUploadController.batchFileOperation);

// Category images by ID
router.get("/:id/images", (req, res) => {
  (req.params as any).entityType = "category";
  (req.params as any).entityId = req.params.id;
  return FileUploadController.getFile(req, res);
});
router.post("/:id/images", authenticateToken, requireAdmin, (req, res) => {
  (req.params as any).entityType = "category";
  (req.params as any).entityId = req.params.id;
  return FileUploadController.uploadFile(req, res);
});
router.put("/:id/images", authenticateToken, requireAdmin, (req, res) => {
  (req.params as any).entityType = "category";
  (req.params as any).entityId = req.params.id;
  return FileUploadController.uploadFile(req, res);
});
router.patch(
  "/:id/images/replace",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    (req.params as any).entityType = "category";
    (req.params as any).entityId = req.params.id;
    return FileUploadController.uploadFile(req, res);
  }
);
router.delete("/:id/images", authenticateToken, requireAdmin, (req, res) => {
  (req.params as any).entityType = "category";
  (req.params as any).entityId = req.params.id;
  return FileUploadController.deleteFile(req, res);
});

// Category images by slug
router.get("/slug/:slug/images", async (req, res) => {
  try {
    const { CategoryModel } = await import("../models/category.model");

    const category = await CategoryModel.findOne({
      slug: req.params.slug,
      isDeleted: { $ne: true },
    }).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    (req.params as any).entityType = "category";
    (req.params as any).entityId = category._id.toString();
    return FileUploadController.getFile(req, res);
  } catch (error) {
    console.error("Failed to get category image by slug:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve category image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
