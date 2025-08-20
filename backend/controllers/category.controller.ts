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

  private static buildCategoryQuery(query: any): any {
    const filter: any = { isActive: true, isDeleted: false };
    const { search, parentId } = query;

    if (search) filter.$text = { $search: search as string };
    
    if (parentId && parentId !== "null") {
      if (!this.validateObjectId(parentId as string)) {
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
    if (!this.validateObjectId(id)) return null;
    
    const filter: any = { _id: id };
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    
    return await CategoryModel.findOne(filter);
  }

  private static async validateParentCategory(parentCategoryId: string, currentId?: string): Promise<string | null> {
    if (!parentCategoryId || !this.validateObjectId(parentCategoryId)) {
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

  // Main controller methods
  static async getCategories(req: Request, res: Response): Promise<void> {
  try {
    // Convert query flag into a proper boolean
    const includeSubcategories =
      typeof req.query.includeSubcategories === "string" &&
      req.query.includeSubcategories === "true";

    const { page, limit, skip } = this.getPaginationParams(req.query);
    const query = this.buildCategoryQuery(req.query);
    const sort = this.buildSortOptions(
      req.query.sortBy as string,
      req.query.sortOrder as string
    );

    const [categories, total] = await Promise.all([
      CategoryModel.find(query)
        .populate(includeSubcategories ? "subcategories" : "")
        .populate("servicesCount")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      CategoryModel.countDocuments(query),
    ]);

    this.sendSuccessResponse(res, {
      categories,
      pagination: this.buildPaginationResponse(page, limit, total),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid parent")) {
      this.sendBadRequestResponse(res, error.message);
      return;
    }
    this.handleError(res, error, "Failed to fetch categories");
  }
}


  static async getParentCategories(req: Request, res: Response): Promise<void> {
    try {
      const { includeSubcategories = false, includeServicesCount = false } = req.query;

      let query = CategoryModel.findParentCategories();
      
      if (includeSubcategories === "true") query = query.populate("subcategories");
      if (includeServicesCount === "true") query = query.populate("servicesCount");

      const categories = await query;
      this.sendSuccessResponse(res, { categories });
    } catch (error) {
      this.handleError(res, error, "Failed to fetch parent categories");
    }
  }

  static async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;

      if (!this.validateObjectId(parentId)) {
        this.sendBadRequestResponse(res, "Invalid parent category ID");
        return;
      }

      const subcategories = await CategoryModel.findSubcategories(
        new Types.ObjectId(parentId)
      ).populate("servicesCount");

      this.sendSuccessResponse(res, { subcategories });
    } catch (error) {
      this.handleError(res, error, "Failed to fetch subcategories");
    }
  }

  private static async getCategoryByIdentifier(
    req: Request, 
    res: Response, 
    identifier: string, 
    isSlug = false
  ): Promise<void> {
    try {
      const { includeSubcategories = false } = req.query;

      if (!isSlug && !this.validateObjectId(identifier)) {
        this.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      const query = isSlug 
        ? CategoryModel.findBySlug(identifier)
        : CategoryModel.findById(identifier);

      let categoryQuery = query;
      if (includeSubcategories === "true") {
        categoryQuery = categoryQuery.populate("subcategories");
      }

      const populateFields = isSlug 
        ? "servicesCount"
        : "servicesCount createdBy lastModifiedBy";

      const category = await categoryQuery.populate(populateFields);

      if (!category || (!isSlug && category.isDeleted)) {
        this.sendNotFoundResponse(res);
        return;
      }

      this.sendSuccessResponse(res, { category });
    } catch (error) {
      this.handleError(res, error, `Failed to fetch category${isSlug ? ' by slug' : ''}`);
    }
  }

  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
    return this.getCategoryByIdentifier(req, res, req.params.slug, true);
  }

  static async getCategoryById(req: Request, res: Response): Promise<void> {
    return this.getCategoryByIdentifier(req, res, req.params.id, false);
  }

  static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        name, description, image, tags, parentCategoryId,
        displayOrder, metaDescription
      } = req.body;

      // Validate parent category if provided
      if (parentCategoryId) {
        const validationError = await this.validateParentCategory(parentCategoryId);
        if (validationError) {
          this.sendBadRequestResponse(res, validationError);
          return;
        }
      }

      const userId = this.getUserId(req);
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

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      this.handleError(res, error, "Failed to create category");
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const category = await this.findCategoryById(id);
      if (!category) {
        this.sendNotFoundResponse(res);
        return;
      }

      // Validate parent category if being updated
      if (updateData.parentCategoryId) {
        const validationError = await this.validateParentCategory(updateData.parentCategoryId, id);
        if (validationError) {
          this.sendBadRequestResponse(res, validationError);
          return;
        }
        updateData.parentCategoryId = new Types.ObjectId(updateData.parentCategoryId);
      }

      updateData.lastModifiedBy = this.getUserId(req);

      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        id, updateData, { new: true, runValidators: true }
      ).populate("subcategories").populate("servicesCount");

      this.sendSuccessResponse(res, { category: updatedCategory }, "Category updated successfully");
    } catch (error) {
      this.handleError(res, error, "Failed to update category");
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await this.findCategoryById(id);
      if (!category) {
        this.sendNotFoundResponse(res);
        return;
      }

      // Check if category has active subcategories
      const subcategoriesCount = await CategoryModel.countDocuments({
        parentCategoryId: id,
        isDeleted: false,
      });

      if (subcategoriesCount > 0) {
        this.sendBadRequestResponse(res, "Cannot delete category with active subcategories");
        return;
      }

      await category.softDelete(this.getUserId(req));
      this.sendSuccessResponse(res, null, "Category deleted successfully");
    } catch (error) {
      this.handleError(res, error, "Failed to delete category");
    }
  }

  static async restoreCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await this.findCategoryById(id, true);
      if (!category) {
        this.sendNotFoundResponse(res);
        return;
      }

      if (!category.isDeleted) {
        this.sendBadRequestResponse(res, "Category is not deleted");
        return;
      }

      await category.restore();
      category.lastModifiedBy = this.getUserId(req);
      await category.save();

      this.sendSuccessResponse(res, { category }, "Category restored successfully");
    } catch (error) {
      this.handleError(res, error, "Failed to restore category");
    }
  }

  static async toggleCategoryStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await this.findCategoryById(id);
      if (!category) {
        this.sendNotFoundResponse(res);
        return;
      }

      category.isActive = !category.isActive;
      category.lastModifiedBy = this.getUserId(req);
      await category.save();

      this.sendSuccessResponse(res, 
        { category }, 
        `Category ${category.isActive ? "activated" : "deactivated"} successfully`
      );
    } catch (error) {
      this.handleError(res, error, "Failed to toggle category status");
    }
  }

  static async updateDisplayOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories)) {
        this.sendBadRequestResponse(res, "Categories should be an array");
        return;
      }

      const userId = this.getUserId(req);
      const updatePromises = categories.map(({ id, displayOrder }) => {
        if (!this.validateObjectId(id)) {
          throw new Error(`Invalid category ID: ${id}`);
        }
        return CategoryModel.findByIdAndUpdate(id, {
          displayOrder,
          lastModifiedBy: userId,
        }, { new: true });
      });

      await Promise.all(updatePromises);
      this.sendSuccessResponse(res, null, "Display order updated successfully");
    } catch (error) {
      this.handleError(res, error, "Failed to update display order");
    }
  }

  static async searchCategories(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit = 20, includeInactive = false, parentId } = req.query;

      if (!q || typeof q !== "string") {
        this.sendBadRequestResponse(res, "Search query is required");
        return;
      }

      const query: any = {
        $text: { $search: q },
        isDeleted: false,
      };

      if (includeInactive !== "true") query.isActive = true;

      if (parentId && parentId !== "null") {
        if (!this.validateObjectId(parentId as string)) {
          this.sendBadRequestResponse(res, "Invalid parent category ID");
          return;
        }
        query.parentCategoryId = new Types.ObjectId(parentId as string);
      }

      const categories = await CategoryModel.find(query)
        .select("name description slug image displayOrder isActive parentCategoryId")
        .populate("servicesCount")
        .limit(Number(limit))
        .sort({ score: { $meta: "textScore" } });

      this.sendSuccessResponse(res, { categories });
    } catch (error) {
      this.handleError(res, error, "Failed to search categories");
    }
  }
}