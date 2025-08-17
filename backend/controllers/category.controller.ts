// controllers/category.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { ModerationStatus } from "../types";

// Extend Express Request to include user with proper typing
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
  };
}

export class CategoryController {
  // Get all active categories
  static async getCategories(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "displayOrder",
        sortOrder = "asc",
        search,
        parentId,
        includeSubcategories = false,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      // Build query
      const query: any = { isActive: true, isDeleted: false };

      if (search) {
        query.$text = { $search: search as string };
      }

      if (parentId && parentId !== "null") {
        if (!Types.ObjectId.isValid(parentId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid parent category ID",
          });
        }
        query.parentCategoryId = new Types.ObjectId(parentId as string);
      } else if (parentId === null || parentId === "null") {
        query.parentCategoryId = null;
      }

      const categories = await CategoryModel.find(query)
        .populate(includeSubcategories === "true" ? "subcategories" : "")
        .populate("servicesCount")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      const total = await CategoryModel.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          categories,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get parent categories only
  static async getParentCategories(req: Request, res: Response) {
    try {
      const { includeSubcategories = false, includeServicesCount = false } =
        req.query;

      let query = CategoryModel.findParentCategories();

      if (includeSubcategories === "true") {
        query = query.populate("subcategories");
      }

      if (includeServicesCount === "true") {
        query = query.populate("servicesCount");
      }

      const categories = await query;

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      console.error("Error fetching parent categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch parent categories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get subcategories of a parent category
  static async getSubcategories(req: Request, res: Response) {
    try {
      const { parentId } = req.params;

      if (!Types.ObjectId.isValid(parentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category ID",
        });
      }

      const subcategories = await CategoryModel.findSubcategories(
        new Types.ObjectId(parentId)
      ).populate("servicesCount");

      res.status(200).json({
        success: true,
        data: { subcategories },
      });
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subcategories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get category by slug
  static async getCategoryBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const { includeSubcategories = false } = req.query;

      let query = CategoryModel.findBySlug(slug);

      if (includeSubcategories === "true") {
        query = query.populate("subcategories");
      }

      const category = await query.populate("servicesCount");

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      res.status(200).json({
        success: true,
        data: { category },
      });
    } catch (error) {
      console.error("Error fetching category by slug:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get category by ID
  static async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { includeSubcategories = false } = req.query;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      let query = CategoryModel.findById(id);

      if (includeSubcategories === "true") {
        query = query.populate("subcategories");
      }

      const category = await query
        .populate("servicesCount")
        .populate("createdBy", "name email")
        .populate("lastModifiedBy", "name email");

      if (!category || category.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      res.status(200).json({
        success: true,
        data: { category },
      });
    } catch (error) {
      console.error("Error fetching category by ID:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new category
  static async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        name,
        description,
        image,
        tags,
        parentCategoryId,
        displayOrder,
        // slug, // Remove this - it will be auto-generated
        metaDescription,
      } = req.body;

      // Remove slug existence check since it's auto-generated

      // Validate parent category if provided
      if (parentCategoryId && Types.ObjectId.isValid(parentCategoryId)) {
        const parentCategory = await CategoryModel.findById(parentCategoryId);
        if (!parentCategory || parentCategory.isDeleted) {
          return res.status(400).json({
            success: false,
            message: "Parent category not found",
          });
        }
      }

      const userId = req.user?.id ? new Types.ObjectId(req.user.id) : undefined;

      const categoryData = {
        name,
        description,
        image,
        tags,
        parentCategoryId: parentCategoryId
          ? new Types.ObjectId(parentCategoryId)
          : null,
        displayOrder: displayOrder || 0,
        // slug will be auto-generated from name
        metaDescription,
        createdBy: userId,
        lastModifiedBy: userId,
        moderationStatus: ModerationStatus.PENDING,
      };

      const category = new CategoryModel(categoryData);
      await category.save();

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Error creating category:", error);

      if (error instanceof Error && error.message.includes("duplicate key")) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to create category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update category
  static async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await CategoryModel.findById(id);
      if (!category || category.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Validate parent category if being updated
      if (
        updateData.parentCategoryId &&
        Types.ObjectId.isValid(updateData.parentCategoryId)
      ) {
        const parentCategory = await CategoryModel.findById(
          updateData.parentCategoryId
        );
        if (!parentCategory || parentCategory.isDeleted) {
          return res.status(400).json({
            success: false,
            message: "Parent category not found",
          });
        }

        // Prevent circular reference
        if (updateData.parentCategoryId === id) {
          return res.status(400).json({
            success: false,
            message: "Category cannot be its own parent",
          });
        }
      }

      // Convert parentCategoryId to ObjectId if it's a string
      if (updateData.parentCategoryId) {
        updateData.parentCategoryId = new Types.ObjectId(
          updateData.parentCategoryId
        );
      }

      updateData.lastModifiedBy = req.user?.id
        ? new Types.ObjectId(req.user.id)
        : undefined;

      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate("subcategories")
        .populate("servicesCount");

      res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: { category: updatedCategory },
      });
    } catch (error) {
      console.error("Error updating category:", error);

      if (error instanceof Error && error.message.includes("duplicate key")) {
        return res.status(400).json({
          success: false,
          message: "A category with this name already exists",
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Soft delete category
  static async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await CategoryModel.findById(id);
      if (!category || category.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Check if category has active subcategories
      const subcategoriesCount = await CategoryModel.countDocuments({
        parentCategoryId: id,
        isDeleted: false,
      });

      if (subcategoriesCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete category with active subcategories",
        });
      }

      const deletedBy = req.user?.id
        ? new Types.ObjectId(req.user.id)
        : undefined;

      await category.softDelete(deletedBy);

      res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Restore deleted category
  static async restoreCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await CategoryModel.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      if (!category.isDeleted) {
        return res.status(400).json({
          success: false,
          message: "Category is not deleted",
        });
      }

      await category.restore();
      category.lastModifiedBy = req.user?.id
        ? new Types.ObjectId(req.user.id)
        : undefined;
      await category.save();

      res.status(200).json({
        success: true,
        message: "Category restored successfully",
        data: { category },
      });
    } catch (error) {
      console.error("Error restoring category:", error);
      res.status(500).json({
        success: false,
        message: "Failed to restore category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle category active status
  static async toggleCategoryStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
      }

      const category = await CategoryModel.findById(id);
      if (!category || category.isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      category.isActive = !category.isActive;
      category.lastModifiedBy = req.user?.id
        ? new Types.ObjectId(req.user.id)
        : undefined;
      await category.save();

      res.status(200).json({
        success: true,
        message: `Category ${
          category.isActive ? "activated" : "deactivated"
        } successfully`,
        data: { category },
      });
    } catch (error) {
      console.error("Error toggling category status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle category status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update display order
  static async updateDisplayOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const { categories } = req.body; // Array of { id, displayOrder }

      if (!Array.isArray(categories)) {
        return res.status(400).json({
          success: false,
          message: "Categories should be an array",
        });
      }

      const userId = req.user?.id ? new Types.ObjectId(req.user.id) : undefined;

      const updatePromises = categories.map(({ id, displayOrder }) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid category ID: ${id}`);
        }
        return CategoryModel.findByIdAndUpdate(
          id,
          {
            displayOrder,
            lastModifiedBy: userId,
          },
          { new: true }
        );
      });

      await Promise.all(updatePromises);

      res.status(200).json({
        success: true,
        message: "Display order updated successfully",
      });
    } catch (error) {
      console.error("Error updating display order:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update display order",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Search categories
  static async searchCategories(req: Request, res: Response) {
    try {
      const { q, limit = 20, includeInactive = false, parentId } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          message: "Search query is required",
        });
      }

      const query: any = {
        $text: { $search: q },
        isDeleted: false,
      };

      if (includeInactive !== "true") {
        query.isActive = true;
      }

      if (parentId && parentId !== "null") {
        if (!Types.ObjectId.isValid(parentId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid parent category ID",
          });
        }
        query.parentCategoryId = new Types.ObjectId(parentId as string);
      }

      const categories = await CategoryModel.find(query)
        .select(
          "name description slug image displayOrder isActive parentCategoryId"
        )
        .populate("servicesCount")
        .limit(Number(limit))
        .sort({ score: { $meta: "textScore" } });

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      console.error("Error searching categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search categories",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
