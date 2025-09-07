// controllers/categoryImage.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { ServiceModel } from "../models/service.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import { FileReference, ServiceStatus } from "../types";

export class CategoryImageController {
  // ==================== HELPER METHODS ====================
  
  private static handleError(res: Response, error: unknown, message: string, statusCode = 500): void {
    console.error(`${message}:`, error);
    res.status(statusCode).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  private static validateObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  private static sendNotFoundResponse(res: Response, message = "Category not found"): void {
    res.status(404).json({ success: false, message });
  }

  private static sendBadRequestResponse(res: Response, message: string): void {
    res.status(400).json({ success: false, message });
  }

  private static sendSuccessResponse(res: Response, data?: any, message?: string, statusCode = 200): void {
    const response: any = { success: true };
    if (data) response.data = data;
    if (message) response.message = message;
    res.status(statusCode).json(response);
  }

  private static getUserId(req: AuthenticatedRequest): Types.ObjectId | undefined {
    return req.user?.id ? new Types.ObjectId(req.user.id) : undefined;
  }

  private static isAdminUser(req: Request): boolean {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return false;
    return user?.isAdmin === true || user?.isSuperAdmin === true;
  }

  private static buildServiceCountQuery(categoryId: Types.ObjectId, req: Request): any {
    const baseQuery = {
      categoryId,
      isDeleted: { $ne: true }
    };

    if (CategoryImageController.isAdminUser(req)) {
      return baseQuery;
    } else {
      return { ...baseQuery, status: ServiceStatus.APPROVED };
    }
  }

  private static validateImageData(image: any): string | null {
    if (!image) return "Image data is required";
    if (!image.url || !image.fileName) return "Image URL and filename are required";
    
    // File size validation (5MB max)
    const maxFileSize = 5 * 1024 * 1024;
    if (image.fileSize && image.fileSize > maxFileSize) {
      return "Image file size cannot exceed 5MB";
    }

    // MIME type validation
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (image.mimeType && !allowedMimeTypes.includes(image.mimeType)) {
      return "Invalid image format. Only JPEG, PNG, WebP, and GIF are allowed";
    }

    return null;
  }

  private static async findCategoryById(id: string, includeDeleted = false): Promise<any> {
    if (!CategoryImageController.validateObjectId(id)) return null;
    
    const filter: any = { _id: id };
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    
    return await CategoryModel.findOne(filter);
  }

  private static async enrichCategoryWithMetadata(category: any, req: Request): Promise<any> {
    const serviceCountQuery = CategoryImageController.buildServiceCountQuery(category._id, req);
    const servicesCount = await ServiceModel.countDocuments(serviceCountQuery);

    const enrichedCategory = {
      ...category,
      servicesCount
    };

    // Populate user data
    await CategoryModel.populate(enrichedCategory, [
      { path: "createdBy", select: "name email displayName" },
      { path: "lastModifiedBy", select: "name email displayName" }
    ]);

    return enrichedCategory;
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Upload/Update category image
   * POST /api/categories/:id/images (for new upload)
   * PUT /api/categories/:id/images/:imageId (for update - future use)
   */
  static async uploadImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: categoryId } = req.params;
      const { image } = req.body;

      // Validate category ID
      if (!CategoryImageController.validateObjectId(categoryId)) {
        CategoryImageController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      // Validate image data
      const validationError = CategoryImageController.validateImageData(image);
      if (validationError) {
        CategoryImageController.sendBadRequestResponse(res, validationError);
        return;
      }

      // Check if category exists
      const category = await CategoryImageController.findCategoryById(categoryId);
      if (!category) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Prepare image data
      const imageData: FileReference = {
        ...image,
        uploadedAt: image.uploadedAt || new Date()
      };

      // Update category with new image
      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        categoryId,
        {
          $set: {
            image: imageData,
            lastModifiedBy: CategoryImageController.getUserId(req)
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCategory) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Enrich with metadata
      const enrichedCategory = await CategoryImageController.enrichCategoryWithMetadata(updatedCategory, req);

      CategoryImageController.sendSuccessResponse(
        res,
        { 
          category: enrichedCategory,
          image: imageData
        },
        "Category image uploaded successfully",
        201
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to upload category image");
    }
  }

  /**
   * Get category image
   * GET /api/categories/:id/images
   */
  static async getImage(req: Request, res: Response): Promise<void> {
    try {
      const { id: categoryId } = req.params;

      // Validate category ID
      if (!CategoryImageController.validateObjectId(categoryId)) {
        CategoryImageController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      // Find category with image
      const category = await CategoryModel.findOne({
        _id: categoryId,
        isDeleted: false
      }).select('image name slug isActive').lean();

      if (!category) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      if (!category.image) {
        CategoryImageController.sendSuccessResponse(
          res,
          { 
            hasImage: false,
            categoryName: category.name,
            categorySlug: category.slug
          },
          "No image found for this category"
        );
        return;
      }

      CategoryImageController.sendSuccessResponse(
        res,
        {
          image: category.image,
          hasImage: true,
          categoryName: category.name,
          categorySlug: category.slug,
          categoryActive: category.isActive
        },
        "Category image retrieved successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to retrieve category image");
    }
  }

  /**
   * Get category image by slug
   * GET /api/categories/slug/:slug/images
   */
  static async getImageBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      // Find category by slug
      const category = await CategoryModel.findOne({
        slug,
        isDeleted: false,
        isActive: true
      }).select('image name slug').lean();

      if (!category) {
        CategoryImageController.sendNotFoundResponse(res, "Category not found");
        return;
      }

      if (!category.image) {
        CategoryImageController.sendSuccessResponse(
          res,
          { 
            hasImage: false,
            categoryName: category.name,
            categorySlug: category.slug
          },
          "No image found for this category"
        );
        return;
      }

      CategoryImageController.sendSuccessResponse(
        res,
        {
          image: category.image,
          hasImage: true,
          categoryName: category.name,
          categorySlug: category.slug
        },
        "Category image retrieved successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to retrieve category image by slug");
    }
  }

  /**
   * Update existing category image
   * PUT /api/categories/:id/images
   */
  static async updateImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: categoryId } = req.params;
      const { image } = req.body;

      // Validate category ID
      if (!CategoryImageController.validateObjectId(categoryId)) {
        CategoryImageController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      // Validate image data
      const validationError = CategoryImageController.validateImageData(image);
      if (validationError) {
        CategoryImageController.sendBadRequestResponse(res, validationError);
        return;
      }

      // Check if category exists and has an image
      const category = await CategoryImageController.findCategoryById(categoryId);
      if (!category) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      if (!category.image) {
        CategoryImageController.sendBadRequestResponse(res, "Category has no existing image to update");
        return;
      }

      // Prepare updated image data
      const imageData: FileReference = {
        ...image,
        uploadedAt: image.uploadedAt || new Date()
      };

      // Update category image
      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        categoryId,
        {
          $set: {
            image: imageData,
            lastModifiedBy: CategoryImageController.getUserId(req)
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCategory) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Enrich with metadata
      const enrichedCategory = await CategoryImageController.enrichCategoryWithMetadata(updatedCategory, req);

      CategoryImageController.sendSuccessResponse(
        res,
        { 
          category: enrichedCategory,
          image: imageData
        },
        "Category image updated successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to update category image");
    }
  }

  /**
   * Delete category image
   * DELETE /api/categories/:id/images
   */
  static async deleteImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: categoryId } = req.params;

      // Validate category ID
      if (!CategoryImageController.validateObjectId(categoryId)) {
        CategoryImageController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      // Check if category exists
      const category = await CategoryImageController.findCategoryById(categoryId);
      if (!category) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Check if category has an image
      if (!category.image) {
        CategoryImageController.sendBadRequestResponse(res, "Category has no image to delete");
        return;
      }

      // Store the image info before deletion for response
      const deletedImage = category.image;

      // Remove the image
      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        categoryId,
        {
          $unset: { image: 1 },
          $set: { lastModifiedBy: CategoryImageController.getUserId(req) }
        },
        { new: true }
      ).lean();

      if (!updatedCategory) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Enrich with metadata
      const enrichedCategory = await CategoryImageController.enrichCategoryWithMetadata(updatedCategory, req);

      CategoryImageController.sendSuccessResponse(
        res,
        { 
          category: enrichedCategory,
          deletedImage
        },
        "Category image deleted successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to delete category image");
    }
  }

  /**
   * Get multiple category images (batch operation)
   * GET /api/categories/images/batch?ids=id1,id2,id3
   */
  static async getBatchImages(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.query;

      if (!ids || typeof ids !== 'string') {
        CategoryImageController.sendBadRequestResponse(res, "Category IDs are required");
        return;
      }

      const categoryIds = ids.split(',').filter(id => CategoryImageController.validateObjectId(id));
      
      if (categoryIds.length === 0) {
        CategoryImageController.sendBadRequestResponse(res, "No valid category IDs provided");
        return;
      }

      const categories = await CategoryModel.find({
        _id: { $in: categoryIds },
        isDeleted: false
      }).select('_id name slug image isActive').lean();

      const results = categories.map(category => ({
        categoryId: category._id,
        categoryName: category.name,
        categorySlug: category.slug,
        isActive: category.isActive,
        hasImage: !!category.image,
        image: category.image || null
      }));

      CategoryImageController.sendSuccessResponse(
        res,
        { 
          categories: results,
          total: results.length,
          requestedCount: categoryIds.length
        },
        "Category images retrieved successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to retrieve category images");
    }
  }

  /**
   * Replace category image (upload new, remove old)
   * PATCH /api/categories/:id/images/replace
   */
  static async replaceImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: categoryId } = req.params;
      const { image } = req.body;

      // Validate category ID
      if (!CategoryImageController.validateObjectId(categoryId)) {
        CategoryImageController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      // Validate new image data
      const validationError = CategoryImageController.validateImageData(image);
      if (validationError) {
        CategoryImageController.sendBadRequestResponse(res, validationError);
        return;
      }

      // Check if category exists
      const category = await CategoryImageController.findCategoryById(categoryId);
      if (!category) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Store old image info (if exists) for response
      const oldImage = category.image || null;

      // Prepare new image data
      const newImageData: FileReference = {
        ...image,
        uploadedAt: new Date()
      };

      // Replace the image
      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        categoryId,
        {
          $set: {
            image: newImageData,
            lastModifiedBy: CategoryImageController.getUserId(req)
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCategory) {
        CategoryImageController.sendNotFoundResponse(res);
        return;
      }

      // Enrich with metadata
      const enrichedCategory = await CategoryImageController.enrichCategoryWithMetadata(updatedCategory, req);

      CategoryImageController.sendSuccessResponse(
        res,
        { 
          category: enrichedCategory,
          newImage: newImageData,
          oldImage,
          wasReplaced: !!oldImage
        },
        oldImage ? "Category image replaced successfully" : "Category image added successfully"
      );
    } catch (error) {
      CategoryImageController.handleError(res, error, "Failed to replace category image");
    }
  }
}