// controllers/providerProfile.controllers.ts
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import {
  ProviderProfileModel,
  ProviderProfileDocument,
} from "../models/providerProfile.model";
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
import { AuthenticatedRequest, handleError, validateObjectId } from "../utils/controller-utils/controller.utils";
import { ProviderProfileResponse, CreateProviderProfileRequestBody, UpdateProviderProfileRequestBody, ProviderProfile } from "../types";

export class ProviderProfileController {
  // Common population options
  private static readonly POPULATE_OPTIONS = [
    { path: "profileId", select: "userId role bio location contactDetails" },
    { path: "serviceOfferings", select: "title description status images slug", options: { slice: { images: 1 } } },
  ];

  // Helper to get user profile with error handling
  private static async getUserProfile(userId: string | Types.ObjectId, res: Response) {
    const userProfile = await Profile.findOne({
      userId: new Types.ObjectId(userId.toString()),
      isDeleted: { $ne: true },
    }).exec();

    if (!userProfile) {
      res.status(404).json({
        message: "User profile not found",
        error: "Profile not found",
      });
      return null;
    }
    return userProfile;
  }

  // Helper to get provider profile with optional user validation
  private static async getProviderProfile(
    filter: any,
    res: Response,
    errorMessage = "Provider profile not found"
  ) {
    const providerProfile = await ProviderProfileModel.findOne({
      ...filter,
      isDeleted: { $ne: true },
    });

    if (!providerProfile) {
      res.status(404).json({
        success: false,
        message: errorMessage,
        error: "Profile not found",
      });
      return null;
    }
    return providerProfile;
  }

  // Helper to authenticate and get user provider profile
  private static async authenticateAndGetProfile(req: AuthenticatedRequest, res: Response) {
    const userId = req.userId || req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "User not authenticated",
      });
      return null;
    }

    const userProfile = await this.getUserProfile(userId, res);
    if (!userProfile) return null;

    const providerProfile = await this.getProviderProfile(
      { profileId: userProfile._id },
      res
    );
    return providerProfile;
  }

  // Helper to safely populate with error handling
  private static async safePopulate(document: any, populateOptions = this.POPULATE_OPTIONS) {
    try {
      await document.populate(populateOptions);
    } catch (populateError) {
      console.error("Error during population:", populateError);
    }
    return document;
  }

  // Helper to send success response
  private static sendSuccess(res: Response, message: string, data?: any, status = 200) {
    const response: any = { success: true, message };
    if (data !== undefined) response.data = data;
    if (data?.providerProfile !== undefined) response.providerProfile = data.providerProfile;
    res.status(status).json(response);
  }

  /**
   * Create a new provider profile (TOKEN-BASED)
   */
  static async createProviderProfile(
    req: AuthenticatedRequest & Request<{}, ProviderProfileResponse, CreateProviderProfileRequestBody>,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId || req.user?.id || req.user?._id;
      if (!userId) {
        res.status(401).json({ message: "Authentication required", error: "User not authenticated" });
        return;
      }

      // Find and validate user profile
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        role: UserRole.PROVIDER,
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          message: "User profile not found or user is not a service provider. Please create a provider profile first.",
          error: "PROFILE_NOT_FOUND",
        });
        return;
      }

      // Check for existing profile
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

      // Create with defaults aligned with new model
      const providerProfileData = {
        ...req.body,
        profileId: userProfile._id,
        operationalStatus: ProviderOperationalStatus.PROBATIONARY,
        riskLevel: RiskLevel.MEDIUM,
        isCurrentlyAvailable: true,
        isAlwaysAvailable: false,
        requireInitialDeposit: false,
      };

      const savedProfile = await new ProviderProfileModel(providerProfileData).save();
      await this.safePopulate(savedProfile);

      res.status(201).json({
        message: "Provider profile created successfully",
        providerProfile: savedProfile.toObject(),
      });
    } catch (error: any) {
      console.error("Error creating provider profile:", error);
      
      const errorHandlers: Record<string, () => Response<ProviderProfileResponse>> = {
        ValidationError: () => res.status(400).json({ message: "Validation error", error: error.message }),
        MongoServerError: () =>
          error.code === 11000
            ? res.status(409).json({
                message: "Provider profile already exists",
                error: "Duplicate profile ID",
              })
            : res.status(500).json({
                message: "Unknown Mongo server error",
                error: "MONGO_SERVER_ERROR",
              }),
        CastError: () => res.status(400).json({ message: "Invalid ID format", error: "Invalid ObjectId format" }),
      };

      if (error instanceof Error && errorHandlers[error.name]) {
        errorHandlers[error.name]();
        return;
      }

      res.status(500).json({ message: "Failed to create provider profile", error: "Internal server error" });
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
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;

      await this.safePopulate(providerProfile);
      res.status(200).json({
        message: "Provider profile retrieved successfully",
        providerProfile: providerProfile.toObject(),
      });
    } catch (error) {
      console.error("Error retrieving provider profile:", error);
      res.status(500).json({ message: "Failed to retrieve provider profile", error: "Internal server error" });
    }
  }

  /**
   * Update current user's provider profile (TOKEN-BASED)
   */
  static async updateMyProviderProfile(
    req: AuthenticatedRequest & Request<{}, ProviderProfileResponse, UpdateProviderProfileRequestBody>,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;

      // Filter out admin-only and system-managed fields
      const {
        profileId, operationalStatus, riskLevel, penaltiesCount, lastPenaltyDate,
        lastRiskAssessmentDate, riskAssessedBy, performanceMetrics,
        ...userAllowedUpdates
      } = req.body;

      Object.assign(providerProfile, userAllowedUpdates);
      const updatedProfile = await providerProfile.save();
      await this.safePopulate(updatedProfile);

      res.status(200).json({
        message: "Provider profile updated successfully",
        providerProfile: updatedProfile.toObject(),
      });
    } catch (error: any) {
      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({ message: "Validation error", error: error.message });
        return;
      }
      res.status(500).json({ message: "Failed to update provider profile", error: "Internal server error" });
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
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await this.safePopulate(providerProfile);
      this.sendSuccess(res, "Provider profile retrieved successfully", providerProfile);
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
        res.status(400).json({ success: false, message: "Invalid profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile(
        { profileId: new Types.ObjectId(profileId) },
        res
      );
      if (!providerProfile) return;

      await this.safePopulate(providerProfile);
      this.sendSuccess(res, "Provider profile retrieved successfully", providerProfile);
    } catch (error) {
      handleError(res, error, "Failed to get provider profile");
    }
  }

  /**
   * Update provider profile by ID (Admin use)
   */
  static async updateProviderProfile(
    req: Request<{ id: string }, ProviderProfileResponse, UpdateProviderProfileRequestBody>,
    res: Response<ProviderProfileResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ message: "Invalid provider profile ID", error: "INVALID_ID" });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!providerProfile) {
        res.status(404).json({ message: "Provider profile not found", error: "PROFILE_NOT_FOUND" });
        return;
      }

      Object.assign(providerProfile, req.body);
      const updatedProfile = await providerProfile.save();
      await this.safePopulate(updatedProfile);

      res.status(200).json({
        message: "Provider profile updated successfully",
        providerProfile: updatedProfile.toObject(),
      });
    } catch (error: any) {
      if (error.name === "ValidationError") {
        res.status(400).json({ message: "Validation error", error: error.message });
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
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      providerProfile.isDeleted = true;
      providerProfile.deletedAt = new Date();
      if (userId) providerProfile.deletedBy = new Types.ObjectId(userId.toString());

      await providerProfile.save();
      this.sendSuccess(res, "Provider profile deleted successfully");
    } catch (error) {
      handleError(res, error, "Failed to delete provider profile");
    }
  }

  /**
   * Get all provider profiles with pagination and filtering
   */
  static async getAllProviderProfiles(
    req: Request<{}, ApiResponse<PaginatedResponse<ProviderProfileDocument>>, {}, 
      QueryParams & { status?: ProviderOperationalStatus; riskLevel?: RiskLevel; available?: boolean; serviceId?: string; }>,
    res: Response<ApiResponse<PaginatedResponse<ProviderProfileDocument>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { page = 1, limit = 10, sort = "createdAt", order = "desc", status, riskLevel, available, serviceId } = req.query;

      // Build filter
      const filter: any = { isDeleted: { $ne: true } };
      if (status) filter.operationalStatus = status;
      if (riskLevel) filter.riskLevel = riskLevel;
      if (available !== undefined) filter.isCurrentlyAvailable = (available as unknown as string) === "true";
      if (serviceId && validateObjectId(serviceId)) filter.serviceOfferings = new Types.ObjectId(serviceId);

      // Pagination
      const pageNum = Math.max(1, parseInt(page as unknown as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as unknown as string)));
      const skip = (pageNum - 1) * limitNum;
      const sortDirection = order === "asc" ? 1 : -1;

      const [profiles, total] = await Promise.all([
        ProviderProfileModel.find(filter)
          .populate(this.POPULATE_OPTIONS)
          .sort({ [sort]: sortDirection })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ProviderProfileModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limitNum);
      this.sendSuccess(res, "Provider profiles retrieved successfully", {
        data: profiles,
        total,
        page: pageNum,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        totalPages,
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider profiles");
    }
  }

  // Simplified helper methods using model static methods
  static async getAvailableProviders(
    req: Request<{}, ApiResponse<ProviderProfileDocument[]>, {}, { serviceRadius?: string }>, 
    res: Response<ApiResponse<ProviderProfileDocument[]>>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const radius = req.query.serviceRadius ? Number(req.query.serviceRadius) : undefined;
      const providers = await ProviderProfileModel.findAvailableProviders(radius);
      this.sendSuccess(res, "Available providers retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get available providers");
    }
  }

  static async getTopRatedProviders(
    req: Request<{}, ApiResponse<ProviderProfileDocument[]>, {}, { limit?: string }>, 
    res: Response<ApiResponse<ProviderProfileDocument[]>>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const limitNumber = req.query.limit ? Number(req.query.limit) : 10;
      const providers = await ProviderProfileModel.findTopRatedProviders(limitNumber);
      this.sendSuccess(res, "Top-rated providers retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get top-rated providers");
    }
  }

  static async getHighRiskProviders(
    req: Request, 
    res: Response<ApiResponse<ProviderProfileDocument[]>>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const providers = await ProviderProfileModel.findHighRiskProviders();
      this.sendSuccess(res, "High-risk providers retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get high-risk providers");
    }
  }

  /**
   * Update provider operational status (Admin only)
   */
  static async updateOperationalStatus(
    req: Request<{ id: string }, ApiResponse, { status: ProviderOperationalStatus; reason?: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!validateObjectId(id) || !Object.values(ProviderOperationalStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: !validateObjectId(id) ? "Invalid provider profile ID" : "Invalid operational status",
        });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await providerProfile.updateOperationalStatus(status, reason);
      this.sendSuccess(res, "Operational status updated successfully");
    } catch (error) {
      handleError(res, error, "Failed to update operational status");
    }
  }

  /**
   * Toggle availability methods - consolidated logic
   */
  private static async toggleAvailabilityLogic(providerProfile: any, res: Response) {
    await providerProfile.toggleAvailability();
    this.sendSuccess(res, `Provider availability ${providerProfile.isCurrentlyAvailable ? "enabled" : "disabled"} successfully`);
  }

  static async toggleMyAvailability(
    req: AuthenticatedRequest, 
    res: Response<ApiResponse>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      await this.toggleAvailabilityLogic(providerProfile, res);
    } catch (error) {
      handleError(res, error, "Failed to toggle availability");
    }
  }

  static async toggleAvailability(
    req: Request<{ id: string }>, 
    res: Response<ApiResponse>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;
      await this.toggleAvailabilityLogic(providerProfile, res);
    } catch (error) {
      handleError(res, error, "Failed to toggle availability");
    }
  }

  /**
   * Update performance metrics (Admin only)
   */
  static async updatePerformanceMetrics(
    req: Request<{ id: string }, ApiResponse, Partial<ProviderProfile['performanceMetrics']>>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await providerProfile.updatePerformanceMetrics(req.body);
      this.sendSuccess(res, "Performance metrics updated successfully");
    } catch (error) {
      handleError(res, error, "Failed to update performance metrics");
    }
  }

  // Service offering management
  private static async manageServiceOffering(
    providerProfile: any,
    serviceId: string,
    action: 'add' | 'remove',
    res: Response
  ): Promise<boolean> {
    if (!validateObjectId(serviceId)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid service ID format",
        error: "INVALID_SERVICE_ID"
      });
      return false;
    }

    const serviceObjectId = new Types.ObjectId(serviceId);
    
    // Verify service exists in database
    const { ServiceModel } = await import('../models/service.model.js');
    const serviceExists = await ServiceModel.findOne({
      _id: serviceObjectId,
      isDeleted: false,
      status: 'approved'
    });

    if (!serviceExists) {
      res.status(404).json({ 
        success: false, 
        message: "Service not found or not approved",
        error: "SERVICE_NOT_FOUND"
      });
      return false;
    }

    try {
      if (action === 'add') {
        await providerProfile.addServiceOffering(serviceObjectId);
      } else {
        await providerProfile.removeServiceOffering(serviceObjectId);
      }

      ProviderProfileController.sendSuccess(
        res, 
        `Service offering ${action === 'add' ? 'added' : 'removed'} successfully`,
        { serviceOfferings: providerProfile.serviceOfferings }
      );
      return true;
      
    } catch (error: any) {
      console.error(`Error ${action}ing service offering:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to ${action} service offering`,
        error: error.message
      });
      return false;
    }
  }

  // Token-based methods
  static async addMyServiceOffering(
    req: AuthenticatedRequest & Request<{}, ApiResponse, { serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.body.serviceId) {
        res.status(400).json({ 
          success: false, 
          message: "Service ID is required in request body",
          error: "MISSING_SERVICE_ID"
        });
        return;
      }

      const providerProfile = await ProviderProfileController.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      
      await ProviderProfileController.manageServiceOffering(
        providerProfile, 
        req.body.serviceId, 
        'add', 
        res
      );
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  static async removeMyServiceOffering(
    req: AuthenticatedRequest & Request<{ serviceId: string }, ApiResponse>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { serviceId } = req.params;
      
      if (!serviceId) {
        res.status(400).json({ 
          success: false, 
          message: "Service ID is required in URL params",
          error: "MISSING_SERVICE_ID"
        });
        return;
      }

      const providerProfile = await ProviderProfileController.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      
      await ProviderProfileController.manageServiceOffering(
        providerProfile, 
        serviceId, 
        'remove', 
        res
      );
    } catch (error) {
      handleError(res, error, "Failed to remove service offering");
    }
  }

  // Admin methods
  static async addServiceOffering(
    req: Request<{ id: string }, ApiResponse, { serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!validateObjectId(id)) {
        res.status(400).json({ 
          success: false, 
          message: "Invalid provider profile ID",
          error: "INVALID_PROVIDER_ID"
        });
        return;
      }

      if (!req.body.serviceId) {
        res.status(400).json({ 
          success: false, 
          message: "Service ID is required in request body",
          error: "MISSING_SERVICE_ID"
        });
        return;
      }

      const providerProfile = await ProviderProfileController.getProviderProfile(
        { _id: new Types.ObjectId(id) }, 
        res
      );
      if (!providerProfile) return;
      
      await ProviderProfileController.manageServiceOffering(
        providerProfile, 
        req.body.serviceId, 
        'add', 
        res
      );
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  static async removeServiceOffering(
    req: Request<{ id: string; serviceId: string }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id, serviceId } = req.params;
      
      if (!validateObjectId(id)) {
        res.status(400).json({ 
          success: false, 
          message: "Invalid provider profile ID",
          error: "INVALID_PROVIDER_ID"
        });
        return;
      }

      if (!serviceId) {
        res.status(400).json({ 
          success: false, 
          message: "Service ID is required in URL params",
          error: "MISSING_SERVICE_ID"
        });
        return;
      }

      const providerProfile = await ProviderProfileController.getProviderProfile(
        { _id: new Types.ObjectId(id) }, 
        res
      );
      if (!providerProfile) return;
      
      await ProviderProfileController.manageServiceOffering(
        providerProfile, 
        serviceId, 
        'remove', 
        res
      );
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
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await providerProfile.addPenalty();

      this.sendSuccess(res, "Penalty added successfully", {
        penaltiesCount: providerProfile.penaltiesCount,
        riskLevel: providerProfile.riskLevel,
      });
    } catch (error) {
      handleError(res, error, "Failed to add penalty");
    }
  }

  // Working hours management - consolidated logic
  private static async updateWorkingHoursLogic(
    providerProfile: any,
    day: string,
    hours: { start: string; end: string },
    res: Response
  ) {
    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    if (!validDays.includes(day.toLowerCase())) {
      res.status(400).json({ success: false, message: "Invalid day of week" });
      return false;
    }

    await providerProfile.updateWorkingHours(day, hours);
    this.sendSuccess(res, "Working hours updated successfully");
    return true;
  }

  static async updateMyWorkingHours(
    req: AuthenticatedRequest & Request<{}, ApiResponse, { day: string; hours: { start: string; end: string } }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      
      const { day, hours } = req.body;
      await this.updateWorkingHoursLogic(providerProfile, day, hours, res);
    } catch (error) {
      handleError(res, error, "Failed to update working hours");
    }
  }

  static async updateWorkingHours(
    req: Request<{ id: string }, ApiResponse, { day: string; hours: { start: string; end: string } }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      const { day, hours } = req.body;
      await this.updateWorkingHoursLogic(providerProfile, day, hours, res);
    } catch (error) {
      handleError(res, error, "Failed to update working hours");
    }
  }

  // Risk assessment methods
  static async updateRiskAssessment(
    req: Request<{ id: string }, ApiResponse, {
      riskLevel?: RiskLevel; 
      notes?: string; 
      nextAssessmentDays?: number;
    }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!validateObjectId(id) || !userId) {
        res.status(400).json({
          success: false,
          message: !validateObjectId(id) ? "Invalid provider profile ID" : "Authentication required",
        });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await providerProfile.updateRiskAssessment({
        ...req.body,
        assessedBy: new Types.ObjectId(userId.toString()),
      });

      this.sendSuccess(res, "Risk assessment updated successfully", {
        riskLevel: providerProfile.riskLevel,
        riskScore: providerProfile.calculateRiskScore(),
        lastAssessmentDate: providerProfile.lastRiskAssessmentDate,
      });
    } catch (error) {
      handleError(res, error, "Failed to update risk assessment");
    }
  }

  static async getProviderRiskScore(
    req: Request<{ id: string }>, 
    res: Response<ApiResponse>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      this.sendSuccess(res, "Risk score calculated successfully", {
        riskScore: providerProfile.calculateRiskScore(),
        riskLevel: providerProfile.riskLevel,
        lastAssessmentDate: providerProfile.lastRiskAssessmentDate,
        riskAssessedBy: providerProfile.riskAssessedBy,
        penaltiesCount: providerProfile.penaltiesCount,
        performanceMetrics: providerProfile.performanceMetrics,
      });
    } catch (error) {
      handleError(res, error, "Failed to calculate risk score");
    }
  }

  static async scheduleNextAssessment(
    req: Request<{ id: string }, ApiResponse, { daysFromNow?: number }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { daysFromNow = 30 } = req.body;

      if (!validateObjectId(id) || daysFromNow < 1 || daysFromNow > 365) {
        res.status(400).json({
          success: false,
          message: !validateObjectId(id) ? "Invalid provider profile ID" : "Days from now must be between 1 and 365",
        });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      await providerProfile.scheduleNextAssessment(daysFromNow);
      this.sendSuccess(res, "Next assessment scheduled successfully");
    } catch (error) {
      handleError(res, error, "Failed to schedule next assessment");
    }
  }

  // Generic method to get providers by criteria
  private static async getProvidersByCriteria(
    criteria: any,
    populateOptions: any[] = [],
    message: string,
    res: Response<ApiResponse<ProviderProfileDocument[]>>
  ) {
    const providers = await ProviderProfileModel.find({
      ...criteria,
      isDeleted: { $ne: true },
    })
      .populate([...this.POPULATE_OPTIONS, ...populateOptions])
      .sort({ updatedAt: -1 });

    this.sendSuccess(res, message, providers);
  }

  static async getProvidersByStatus(
    req: Request<{ status: ProviderOperationalStatus }>, 
    res: Response<ApiResponse<ProviderProfileDocument[]>>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const { status } = req.params;
      if (!Object.values(ProviderOperationalStatus).includes(status)) {
        res.status(400).json({ success: false, message: "Invalid operational status" });
        return;
      }

      await this.getProvidersByCriteria(
        { operationalStatus: status },
        [],
        `Providers with ${status} status retrieved successfully`,
        res
      );
    } catch (error) {
      handleError(res, error, "Failed to get providers by status");
    }
  }

  static async getProvidersByRiskLevel(
    req: Request<{ riskLevel: RiskLevel }>, 
    res: Response<ApiResponse<ProviderProfileDocument[]>>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const { riskLevel } = req.params;
      if (!Object.values(RiskLevel).includes(riskLevel)) {
        res.status(400).json({ success: false, message: "Invalid risk level" });
        return;
      }

      const providers = await ProviderProfileModel.findByRiskLevel(riskLevel);
      
      // Bulk populate with error handling
      await Promise.allSettled(
        providers.map(provider =>
          provider.populate([
            ...this.POPULATE_OPTIONS,
            { path: "riskAssessedBy", select: "fullName email" },
          ])
        )
      );

      this.sendSuccess(res, `Providers with ${riskLevel} risk level retrieved successfully`, providers);
    } catch (error) {
      handleError(res, error, "Failed to get providers by risk level");
    }
  }

  static async getRiskAssessmentHistory(
    req: Request<{ id: string }>, 
    res: Response<ApiResponse>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      })
        .populate("riskAssessedBy", "fullName email")
        .lean();

      if (!providerProfile) {
        res.status(404).json({ success: false, message: "Provider profile not found" });
        return;
      }

      const profileInstance = new ProviderProfileModel(providerProfile);
      this.sendSuccess(res, "Risk assessment history retrieved successfully", {
        currentRiskLevel: providerProfile.riskLevel,
        currentRiskScore: profileInstance.calculateRiskScore(),
        lastAssessmentDate: providerProfile.lastRiskAssessmentDate,
        riskAssessedBy: providerProfile.riskAssessedBy,
        penaltiesCount: providerProfile.penaltiesCount,
        lastPenaltyDate: providerProfile.lastPenaltyDate,
        performanceMetrics: providerProfile.performanceMetrics,
      });
    } catch (error) {
      handleError(res, error, "Failed to get risk assessment history");
    }
  }

  static async bulkUpdateRiskAssessments(
    req: Request<{}, ApiResponse, {
      providerIds: string[];
      updates: {
        riskLevel?: RiskLevel; 
        notes?: string; 
        nextAssessmentDays?: number;
      };
    }>,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { providerIds, updates } = req.body;
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!userId || !providerIds?.length) {
        res.status(400).json({
          success: false,
          message: !userId ? "Authentication required" : "Provider IDs array is required",
        });
        return;
      }

      const invalidIds = providerIds.filter(id => !validateObjectId(id));
      if (invalidIds.length > 0) {
        res.status(400).json({
          success: false,
          message: "Invalid provider IDs detected",
          data: { invalidIds },
        });
        return;
      }

      const results = await Promise.allSettled(
        providerIds.map(async (id) => {
          const providerProfile = await ProviderProfileModel.findOne({
            _id: new Types.ObjectId(id),
            isDeleted: { $ne: true },
          });

          if (!providerProfile) return { id, success: false, reason: "Provider not found" };

          await providerProfile.updateRiskAssessment({
            ...updates,
            assessedBy: new Types.ObjectId(userId.toString()),
          });
          return { id, success: true };
        })
      );

      const processedResults = results.map(result => 
        result.status === 'fulfilled' 
          ? result.value 
          : { id: 'unknown', success: false, reason: result.reason?.message || 'Unknown error' }
      );

      const successful = processedResults.filter(r => r.success);
      
      this.sendSuccess(res, "Bulk risk assessment update completed", {
        totalProcessed: providerIds.length,
        successful: successful.length,
        failed: processedResults.length - successful.length,
        results: processedResults,
      });
    } catch (error) {
      handleError(res, error, "Failed to bulk update risk assessments");
    }
  }

  static async getProviderStatistics(
    req: Request, 
    res: Response<ApiResponse>, 
    next: NextFunction
  ): Promise<void> {
    try {
      const baseFilter = { isDeleted: { $ne: true } };
      
      const [
        total, active, probationary, suspended,
        lowRisk, mediumRisk, highRisk, criticalRisk,
        available
      ] = await Promise.all([
        ProviderProfileModel.countDocuments(baseFilter),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.ACTIVE }),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.PROBATIONARY }),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.SUSPENDED }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.LOW }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.MEDIUM }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.HIGH }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.CRITICAL }),
        ProviderProfileModel.countDocuments({ ...baseFilter, isCurrentlyAvailable: true }),
      ]);

      this.sendSuccess(res, "Provider statistics retrieved successfully", {
        total,
        byStatus: { active, probationary, suspended },
        byRiskLevel: { low: lowRisk, medium: mediumRisk, high: highRisk, critical: criticalRisk },
        availability: { available, unavailable: total - available },
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider statistics");
    }
  }

  /**
   * Get public provider profile by ID (No authentication required)
   * Shows only public information suitable for customers
   */
  static async getPublicProviderProfile(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<Partial<ProviderProfile>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await ProviderProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        operationalStatus: { $in: [ProviderOperationalStatus.ACTIVE, ProviderOperationalStatus.PROBATIONARY] }
      })
      .populate([
        { path: "profileId", select: "bio location contactDetails" },
        { path: "serviceOfferings", select: "title description status images slug", options: { slice: { images: 1 } } }
      ])
      .select("-riskLevel -lastRiskAssessmentDate -riskAssessedBy -penaltiesCount -lastPenaltyDate -deletedAt -deletedBy")
      .lean()
      .exec();

      if (!providerProfile) {
        res.status(404).json({ success: false, message: "Provider profile not found or not available" });
        return;
      }

      // Only show public-facing information
      const publicProfile: Partial<ProviderProfile> = {
        _id: providerProfile._id,
        profileId: providerProfile.profileId,
        businessName: providerProfile.businessName,
        serviceOfferings: providerProfile.serviceOfferings,
        workingHours: providerProfile.workingHours,
        isCurrentlyAvailable: providerProfile.isCurrentlyAvailable,
        isAlwaysAvailable: providerProfile.isAlwaysAvailable,
        requireInitialDeposit: providerProfile.requireInitialDeposit,
        percentageDeposit: providerProfile.percentageDeposit,
        performanceMetrics: providerProfile.performanceMetrics,
        createdAt: providerProfile.createdAt,
        updatedAt: providerProfile.updatedAt
      };

      ProviderProfileController.sendSuccess(res, "Public provider profile retrieved successfully", publicProfile);
    } catch (error) {
      handleError(res, error, "Failed to get public provider profile");
    }
  }

  /**
   * Get all public provider profiles with search and filtering (No authentication required)
   * Shows only active providers with public information
   */
  static async getPublicProviderProfiles(
    req: Request<{}, ApiResponse<PaginatedResponse<Partial<ProviderProfile>>>, {}, 
      QueryParams & { 
        serviceId?: string; 
        minRating?: string;
        available?: string;
        search?: string;
      }>,
    res: Response<ApiResponse<PaginatedResponse<Partial<ProviderProfile>>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = 12, 
        sort = "performanceMetrics.averageRating", 
        order = "desc", 
        serviceId,
        minRating,
        available,
        search
      } = req.query;

      // Build filter for public profiles only
      const filter: any = { 
        isDeleted: { $ne: true },
        operationalStatus: { $in: [ProviderOperationalStatus.ACTIVE, ProviderOperationalStatus.PROBATIONARY] }
      };

      // Apply filters
      if (serviceId && validateObjectId(serviceId)) {
        filter.serviceOfferings = new Types.ObjectId(serviceId);
      }
      if (minRating) {
        filter['performanceMetrics.averageRating'] = { $gte: parseFloat(minRating) };
      }
      if (available !== undefined) {
        filter.isCurrentlyAvailable = (available as string) === "true";
      }

      // Add text search if provided
      if (search) {
        filter.$or = [
          { businessName: { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as unknown as string));
      const limitNum = Math.max(1, Math.min(50, parseInt(limit as unknown as string)));
      const skip = (pageNum - 1) * limitNum;
      const sortDirection = order === "asc" ? 1 : -1;

      const [profiles, total] = await Promise.all([
        ProviderProfileModel.find(filter)
          .populate([
            { path: "profileId", select: "bio location contactDetails" },
            { path: "serviceOfferings", select: "title description status images" }
          ])
          .select("-riskLevel -lastRiskAssessmentDate -riskAssessedBy -penaltiesCount -lastPenaltyDate -deletedAt -deletedBy")
          .sort({ [sort]: sortDirection })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ProviderProfileModel.countDocuments(filter),
      ]);

      // Filter to only public information
      const publicProfiles: Partial<ProviderProfile>[] = profiles.map(profile => ({
        _id: profile._id,
        profileId: profile.profileId,
        businessName: profile.businessName,
        serviceOfferings: profile.serviceOfferings,
        workingHours: profile.workingHours,
        isCurrentlyAvailable: profile.isCurrentlyAvailable,
        isAlwaysAvailable: profile.isAlwaysAvailable,
        requireInitialDeposit: profile.requireInitialDeposit,
        percentageDeposit: profile.percentageDeposit,
        performanceMetrics: profile.performanceMetrics,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }));

      const totalPages = Math.ceil(total / limitNum);
      ProviderProfileController.sendSuccess(res, "Public provider profiles retrieved successfully", {
        data: publicProfiles,
        total,
        page: pageNum,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        totalPages,
      });
    } catch (error) {
      handleError(res, error, "Failed to get public provider profiles");
    }
  }

  /**
   * Search providers by location and service (No authentication required)
   */
  static async searchPublicProviders(
    req: Request<{}, ApiResponse<Partial<ProviderProfile>[]>, {}, {
      lat?: string;
      lng?: string;
      radius?: string;
      serviceId?: string;
      limit?: string;
    }>,
    res: Response<ApiResponse<Partial<ProviderProfile>[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { lat, lng, radius = "50", serviceId, limit = "20" } = req.query;
      
      const filter: any = {
        isDeleted: { $ne: true },
        operationalStatus: ProviderOperationalStatus.ACTIVE,
        isCurrentlyAvailable: true
      };

      if (serviceId && validateObjectId(serviceId)) {
        filter.serviceOfferings = new Types.ObjectId(serviceId);
      }

      // Add location-based filtering if coordinates provided
      if (lat && lng) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const searchRadius = parseInt(radius);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
          res.status(400).json({ success: false, message: "Invalid location parameters" });
          return;
        }
      }

      const limitNum = Math.min(50, parseInt(limit));

      const providers = await ProviderProfileModel.find(filter)
        .populate([
          { path: "profileId", select: "bio location" },
          { path: "serviceOfferings", select: "title description" }
        ])
        .select("businessName serviceOfferings workingHours performanceMetrics isCurrentlyAvailable isAlwaysAvailable requireInitialDeposit percentageDeposit createdAt updatedAt")
        .sort({ 
          'performanceMetrics.averageRating': -1, 
          'performanceMetrics.totalJobs': -1 
        })
        .limit(limitNum)
        .lean()
        .exec();

      // Map to public profile format
      const publicProviders: Partial<ProviderProfile>[] = providers.map(provider => ({
        _id: provider._id,
        profileId: provider.profileId,
        businessName: provider.businessName,
        serviceOfferings: provider.serviceOfferings,
        workingHours: provider.workingHours,
        isCurrentlyAvailable: provider.isCurrentlyAvailable,
        isAlwaysAvailable: provider.isAlwaysAvailable,
        requireInitialDeposit: provider.requireInitialDeposit,
        percentageDeposit: provider.percentageDeposit,
        performanceMetrics: provider.performanceMetrics,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt
      }));

      ProviderProfileController.sendSuccess(res, "Public provider search completed successfully", publicProviders);
    } catch (error) {
      handleError(res, error, "Failed to search public providers");
    }
  }
}

export default ProviderProfileController;