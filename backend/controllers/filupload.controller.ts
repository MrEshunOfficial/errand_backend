// controllers/fileUpload.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { Profile } from "../models/profile.model";
import { ServiceModel } from "../models/service.model";
import { User } from "../models/user.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import { FileReference, ProfilePicture } from "../types";

// Supported entity types for file uploads
export enum FileUploadEntity {
  PROFILE = "profile",
  CATEGORY = "category",
  SERVICE = "service",
  USER_AVATAR = "user_avatar",
}

// File type configurations
interface FileTypeConfig {
  allowedMimeTypes: string[];
  maxFileSize: number; // in bytes
  allowedExtensions?: string[];
  fieldName: string; // field name in the entity model
}

const FILE_TYPE_CONFIGS: Record<FileUploadEntity, FileTypeConfig> = {
  [FileUploadEntity.PROFILE]: {
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    fieldName: "profilePicture",
  },
  [FileUploadEntity.CATEGORY]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    fieldName: "image",
  },
  [FileUploadEntity.SERVICE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB for services (might have multiple images)
    fieldName: "images",
  },
  [FileUploadEntity.USER_AVATAR]: {
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxFileSize: 2 * 1024 * 1024, // 2MB for avatars
    fieldName: "avatar",
  },
};

// Batch operation result interface
interface BatchOperationResult {
  entityType: string;
  entityId: string;
  success: boolean;
  error?: string;
  hasFile?: boolean;
  file?: FileReference | ProfilePicture | null;
}

// Batch entity interface
interface BatchEntity {
  entityType: string;
  entityId: string;
}

export class FileUploadController {
  // ==================== HELPER METHODS ====================

  private static handleError(
    res: Response,
    error: unknown,
    message: string,
    statusCode = 500
  ): void {
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

  private static sendNotFoundResponse(
    res: Response,
    message = "Entity not found"
  ): void {
    res.status(404).json({ success: false, message });
  }

  private static sendBadRequestResponse(res: Response, message: string): void {
    res.status(400).json({ success: false, message });
  }

  private static sendSuccessResponse(
    res: Response,
    data?: any,
    message?: string,
    statusCode = 200
  ): void {
    const response: any = { success: true };
    if (data) response.data = data;
    if (message) response.message = message;
    res.status(statusCode).json(response);
  }

  private static getUserId(
    req: AuthenticatedRequest
  ): Types.ObjectId | undefined {
    return req.user?.id ? new Types.ObjectId(req.user.id) : undefined;
  }

  private static validateEntityType(
    entityType: string
  ): entityType is FileUploadEntity {
    return Object.values(FileUploadEntity).includes(
      entityType as FileUploadEntity
    );
  }

  private static validateFileData(
    fileData: any,
    entityType: FileUploadEntity
  ): string | null {
    if (!fileData) return "File data is required";

    const config = FILE_TYPE_CONFIGS[entityType];

    // Basic validation
    if (!fileData.url || !fileData.fileName) {
      return "File URL and filename are required";
    }

    // File size validation
    if (fileData.fileSize && fileData.fileSize > config.maxFileSize) {
      const maxSizeMB = config.maxFileSize / (1024 * 1024);
      return `File size cannot exceed ${maxSizeMB}MB`;
    }

    // MIME type validation
    if (
      fileData.mimeType &&
      !config.allowedMimeTypes.includes(fileData.mimeType)
    ) {
      return `Invalid file format. Only ${config.allowedMimeTypes.join(
        ", "
      )} are allowed`;
    }

    return null;
  }

  private static async findEntityById(
    entityType: FileUploadEntity,
    id: string,
    additionalFilters?: any
  ): Promise<any> {
    if (!FileUploadController.validateObjectId(id)) return null;

    const filter = { _id: id, ...additionalFilters };

    // Add common filters based on entity type
    switch (entityType) {
      case FileUploadEntity.CATEGORY:
        filter.isDeleted = { $ne: true };
        return await CategoryModel.findOne(filter).lean();

      case FileUploadEntity.PROFILE:
        filter.isDeleted = { $ne: true };
        // Use explicit typing to avoid the union type issue
        return await (Profile as any).findOne(filter).lean();

      case FileUploadEntity.SERVICE:
        filter.isDeleted = { $ne: true };
        return await ServiceModel.findOne(filter).lean();

      case FileUploadEntity.USER_AVATAR:
        // No additional filters for user avatar
        return await User.findOne(filter).lean();

      default:
        return null;
    }
  }

  private static buildUpdateQuery(
    entityType: FileUploadEntity,
    fileData: FileReference | ProfilePicture,
    userId?: Types.ObjectId
  ): any {
    const config = FILE_TYPE_CONFIGS[entityType];
    const updateQuery: any = {
      $set: {
        [config.fieldName]: fileData,
      },
    };

    // Add lastModified fields based on entity type
    if (entityType === FileUploadEntity.PROFILE) {
      updateQuery.$set.lastModified = new Date();
    } else if (
      entityType === FileUploadEntity.CATEGORY ||
      entityType === FileUploadEntity.SERVICE
    ) {
      if (userId) updateQuery.$set.lastModifiedBy = userId;
    }

    return updateQuery;
  }

  private static prepareFileData(
    rawFileData: any,
    entityType: FileUploadEntity
  ): FileReference | ProfilePicture {
    const baseFileData = {
      ...rawFileData,
      uploadedAt: rawFileData.uploadedAt || new Date(),
    };

    // Entity-specific data preparation
    switch (entityType) {
      case FileUploadEntity.PROFILE:
        return baseFileData as ProfilePicture;
      default:
        return baseFileData as FileReference;
    }
  }

  private static getEntitySpecificQuery(
    entityType: FileUploadEntity,
    req: AuthenticatedRequest
  ): any {
    switch (entityType) {
      case FileUploadEntity.PROFILE:
        return { userId: req.userId };
      default:
        return {};
    }
  }

  // ==================== MAIN UPLOAD METHODS ====================

  /**
   * Generic file upload handler
   * POST /api/files/upload/:entityType/:entityId
   */
  static async uploadFile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { entityType, entityId } = req.params;
      const { file: fileData } = req.body;

      // Validate entity type
      if (!FileUploadController.validateEntityType(entityType)) {
        FileUploadController.sendBadRequestResponse(
          res,
          `Invalid entity type. Supported types: ${Object.values(
            FileUploadEntity
          ).join(", ")}`
        );
        return;
      }

      // Validate entity ID (except for profile which uses userId from auth)
      if (
        entityType !== FileUploadEntity.PROFILE &&
        !FileUploadController.validateObjectId(entityId)
      ) {
        FileUploadController.sendBadRequestResponse(res, "Invalid entity ID");
        return;
      }

      // Validate file data
      const validationError = FileUploadController.validateFileData(
        fileData,
        entityType
      );
      if (validationError) {
        FileUploadController.sendBadRequestResponse(res, validationError);
        return;
      }

      // Handle profile upload (uses authenticated user)
      if (entityType === FileUploadEntity.PROFILE) {
        return await FileUploadController.handleProfileUpload(
          req,
          res,
          fileData
        );
      }

      // Find entity
      const entity = await FileUploadController.findEntityById(
        entityType,
        entityId
      );
      if (!entity) {
        FileUploadController.sendNotFoundResponse(
          res,
          `${entityType} not found`
        );
        return;
      }

      // Prepare file data
      const preparedFileData = FileUploadController.prepareFileData(
        fileData,
        entityType
      );

      // Build update query
      const updateQuery = FileUploadController.buildUpdateQuery(
        entityType,
        preparedFileData,
        FileUploadController.getUserId(req)
      );

      // Update entity with proper typing
      let updatedEntity;
      switch (entityType) {
        case FileUploadEntity.CATEGORY:
          updatedEntity = await CategoryModel.findByIdAndUpdate(
            entityId,
            updateQuery,
            { new: true, runValidators: true }
          ).lean();
          break;

        case FileUploadEntity.SERVICE:
          updatedEntity = await ServiceModel.findByIdAndUpdate(
            entityId,
            updateQuery,
            { new: true, runValidators: true }
          ).lean();
          break;

        case FileUploadEntity.USER_AVATAR:
          updatedEntity = await User.findByIdAndUpdate(entityId, updateQuery, {
            new: true,
            runValidators: true,
          }).lean();
          break;

        default:
          FileUploadController.sendNotFoundResponse(
            res,
            `${entityType} not found`
          );
          return;
      }

      if (!updatedEntity) {
        FileUploadController.sendNotFoundResponse(
          res,
          `${entityType} not found`
        );
        return;
      }

      FileUploadController.sendSuccessResponse(
        res,
        {
          entityType,
          entityId,
          file: preparedFileData,
          entity: updatedEntity,
        },
        `${entityType} file uploaded successfully`,
        201
      );
    } catch (error) {
      FileUploadController.handleError(res, error, "Failed to upload file");
    }
  }

  /**
   * Handle profile-specific upload logic
   */
  private static async handleProfileUpload(
    req: AuthenticatedRequest,
    res: Response,
    fileData: any
  ): Promise<void> {
    const userId = req.userId;
    if (!userId) {
      FileUploadController.sendBadRequestResponse(
        res,
        "User authentication required"
      );
      return;
    }

    // Get user and profile with explicit casting
    const [user, profile] = await Promise.all([
      User.findById(userId).lean(),
      (Profile as any).findOne({ userId }).lean(),
    ]);

    if (!user) {
      FileUploadController.sendNotFoundResponse(res, "User not found");
      return;
    }

    // Prepare profile picture data
    const profilePictureData = FileUploadController.prepareFileData(
      fileData,
      FileUploadEntity.PROFILE
    ) as ProfilePicture;

    // Update or create profile with explicit casting
    const updatedProfile = await (Profile as any).findOneAndUpdate(
      { userId },
      {
        $set: {
          profilePicture: profilePictureData,
          lastModified: new Date(),
        },
      },
      { new: true, runValidators: true, upsert: true, lean: true }
    );

    FileUploadController.sendSuccessResponse(
      res,
      {
        entityType: FileUploadEntity.PROFILE,
        file: profilePictureData,
        profile: updatedProfile,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      },
      "Profile picture uploaded successfully",
      201
    );
  }

  /**
   * Get file by entity type and ID
   * GET /api/files/:entityType/:entityId
   */
  static async getFile(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      // Validate entity type
      if (!FileUploadController.validateEntityType(entityType)) {
        FileUploadController.sendBadRequestResponse(
          res,
          `Invalid entity type. Supported types: ${Object.values(
            FileUploadEntity
          ).join(", ")}`
        );
        return;
      }

      // Handle profile file retrieval (uses auth)
      if (entityType === FileUploadEntity.PROFILE) {
        return await FileUploadController.handleProfileFileRetrieval(req, res);
      }

      // Validate entity ID
      if (!FileUploadController.validateObjectId(entityId)) {
        FileUploadController.sendBadRequestResponse(res, "Invalid entity ID");
        return;
      }

      // Find entity
      const entity = await FileUploadController.findEntityById(
        entityType,
        entityId
      );
      if (!entity) {
        FileUploadController.sendNotFoundResponse(
          res,
          `${entityType} not found`
        );
        return;
      }

      const config = FILE_TYPE_CONFIGS[entityType];
      const fileData = entity[config.fieldName];

      if (!fileData) {
        FileUploadController.sendSuccessResponse(
          res,
          {
            hasFile: false,
            entityType,
            entityId,
          },
          `No file found for this ${entityType}`
        );
        return;
      }

      FileUploadController.sendSuccessResponse(
        res,
        {
          file: fileData,
          hasFile: true,
          entityType,
          entityId,
        },
        `${entityType} file retrieved successfully`
      );
    } catch (error) {
      FileUploadController.handleError(res, error, "Failed to retrieve file");
    }
  }

  /**
   * Handle profile file retrieval
   */
  private static async handleProfileFileRetrieval(
    req: Request,
    res: Response
  ): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId;

    if (!userId) {
      FileUploadController.sendBadRequestResponse(
        res,
        "User authentication required"
      );
      return;
    }

    const profile = await (Profile as any).findOne({ userId }).lean();
    if (!profile) {
      FileUploadController.sendNotFoundResponse(res, "Profile not found");
      return;
    }

    if (!profile.profilePicture) {
      FileUploadController.sendSuccessResponse(
        res,
        {
          hasFile: false,
          entityType: FileUploadEntity.PROFILE,
        },
        "No profile picture found"
      );
      return;
    }

    FileUploadController.sendSuccessResponse(
      res,
      {
        file: profile.profilePicture,
        hasFile: true,
        entityType: FileUploadEntity.PROFILE,
      },
      "Profile picture retrieved successfully"
    );
  }

  /**
   * Delete file
   * DELETE /api/files/:entityType/:entityId
   */
  static async deleteFile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      // Validate entity type
      if (!FileUploadController.validateEntityType(entityType)) {
        FileUploadController.sendBadRequestResponse(
          res,
          `Invalid entity type. Supported types: ${Object.values(
            FileUploadEntity
          ).join(", ")}`
        );
        return;
      }

      // Handle profile file deletion
      if (entityType === FileUploadEntity.PROFILE) {
        return await FileUploadController.handleProfileFileDeletion(req, res);
      }

      // Validate entity ID
      if (!FileUploadController.validateObjectId(entityId)) {
        FileUploadController.sendBadRequestResponse(res, "Invalid entity ID");
        return;
      }

      // Find entity
      const entity = await FileUploadController.findEntityById(
        entityType,
        entityId
      );
      if (!entity) {
        FileUploadController.sendNotFoundResponse(
          res,
          `${entityType} not found`
        );
        return;
      }

      const config = FILE_TYPE_CONFIGS[entityType];
      const fileData = entity[config.fieldName];

      if (!fileData) {
        FileUploadController.sendBadRequestResponse(
          res,
          `${entityType} has no file to delete`
        );
        return;
      }

      // Build delete query
      const deleteQuery: any = {
        $unset: { [config.fieldName]: 1 },
      };

      // Add lastModified fields
      if (
        entityType === FileUploadEntity.CATEGORY ||
        entityType === FileUploadEntity.SERVICE
      ) {
        deleteQuery.$set = {
          lastModifiedBy: FileUploadController.getUserId(req),
        };
      }

      // Delete file with proper model-specific calls
      let updatedEntity;
      switch (entityType) {
        case FileUploadEntity.CATEGORY:
          updatedEntity = await CategoryModel.findByIdAndUpdate(
            entityId,
            deleteQuery,
            { new: true }
          ).lean();
          break;

        case FileUploadEntity.SERVICE:
          updatedEntity = await ServiceModel.findByIdAndUpdate(
            entityId,
            deleteQuery,
            { new: true }
          ).lean();
          break;

        case FileUploadEntity.USER_AVATAR:
          updatedEntity = await User.findByIdAndUpdate(entityId, deleteQuery, {
            new: true,
          }).lean();
          break;

        default:
          FileUploadController.sendNotFoundResponse(
            res,
            `${entityType} not found`
          );
          return;
      }

      if (!updatedEntity) {
        FileUploadController.sendNotFoundResponse(
          res,
          `${entityType} not found`
        );
        return;
      }

      FileUploadController.sendSuccessResponse(
        res,
        {
          entityType,
          entityId,
          deletedFile: fileData,
          entity: updatedEntity,
        },
        `${entityType} file deleted successfully`
      );
    } catch (error) {
      FileUploadController.handleError(res, error, "Failed to delete file");
    }
  }

  /**
   * Handle profile file deletion
   */
  private static async handleProfileFileDeletion(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.userId;
    if (!userId) {
      FileUploadController.sendBadRequestResponse(
        res,
        "User authentication required"
      );
      return;
    }

    const profile = await (Profile as any).findOne({ userId });
    if (!profile) {
      FileUploadController.sendNotFoundResponse(res, "Profile not found");
      return;
    }

    if (!profile.profilePicture) {
      FileUploadController.sendBadRequestResponse(
        res,
        "Profile has no picture to delete"
      );
      return;
    }

    const deletedPicture = profile.profilePicture;

    const updatedProfile = await (Profile as any)
      .findOneAndUpdate(
        { userId },
        {
          $unset: { profilePicture: 1 },
          $set: { lastModified: new Date() },
        },
        { new: true }
      )
      .lean();

    const user = await User.findById(userId).lean();

    FileUploadController.sendSuccessResponse(
      res,
      {
        entityType: FileUploadEntity.PROFILE,
        deletedFile: deletedPicture,
        profile: updatedProfile,
        user: user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
            }
          : null,
      },
      "Profile picture deleted successfully"
    );
  }

  /**
   * Batch file operations
   * POST /api/files/batch/:operation
   */
  static async batchFileOperation(req: Request, res: Response): Promise<void> {
    try {
      const { operation } = req.params;
      const { entities }: { entities: BatchEntity[] } = req.body;

      if (!Array.isArray(entities)) {
        FileUploadController.sendBadRequestResponse(
          res,
          "Entities array is required"
        );
        return;
      }

      if (!["get", "delete"].includes(operation)) {
        FileUploadController.sendBadRequestResponse(
          res,
          "Invalid operation. Supported: get, delete"
        );
        return;
      }

      const results: BatchOperationResult[] = [];

      for (const { entityType, entityId } of entities) {
        try {
          if (
            !FileUploadController.validateEntityType(entityType) ||
            !FileUploadController.validateObjectId(entityId)
          ) {
            results.push({
              entityType,
              entityId,
              success: false,
              error: "Invalid entity type or ID",
            });
            continue;
          }

          const entity = await FileUploadController.findEntityById(
            entityType,
            entityId
          );
          if (!entity) {
            results.push({
              entityType,
              entityId,
              success: false,
              error: "Entity not found",
            });
            continue;
          }

          const config = FILE_TYPE_CONFIGS[entityType];
          const fileData = entity[config.fieldName];

          results.push({
            entityType,
            entityId,
            success: true,
            hasFile: !!fileData,
            file: fileData || null,
          });
        } catch (error) {
          results.push({
            entityType,
            entityId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      FileUploadController.sendSuccessResponse(
        res,
        {
          operation,
          results,
          total: results.length,
          successful: results.filter((r) => r.success).length,
        },
        `Batch ${operation} operation completed`
      );
    } catch (error) {
      FileUploadController.handleError(
        res,
        error,
        "Failed to execute batch operation"
      );
    }
  }
}
