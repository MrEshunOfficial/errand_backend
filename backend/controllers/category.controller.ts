// controllers/category.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import { ModerationStatus } from "../types";

export class CategoryController {
  // Helper methods
  private static handleError(res: Response, error: unknown, message: string, statusCode = 500): void {
    console.error(`${message}:`, error);
    
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(400).json({
        success: false,
        message: message.includes("create") ? "Category with this name already exists" : "A category with this name already exists",
      });
      return;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  private static validateObjectId(id: string, fieldName = "ID"): boolean {
    return Types.ObjectId.isValid(id);
  }

  private static sendNotFoundResponse(res: Response, message = "Category not found"): void {
    res.status(404).json({ success: false, message });
  }

  private static sendBadRequestResponse(res: Response, message: string): void {
    res.status(400).json({ success: false, message });
  }

  private static sendSuccessResponse(res: Response, data?: any, message?: string): void {
    const response: any = { success: true };
    if (data) response.data = data;
    if (message) response.message = message;
    res.status(200).json(response);
  }

  private static getPaginationParams(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private static buildPaginationResponse(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

 private static buildCategoryQuery(query: any, includeInactive = false): any {
  const filter: any = { isDeleted: false };
  if (!includeInactive) filter.isActive = true;
  
  const { search, parentId } = query;

  if (search) filter.$text = { $search: search as string };
  
  if (parentId && parentId !== "null") {
    if (!CategoryController.validateObjectId(parentId as string)) {
      throw new Error("Invalid parent category ID");
    }
    filter.parentCategoryId = new Types.ObjectId(parentId as string);
  } else if (parentId === null || parentId === "null") {
    filter.parentCategoryId = null;
  }

  return filter;
}

  private static buildSortOptions(sortBy = "displayOrder", sortOrder = "asc"): any {
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;
    return sort;
  }

  private static async findCategoryById(id: string, includeDeleted = false): Promise<any> {
    if (!CategoryController.validateObjectId(id)) return null;
    
    const filter: any = { _id: id };
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    
    return await CategoryModel.findOne(filter);
  }

  private static async validateParentCategory(parentCategoryId: string, currentId?: string): Promise<string | null> {
    if (!parentCategoryId || !CategoryController.validateObjectId(parentCategoryId)) {
      return "Invalid parent category ID";
    }

    if (currentId && parentCategoryId === currentId) {
      return "Category cannot be its own parent";
    }

    const parentCategory = await CategoryModel.findById(parentCategoryId);
    if (!parentCategory || parentCategory.isDeleted) {
      return "Parent category not found";
    }

    return null;
  }

  private static getUserId(req: AuthenticatedRequest): Types.ObjectId | undefined {
    return req.user?.id ? new Types.ObjectId(req.user.id) : undefined;
  }

    static async getCategoriesWithServices(req: Request, res: Response): Promise<void> {
    try {
      const { 
        servicesLimit = 10, 
        popularOnly = false,
        includeSubcategories = false,
        includeUserData = false,
        includeInactive = false 
      } = req.query;

      const { page, limit, skip } = CategoryController.getPaginationParams(req.query);
      const query = CategoryController.buildCategoryQuery(req.query, includeInactive === "true");
      const sort = CategoryController.buildSortOptions(
        req.query.sortBy as string,
        req.query.sortOrder as string
      );

      let categoryQuery = CategoryModel.find(query);
      
      // Populate services based on preference
      if (popularOnly === "true") {
        categoryQuery = categoryQuery.populate({
          path: "popularServices",
          options: { limit: Number(servicesLimit) }
        });
      } else {
        categoryQuery = categoryQuery.populate({
          path: "services",
          options: { 
            limit: Number(servicesLimit),
            sort: { createdAt: -1 }
          }
        });
      }

      // Always include services count
      categoryQuery = categoryQuery.populate("servicesCount");
      
      // Apply other populations based on query parameters
      if (includeSubcategories === "true") {
        categoryQuery = categoryQuery.populate("subcategories");
      }
      
      if (includeUserData === "true") {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const [categories, total] = await Promise.all([
        categoryQuery.sort(sort).skip(skip).limit(limit),
        CategoryModel.countDocuments(query),
      ]);

      CategoryController.sendSuccessResponse(res, {
        categories,
        pagination: CategoryController.buildPaginationResponse(page, limit, total),
      });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to fetch categories with services");
    }
  }

// Enhanced getCategories with optional services population
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      // Convert query flags into proper booleans
      const includeSubcategories =
        typeof req.query.includeSubcategories === "string" &&
        req.query.includeSubcategories === "true";

      const includeUserData = 
        typeof req.query.includeUserData === "string" &&
        req.query.includeUserData === "true";

      const includeInactive = 
        typeof req.query.includeInactive === "string" &&
        req.query.includeInactive === "true";

      // NEW: Add includeServices option
      const includeServices = 
        typeof req.query.includeServices === "string" &&
        req.query.includeServices === "true";

      const servicesLimit = Number(req.query.servicesLimit) || 5;

      const { page, limit, skip } = CategoryController.getPaginationParams(req.query);
      const query = CategoryController.buildCategoryQuery(req.query, includeInactive);
      const sort = CategoryController.buildSortOptions(
        req.query.sortBy as string,
        req.query.sortOrder as string
      );

      let categoryQuery = CategoryModel.find(query);
      
      // Apply population based on query parameters
      if (includeSubcategories) {
        categoryQuery = categoryQuery.populate("subcategories");
      }
      
      categoryQuery = categoryQuery.populate("servicesCount");
      
      // NEW: Optionally include services
      if (includeServices) {
        categoryQuery = categoryQuery.populate({
          path: "services",
          options: { 
            limit: servicesLimit,
            sort: { createdAt: -1 }
          }
        });
      }
      
      if (includeUserData) {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const [categories, total] = await Promise.all([
        categoryQuery.sort(sort).skip(skip).limit(limit),
        CategoryModel.countDocuments(query),
      ]);

      CategoryController.sendSuccessResponse(res, {
        categories,
        pagination: CategoryController.buildPaginationResponse(page, limit, total),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid parent")) {
        CategoryController.sendBadRequestResponse(res, error.message);
        return;
      }
      CategoryController.handleError(res, error, "Failed to fetch categories");
    }
  }


 // Updated getParentCategories method
  static async getParentCategories(req: Request, res: Response): Promise<void> {
    try {
      const { 
        includeSubcategories = false, 
        includeServicesCount = false, 
        includeUserData = false,
        includeInactive = false,
        // NEW: Add services options
        includeServices = false,
        servicesLimit = 5,
        popularOnly = false
      } = req.query;

      // Build the base query with includeInactive support
      let query = CategoryModel.find({
        parentCategoryId: null,
        isDeleted: false,
        ...(includeInactive !== "true" && { isActive: true })
      });
      
      if (includeSubcategories === "true") {
        query = query.populate({
          path: "subcategories",
          // Optionally populate services for subcategories too
          ...(includeServices === "true" && {
            populate: {
              path: "services",
              options: { limit: Number(servicesLimit), sort: { createdAt: -1 } }
            }
          })
        });
      }
      
      if (includeServicesCount === "true") {
        query = query.populate("servicesCount");
      }

      // NEW: Include services if requested
      if (includeServices === "true") {
        if (popularOnly === "true") {
          query = query.populate({
            path: "popularServices",
            options: { limit: Number(servicesLimit) }
          });
        } else {
          query = query.populate({
            path: "services",
            options: { 
              limit: Number(servicesLimit),
              sort: { createdAt: -1 }
            }
          });
        }
      }
      
      if (includeUserData === "true") {
        query = query
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const categories = await query.sort({ displayOrder: 1 });
      CategoryController.sendSuccessResponse(res, { categories });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to fetch parent categories");
    }
  }


  static async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;
      const { includeUserData = false } = req.query;

      if (!CategoryController.validateObjectId(parentId)) {
        CategoryController.sendBadRequestResponse(res, "Invalid parent category ID");
        return;
      }

      let subcategoriesQuery = CategoryModel.findSubcategories(
        new Types.ObjectId(parentId)
      ).populate("servicesCount");

      if (includeUserData === "true") {
        subcategoriesQuery = subcategoriesQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const subcategories = await subcategoriesQuery;
      CategoryController.sendSuccessResponse(res, { subcategories });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to fetch subcategories");
    }
  }

 // Enhanced getCategoryByIdentifier with services support
  private static async getCategoryByIdentifier(
    req: Request, 
    res: Response, 
    identifier: string, 
    isSlug = false
  ): Promise<void> {
    try {
      const { 
        includeSubcategories = false, 
        includeUserData = false,
        // NEW: Add services options
        includeServices = false,
        servicesLimit = 10,
        popularOnly = false
      } = req.query;

      if (!isSlug && !CategoryController.validateObjectId(identifier)) {
        CategoryController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      const query = isSlug 
        ? CategoryModel.findBySlug(identifier)
        : CategoryModel.findById(identifier);

      let categoryQuery = query;
      
      // Apply population based on query parameters
      if (includeSubcategories === "true") {
        categoryQuery = categoryQuery.populate({
          path: "subcategories",
          // Optionally include services for subcategories
          ...(includeServices === "true" && {
            populate: {
              path: popularOnly === "true" ? "popularServices" : "services",
              options: { limit: Number(servicesLimit) }
            }
          })
        });
      }

      categoryQuery = categoryQuery.populate("servicesCount");

      // NEW: Include services if requested
      if (includeServices === "true") {
        if (popularOnly === "true") {
          categoryQuery = categoryQuery.populate({
            path: "popularServices",
            options: { limit: Number(servicesLimit) }
          });
        } else {
          categoryQuery = categoryQuery.populate({
            path: "services",
            options: { 
              limit: Number(servicesLimit),
              sort: { createdAt: -1 }
            }
          });
        }
      }

      // For non-slug queries or when explicitly requested, include user data
      if (!isSlug || includeUserData === "true") {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const category = await categoryQuery;

      if (!category || (!isSlug && category.isDeleted)) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      CategoryController.sendSuccessResponse(res, { category });
    } catch (error) {
      CategoryController.handleError(res, error, `Failed to fetch category${isSlug ? ' by slug' : ''}`);
    }
  }


  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
      return CategoryController.getCategoryByIdentifier(req, res, req.params.slug, true);
    }

  static async getCategoryById(req: Request, res: Response): Promise<void> {
    return CategoryController.getCategoryByIdentifier(req, res, req.params.id, false);
  }


  static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name, description, image, tags, parentCategoryId,
        displayOrder, metaDescription
      } = req.body;

      // Validate parent category if provided
      if (parentCategoryId) {
        const validationError = await CategoryController.validateParentCategory(parentCategoryId);
        if (validationError) {
          CategoryController.sendBadRequestResponse(res, validationError);
          return;
        }
      }

      const userId = CategoryController.getUserId(req);
      const categoryData = {
        name, description, image, tags, metaDescription,
        parentCategoryId: parentCategoryId ? new Types.ObjectId(parentCategoryId) : null,
        displayOrder: displayOrder || 0,
        createdBy: userId,
        lastModifiedBy: userId,
        moderationStatus: ModerationStatus.PENDING,
      };

      const category = new CategoryModel(categoryData);
      await category.save();

      // Populate user data in the response
      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
        { path: "servicesCount" }
      ]);

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to create category");
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      // Validate parent category if being updated
      if (updateData.parentCategoryId) {
        const validationError = await CategoryController.validateParentCategory(updateData.parentCategoryId, id);
        if (validationError) {
          CategoryController.sendBadRequestResponse(res, validationError);
          return;
        }
        updateData.parentCategoryId = new Types.ObjectId(updateData.parentCategoryId);
      }

      updateData.lastModifiedBy = CategoryController.getUserId(req);

      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        id, updateData, { new: true, runValidators: true }
      )
        .populate("subcategories")
        .populate("servicesCount")
        .populate("createdBy", "name email displayName")
        .populate("lastModifiedBy", "name email displayName");

      CategoryController.sendSuccessResponse(res, { category: updatedCategory }, "Category updated successfully");
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to update category");
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      // Check if category has active subcategories
      const subcategoriesCount = await CategoryModel.countDocuments({
        parentCategoryId: id,
        isDeleted: false,
      });

      if (subcategoriesCount > 0) {
        CategoryController.sendBadRequestResponse(res, "Cannot delete category with active subcategories");
        return;
      }

      await category.softDelete(CategoryController.getUserId(req));
      CategoryController.sendSuccessResponse(res, null, "Category deleted successfully");
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to delete category");
    }
  }

  static async restoreCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id, true);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      if (!category.isDeleted) {
        CategoryController.sendBadRequestResponse(res, "Category is not deleted");
        return;
      }

      await category.restore();
      category.lastModifiedBy = CategoryController.getUserId(req);
      await category.save();

      // Populate user data for the response
      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
        { path: "servicesCount" }
      ]);

      CategoryController.sendSuccessResponse(res, { category }, "Category restored successfully");
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to restore category");
    }
  }

  static async toggleCategoryStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      category.isActive = !category.isActive;
      category.lastModifiedBy = CategoryController.getUserId(req);
      await category.save();

      // Populate user data for the response
      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
        { path: "servicesCount" }
      ]);

      CategoryController.sendSuccessResponse(res, 
        { category }, 
        `Category ${category.isActive ? "activated" : "deactivated"} successfully`
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to toggle category status");
    }
  }

  static async updateDisplayOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories)) {
        CategoryController.sendBadRequestResponse(res, "Categories should be an array");
        return;
      }

      const userId = CategoryController.getUserId(req);
      const updatePromises = categories.map(({ id, displayOrder }) => {
        if (!CategoryController.validateObjectId(id)) {
          throw new Error(`Invalid category ID: ${id}`);
        }
        return CategoryModel.findByIdAndUpdate(id, {
          displayOrder,
          lastModifiedBy: userId,
        }, { new: true });
      });

      const updatedCategories = await Promise.all(updatePromises);
      
      // Optionally populate user data for updated categories
      const populatedCategories = await Promise.all(
        updatedCategories.map(category => 
          category?.populate([
            { path: "createdBy", select: "name email displayName" },
            { path: "lastModifiedBy", select: "name email displayName" }
          ])
        )
      );

      CategoryController.sendSuccessResponse(res, 
        { categories: populatedCategories }, 
        "Display order updated successfully"
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to update display order");
    }
  }

  static async searchCategories(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit = 20, includeInactive = false, parentId, includeUserData = false } = req.query;

      if (!q || typeof q !== "string") {
        CategoryController.sendBadRequestResponse(res, "Search query is required");
        return;
      }

      const query: any = {
        $text: { $search: q },
        isDeleted: false,
      };

      if (includeInactive !== "true") query.isActive = true;

      if (parentId && parentId !== "null") {
        if (!CategoryController.validateObjectId(parentId as string)) {
          CategoryController.sendBadRequestResponse(res, "Invalid parent category ID");
          return;
        }
        query.parentCategoryId = new Types.ObjectId(parentId as string);
      }

      let searchQuery = CategoryModel.find(query)
        .select("name description slug image displayOrder isActive parentCategoryId")
        .populate("servicesCount")
        .limit(Number(limit))
        .sort({ score: { $meta: "textScore" } });

      if (includeUserData === "true") {
        searchQuery = searchQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const categories = await searchQuery;
      CategoryController.sendSuccessResponse(res, { categories });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to search categories");
    }
  }
}