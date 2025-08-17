// controllers/providerProfile.controllers.ts
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import {
  ProviderProfileModel,
  ProviderProfileDocument,
} from "../models/providerProfile.model";
import {
  CreateProviderProfileRequestBody,
  UpdateProviderProfileRequestBody,
  ProviderProfileResponse,
} from "../types";
import {
  ProviderOperationalStatus,
  RiskLevel,
  UserRole,
} from "../types/base.types";
import {
  ApiResponse,
  PaginatedResponse,
  QueryParams,
} from "../types/aggregated.types";
import { Profile } from "../models/profile.model";

// Extended request interface to include authenticated user
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// Utility function for error handling
const handleError = (
  res: Response,
  error: any,
  message: string = "Internal server error"
) => {
  console.error(error);
  return res.status(500).json({
    success: false,
    message,
    error: error.message || error,
  });
};

// Utility function for validation
const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

export class ProviderProfileController {
  /**
   * Create a new provider profile (TOKEN-BASED)
   */
  static async createProviderProfile(
    req: AuthenticatedRequest &
      Request<{}, ProviderProfileResponse, CreateProviderProfileRequestBody>,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const profileData = req.body;
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          message: "Authentication required",
          error: "User not authenticated",
        });
        return;
      }

      // 1. Find the user's profile and verify they're a service provider
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        role: UserRole.PROVIDER, // Ensure they're a service provider
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          message:
            "User profile not found or user is not a service provider. Please create a provider profile first.",
          error: "PROFILE_NOT_FOUND",
        });
        return;
      }

      // 2. Check if provider profile already exists
      const existingProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (existingProfile) {
        res.status(409).json({
          message: "Provider profile already exists for this user",
          error: "PROFILE_EXISTS",
          providerProfile: existingProfile,
        });
        return;
      }

      // 3. Create new provider profile with profileId from userProfile
      const providerProfileData = {
        ...profileData,
        profileId: userProfile._id, // Set from authenticated user's profile

        // System-generated defaults
        operationalStatus: ProviderOperationalStatus.PROBATIONARY,
        riskLevel: RiskLevel.LOW,
        trustScore: 50,
        isAvailableForWork: false, // Start as unavailable until verified
        totalJobs: 0,
        completedJobs: 0,
        cancelledJobs: 0,
        disputedJobs: 0,
        averageRating: 0,
        totalReviews: 0,
        completionRate: 0,
        responseTimeMinutes: 0,
        penaltiesCount: 0,
        warningsCount: 0,
      };

      const newProviderProfile = new ProviderProfileModel(providerProfileData);
      const savedProfile = await newProviderProfile.save();

      // Populate related data with error handling
      try {
        await savedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);

        res.status(201).json({
          message: "Provider profile created successfully",
          providerProfile: savedProfile.toObject(),
        });
      } catch (populateError) {
        console.error("Error during population:", populateError);

        // Return success but without populated data
        res.status(201).json({
          message: "Provider profile created successfully",
          providerProfile: savedProfile.toObject(),
        });
      }
    } catch (error: any) {
      console.error("Error creating provider profile:", error);

      // Log the full error for debugging
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      if (error instanceof Error) {
        // Handle validation errors
        if (error.name === "ValidationError") {
          res.status(400).json({
            message: "Validation error",
            error: error.message,
          });
          return;
        }

        // Handle duplicate key errors
        if (
          error.name === "MongoServerError" &&
          (error as any).code === 11000
        ) {
          res.status(409).json({
            message: "Provider profile already exists",
            error: "Duplicate profile ID",
          });
          return;
        }

        // Handle cast errors (invalid ObjectId)
        if (error.name === "CastError") {
          res.status(400).json({
            message: "Invalid ID format",
            error: "Invalid ObjectId format",
          });
          return;
        }
      }

      res.status(500).json({
        message: "Failed to create provider profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get current user's provider profile (TOKEN-BASED)
   */
  static async getMyProviderProfile(
    req: AuthenticatedRequest,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          message: "Authentication required",
          error: "User not authenticated",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          message: "User profile not found",
          error: "Profile not found",
        });
        return;
      }

      // Find provider profile
      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (!providerProfile) {
        res.status(404).json({
          message: "Provider profile not found",
          error: "Profile not found",
        });
        return;
      }

      try {
        await providerProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);
      } catch (populateError) {
        console.error("Error during population:", populateError);
      }

      res.status(200).json({
        message: "Provider profile retrieved successfully",
        providerProfile: providerProfile.toObject(),
      });
    } catch (error) {
      console.error("Error retrieving provider profile:", error);
      res.status(500).json({
        message: "Failed to retrieve provider profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Update current user's provider profile (TOKEN-BASED)
   */
  static async updateMyProviderProfile(
    req: AuthenticatedRequest &
      Request<{}, ProviderProfileResponse, UpdateProviderProfileRequestBody>,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const updateData = req.body;
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          message: "Authentication required",
          error: "User not authenticated",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          message: "User profile not found",
          error: "Profile not found",
        });
        return;
      }

      // Find provider profile
      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          message: "Provider profile not found",
          error: "Profile not found",
        });
        return;
      }

      // Filter out admin-only fields for regular users
      const {
        profileId,
        operationalStatus,
        trustScore,
        riskLevel,
        totalJobs,
        completedJobs,
        cancelledJobs,
        disputedJobs,
        averageRating,
        totalReviews,
        completionRate,
        responseTimeMinutes,
        penaltiesCount,
        warningsCount,
        lastPenaltyDate,
        suspensionHistory,
        ...userAllowedUpdates
      } = updateData;

      // Update allowed fields only
      Object.assign(providerProfile, userAllowedUpdates);

      const updatedProfile = await providerProfile.save();

      // Try to populate with error handling
      try {
        await updatedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);
      } catch (populateError) {
        console.error(
          "Error during population in updateMyProviderProfile:",
          populateError
        );
      }

      res.status(200).json({
        message: "Provider profile updated successfully",
        providerProfile: updatedProfile.toObject(),
      });
    } catch (error: any) {
      console.error("Error updating provider profile:", error);

      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({
          message: "Validation error",
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        message: "Failed to update provider profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get provider profile by ID (Admin/Public use)
   */
  static async getProviderProfileById(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<ProviderProfileDocument>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      try {
        await providerProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);
      } catch (populateError) {
        console.error("Error during population:", populateError);
      }

      res.status(200).json({
        success: true,
        message: "Provider profile retrieved successfully",
        data: providerProfile,
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider profile");
    }
  }

  /**
   * Get provider profile by profile ID (Admin use)
   */
  static async getProviderProfileByProfileId(
    req: Request<{ profileId: string }>,
    res: Response<ApiResponse<ProviderProfileDocument>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { profileId } = req.params;

      if (!validateObjectId(profileId)) {
        res.status(400).json({
          success: false,
          message: "Invalid profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        profileId: new Types.ObjectId(profileId),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      try {
        await providerProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);
      } catch (populateError) {
        console.error("Error during population:", populateError);
      }

      res.status(200).json({
        success: true,
        message: "Provider profile retrieved successfully",
        data: providerProfile,
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider profile");
    }
  }

  /**
   * Update provider profile by ID (Admin use)
   */
  static async updateProviderProfile(
    req: Request<
      { id: string },
      ProviderProfileResponse,
      UpdateProviderProfileRequestBody
    >,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!validateObjectId(id)) {
        res.status(400).json({
          message: "Invalid provider profile ID",
          error: "INVALID_ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          message: "Provider profile not found",
          error: "PROFILE_NOT_FOUND",
        });
        return;
      }

      // Apply updates (exclude profileId from updates)
      const { ...allowedUpdates } = updates;
      Object.assign(providerProfile, allowedUpdates);

      const updatedProfile = await providerProfile.save();

      try {
        await updatedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "serviceOfferings",
            select: "name description categoryId",
          },
        ]);
      } catch (populateError) {
        console.error("Error during population:", populateError);
      }

      res.status(200).json({
        message: "Provider profile updated successfully",
        providerProfile: updatedProfile.toObject(),
      });
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({
          message: "Validation error",
          error: error.message,
        });
        return;
      }
      handleError(res, error, "Failed to update provider profile");
    }
  }

  /**
   * Delete provider profile (soft delete)
   */
  static async deleteProviderProfile(
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      // Assume user ID is available from auth middleware
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // Soft delete
      providerProfile.isDeleted = true;
      providerProfile.deletedAt = new Date();
      if (userId) {
        providerProfile.deletedBy = new Types.ObjectId(userId.toString());
      }

      await providerProfile.save();

      res.status(200).json({
        success: true,
        message: "Provider profile deleted successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to delete provider profile");
    }
  }

  /**
   * Get all provider profiles with pagination and filtering
   */
  static async getAllProviderProfiles(
    req: Request<
      {},
      ApiResponse<PaginatedResponse<ProviderProfileDocument>>,
      {},
      QueryParams & {
        status?: ProviderOperationalStatus;
        riskLevel?: RiskLevel;
        available?: boolean;
        serviceId?: string;
      }
    >,
    res: Response<ApiResponse<PaginatedResponse<ProviderProfileDocument>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        sort = "createdAt",
        order = "desc",
        status,
        riskLevel,
        available,
        serviceId,
      } = req.query;

      // Build filter object
      const filter: any = { isDeleted: { $ne: true } };

      if (status) {
        filter.operationalStatus = status;
      }

      if (riskLevel) {
        filter.riskLevel = riskLevel;
      }

      if (available !== undefined) {
        filter.isAvailableForWork = (available as unknown as string) === "true";
      }

      if (serviceId && validateObjectId(serviceId)) {
        filter.serviceOfferings = new Types.ObjectId(serviceId);
      }

      // Calculate pagination
      const pageNum = Math.max(1, parseInt(page as unknown as string));
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(limit as unknown as string))
      );
      const skip = (pageNum - 1) * limitNum;
      const sortDirection = order === "asc" ? 1 : -1;

      // Execute query
      const [profiles, total] = await Promise.all([
        ProviderProfileModel.find(filter)
          .populate([
            {
              path: "profileId",
              select: "userId role bio location contactDetails",
            },
            {
              path: "serviceOfferings",
              select: "name description categoryId",
            },
          ])
          .sort({ [sort]: sortDirection })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ProviderProfileModel.countDocuments(filter),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limitNum);
      const hasNext = pageNum < totalPages;
      const hasPrev = pageNum > 1;

      res.status(200).json({
        success: true,
        message: "Provider profiles retrieved successfully",
        data: {
          data: profiles,
          total,
          page: pageNum,
          limit: limitNum,
          hasNext,
          hasPrev,
          totalPages,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider profiles");
    }
  }

  /**
   * Get available providers
   */
  static async getAvailableProviders(
    req: Request<
      {},
      ApiResponse<ProviderProfileDocument[]>,
      {},
      { serviceRadius?: string }
    >,
    res: Response<ApiResponse<ProviderProfileDocument[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { serviceRadius } = req.query;
      const radius = serviceRadius ? Number(serviceRadius) : undefined;

      const availableProviders =
        await ProviderProfileModel.findAvailableProviders(radius);

      res.status(200).json({
        success: true,
        message: "Available providers retrieved successfully",
        data: availableProviders,
      });
    } catch (error) {
      handleError(res, error, "Failed to get available providers");
    }
  }

  /**
   * Get top-rated providers
   */
  static async getTopRatedProviders(
    req: Request<
      {},
      ApiResponse<ProviderProfileDocument[]>,
      {},
      { limit?: string }
    >,
    res: Response<ApiResponse<ProviderProfileDocument[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { limit } = req.query;
      const limitNumber = limit ? Number(limit) : 10;

      const topProviders = await ProviderProfileModel.findTopRatedProviders(
        limitNumber
      );

      res.status(200).json({
        success: true,
        message: "Top-rated providers retrieved successfully",
        data: topProviders,
      });
    } catch (error) {
      handleError(res, error, "Failed to get top-rated providers");
    }
  }

  /**
   * Get high-risk providers
   */
  static async getHighRiskProviders(
    req: Request,
    res: Response<ApiResponse<ProviderProfileDocument[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const highRiskProviders =
        await ProviderProfileModel.findHighRiskProviders();

      res.status(200).json({
        success: true,
        message: "High-risk providers retrieved successfully",
        data: highRiskProviders,
      });
    } catch (error) {
      handleError(res, error, "Failed to get high-risk providers");
    }
  }

  /**
   * Update provider operational status (Admin only)
   */
  static async updateOperationalStatus(
    req: Request<
      { id: string },
      ApiResponse,
      { status: ProviderOperationalStatus; reason?: string }
    >,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      if (!Object.values(ProviderOperationalStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: "Invalid operational status",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.updateOperationalStatus(status, reason);

      res.status(200).json({
        success: true,
        message: "Operational status updated successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to update operational status");
    }
  }

  /**
   * Toggle provider availability (TOKEN-BASED)
   */
  static async toggleMyAvailability(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: "User profile not found",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.toggleAvailability();

      res.status(200).json({
        success: true,
        message: `Provider availability ${
          providerProfile.isAvailableForWork ? "enabled" : "disabled"
        } successfully`,
      });
    } catch (error) {
      handleError(res, error, "Failed to toggle availability");
    }
  }

  /**
   * Toggle provider availability by ID (Admin use)
   */
  static async toggleAvailability(
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.toggleAvailability();

      res.status(200).json({
        success: true,
        message: `Provider availability ${
          providerProfile.isAvailableForWork ? "enabled" : "disabled"
        } successfully`,
      });
    } catch (error) {
      handleError(res, error, "Failed to toggle availability");
    }
  }

  /**
   * Update performance metrics (Admin only)
   */
  static async updatePerformanceMetrics(
    req: Request<
      { id: string },
      ApiResponse,
      Partial<{
        completionRate: number;
        averageRating: number;
        totalJobs: number;
        responseTimeMinutes: number;
        averageResponseTime: number;
        cancellationRate: number;
        disputeRate: number;
        clientRetentionRate: number;
      }>
    >,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.updatePerformanceMetrics(updates);

      res.status(200).json({
        success: true,
        message: "Performance metrics updated successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to update performance metrics");
    }
  }

  /**
   * Add service offering to current user's profile (TOKEN-BASED)
   */
  static async addMyServiceOffering(
    req: AuthenticatedRequest & Request<{}, ApiResponse, { serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { serviceId } = req.body;
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID provided",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: "User profile not found",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // Add service offering directly
      if (!providerProfile.serviceOfferings) {
        providerProfile.serviceOfferings = [];
      }

      const serviceObjectId = new Types.ObjectId(serviceId);
      if (
        !providerProfile.serviceOfferings.some((s) => s.equals(serviceObjectId))
      ) {
        providerProfile.serviceOfferings.push(serviceObjectId);
        await providerProfile.save();
      }

      res.status(200).json({
        success: true,
        message: "Service offering added successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  /**
   * Add service offering by provider ID (Admin use)
   */
  static async addServiceOffering(
    req: Request<{ id: string }, ApiResponse, { serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { serviceId } = req.body;

      if (!validateObjectId(id) || !validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid ID provided",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // Add service offering directly
      if (!providerProfile.serviceOfferings) {
        providerProfile.serviceOfferings = [];
      }

      const serviceObjectId = new Types.ObjectId(serviceId);
      if (
        !providerProfile.serviceOfferings.some((s) => s.equals(serviceObjectId))
      ) {
        providerProfile.serviceOfferings.push(serviceObjectId);
        await providerProfile.save();
      }

      res.status(200).json({
        success: true,
        message: "Service offering added successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  /**
   * Remove service offering from current user's profile (TOKEN-BASED)
   */
  static async removeMyServiceOffering(
    req: AuthenticatedRequest & Request<{}, ApiResponse, { serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { serviceId } = req.body;
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      if (!validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID provided",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: "User profile not found",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.removeServiceOffering(
        new Types.ObjectId(serviceId)
      );

      res.status(200).json({
        success: true,
        message: "Service offering removed successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to remove service offering");
    }
  }

  /**
   * Remove service offering by provider ID (Admin use)
   */
  static async removeServiceOffering(
    req: Request<{ id: string; serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id, serviceId } = req.params;

      if (!validateObjectId(id) || !validateObjectId(serviceId)) {
        res.status(400).json({
          success: false,
          message: "Invalid ID provided",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.removeServiceOffering(
        new Types.ObjectId(serviceId)
      );

      res.status(200).json({
        success: true,
        message: "Service offering removed successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to remove service offering");
    }
  }

  /**
   * Add penalty to provider (Admin only)
   */
  static async addPenalty(
    req: Request<{ id: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      // Add penalty directly
      providerProfile.penaltiesCount += 1;
      providerProfile.lastPenaltyDate = new Date();

      // Auto-adjust risk level based on penalties
      if (providerProfile.penaltiesCount >= 5) {
        providerProfile.riskLevel = RiskLevel.HIGH;
      } else if (providerProfile.penaltiesCount >= 3) {
        providerProfile.riskLevel = RiskLevel.MEDIUM;
      }

      await providerProfile.save();

      res.status(200).json({
        success: true,
        message: "Penalty added successfully",
        data: {
          penaltiesCount: providerProfile.penaltiesCount,
          riskLevel: providerProfile.riskLevel,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to add penalty");
    }
  }

  /**
   * Update working hours for current user (TOKEN-BASED)
   */
  static async updateMyWorkingHours(
    req: AuthenticatedRequest &
      Request<
        {},
        ApiResponse,
        {
          day: string;
          hours: { start: string; end: string; isAvailable: boolean };
        }
      >,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { day, hours } = req.body;
      const userId = req.userId || req.user?.id || req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Validate day
      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      if (!validDays.includes(day.toLowerCase())) {
        res.status(400).json({
          success: false,
          message: "Invalid day of week",
        });
        return;
      }

      // Find user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          success: false,
          message: "User profile not found",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.updateWorkingHours(day, hours);

      res.status(200).json({
        success: true,
        message: "Working hours updated successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to update working hours");
    }
  }

  /**
   * Update working hours by provider ID (Admin use)
   */
  static async updateWorkingHours(
    req: Request<
      { id: string },
      ApiResponse,
      {
        day: string;
        hours: { start: string; end: string; isAvailable: boolean };
      }
    >,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { day, hours } = req.body;

      if (!validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid provider profile ID",
        });
        return;
      }

      // Validate day
      const validDays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      if (!validDays.includes(day.toLowerCase())) {
        res.status(400).json({
          success: false,
          message: "Invalid day of week",
        });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({
          success: false,
          message: "Provider profile not found",
        });
        return;
      }

      await providerProfile.updateWorkingHours(day, hours);

      res.status(200).json({
        success: true,
        message: "Working hours updated successfully",
      });
    } catch (error) {
      handleError(res, error, "Failed to update working hours");
    }
  }
}

export default ProviderProfileController;
