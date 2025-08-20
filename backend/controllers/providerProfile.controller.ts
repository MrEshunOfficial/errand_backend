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
import { ProviderProfileResponse, CreateProviderProfileRequestBody, UpdateProviderProfileRequestBody } from "../types";

export class ProviderProfileController {
  // Common population options
  private static readonly POPULATE_OPTIONS = [
    { path: "profileId", select: "userId role bio location contactDetails" },
    { path: "serviceOfferings", select: "name description categoryId" },
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

      // Create with defaults
      const providerProfileData = {
        ...req.body,
        profileId: userProfile._id,
        operationalStatus: ProviderOperationalStatus.PROBATIONARY,
        riskLevel: RiskLevel.LOW,
        trustScore: 50,
        isAvailableForWork: false,
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

      const savedProfile = await new ProviderProfileModel(providerProfileData).save();
      await this.safePopulate(savedProfile);

      res.status(201).json({
        message: "Provider profile created successfully",
        providerProfile: savedProfile.toObject(),
      });
    } catch (error: any) {
      console.error("Error creating provider profile:", error);
      
      const errorHandlers = {
        ValidationError: () => res.status(400).json({ message: "Validation error", error: error.message }),
        MongoServerError: () => error.code === 11000 && res.status(409).json({ message: "Provider profile already exists", error: "Duplicate profile ID" }),
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

      // Filter out admin-only fields
      const {
        profileId, operationalStatus, trustScore, riskLevel, totalJobs,
        completedJobs, cancelledJobs, disputedJobs, averageRating, totalReviews,
        completionRate, responseTimeMinutes, penaltiesCount, warningsCount,
        lastPenaltyDate, suspensionHistory, ...userAllowedUpdates
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
      if (available !== undefined) filter.isAvailableForWork = (available as unknown as string) === "true";
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
  static async getAvailableProviders(req: Request<{}, ApiResponse<ProviderProfileDocument[]>, {}, { serviceRadius?: string }>, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
    try {
      const radius = req.query.serviceRadius ? Number(req.query.serviceRadius) : undefined;
      const providers = await ProviderProfileModel.findAvailableProviders(radius);
      this.sendSuccess(res, "Available providers retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get available providers");
    }
  }

  static async getTopRatedProviders(req: Request<{}, ApiResponse<ProviderProfileDocument[]>, {}, { limit?: string }>, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
    try {
      const limitNumber = req.query.limit ? Number(req.query.limit) : 10;
      const providers = await ProviderProfileModel.findTopRatedProviders(limitNumber);
      this.sendSuccess(res, "Top-rated providers retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get top-rated providers");
    }
  }

  static async getHighRiskProviders(req: Request, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
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
    this.sendSuccess(res, `Provider availability ${providerProfile.isAvailableForWork ? "enabled" : "disabled"} successfully`);
  }

  static async toggleMyAvailability(req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      await this.toggleAvailabilityLogic(providerProfile, res);
    } catch (error) {
      handleError(res, error, "Failed to toggle availability");
    }
  }

  static async toggleAvailability(req: Request<{ id: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
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
    req: Request<{ id: string }, ApiResponse, Partial<{
      completionRate: number; averageRating: number; totalJobs: number;
      responseTimeMinutes: number; averageResponseTime: number; cancellationRate: number;
      disputeRate: number; clientRetentionRate: number;
    }>>,
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

  // Service offering management - consolidated logic
  private static async manageServiceOffering(
    providerProfile: any,
    serviceId: string,
    action: 'add' | 'remove',
    res: Response
  ) {
    if (!validateObjectId(serviceId)) {
      res.status(400).json({ success: false, message: "Invalid service ID provided" });
      return false;
    }

    const serviceObjectId = new Types.ObjectId(serviceId);
    
    if (action === 'add') {
      if (!providerProfile.serviceOfferings) providerProfile.serviceOfferings = [];
      if (!providerProfile.serviceOfferings.some((s: any) => s.equals(serviceObjectId))) {
        providerProfile.serviceOfferings.push(serviceObjectId);
        await providerProfile.save();
      }
    } else {
      await providerProfile.removeServiceOffering(serviceObjectId);
    }

    this.sendSuccess(res, `Service offering ${action === 'add' ? 'added' : 'removed'} successfully`);
    return true;
  }

  static async addMyServiceOffering(req: AuthenticatedRequest & Request<{}, ApiResponse, { serviceId: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      await this.manageServiceOffering(providerProfile, req.body.serviceId, 'add', res);
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  static async removeMyServiceOffering(req: AuthenticatedRequest & Request<{}, ApiResponse, { serviceId: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const providerProfile = await this.authenticateAndGetProfile(req, res);
      if (!providerProfile) return;
      await this.manageServiceOffering(providerProfile, req.body.serviceId, 'remove', res);
    } catch (error) {
      handleError(res, error, "Failed to remove service offering");
    }
  }

  static async addServiceOffering(req: Request<{ id: string }, ApiResponse, { serviceId: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid ID provided" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;
      await this.manageServiceOffering(providerProfile, req.body.serviceId, 'add', res);
    } catch (error) {
      handleError(res, error, "Failed to add service offering");
    }
  }

  static async removeServiceOffering(req: Request<{ id: string; serviceId: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { id, serviceId } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid ID provided" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;
      await this.manageServiceOffering(providerProfile, serviceId, 'remove', res);
    } catch (error) {
      handleError(res, error, "Failed to remove service offering");
    }
  }

  /**
   * Add penalty to provider (Admin only)
   */
  static async addPenalty(req: Request<{ id: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid provider profile ID" });
        return;
      }

      const providerProfile = await this.getProviderProfile({ _id: new Types.ObjectId(id) }, res);
      if (!providerProfile) return;

      providerProfile.penaltiesCount += 1;
      providerProfile.lastPenaltyDate = new Date();

      // Auto-adjust risk level
      if (providerProfile.penaltiesCount >= 5) providerProfile.riskLevel = RiskLevel.HIGH;
      else if (providerProfile.penaltiesCount >= 3) providerProfile.riskLevel = RiskLevel.MEDIUM;

      await providerProfile.save();

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
    hours: { start: string; end: string; isAvailable: boolean },
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
    req: AuthenticatedRequest & Request<{}, ApiResponse, { day: string; hours: { start: string; end: string; isAvailable: boolean } }>,
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
    req: Request<{ id: string }, ApiResponse, { day: string; hours: { start: string; end: string; isAvailable: boolean } }>,
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
      riskLevel?: RiskLevel; riskFactors?: any; mitigationMeasures?: any;
      notes?: string; nextAssessmentDays?: number;
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
        nextAssessmentDate: providerProfile.nextAssessmentDate,
      });
    } catch (error) {
      handleError(res, error, "Failed to update risk assessment");
    }
  }

  static async getProviderRiskScore(req: Request<{ id: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
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
        isRiskAssessmentOverdue: providerProfile.isRiskAssessmentOverdue(),
        lastAssessmentDate: providerProfile.lastRiskAssessmentDate,
        nextAssessmentDate: providerProfile.nextAssessmentDate,
        riskFactors: providerProfile.riskFactors,
        mitigationMeasures: providerProfile.mitigationMeasures,
      });
    } catch (error) {
      handleError(res, error, "Failed to calculate risk score");
    }
  }

  static async getOverdueRiskAssessments(req: Request, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
    try {
      const providers = await ProviderProfileModel.findOverdueRiskAssessments();
      this.sendSuccess(res, "Overdue risk assessments retrieved successfully", providers);
    } catch (error) {
      handleError(res, error, "Failed to get overdue risk assessments");
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
      this.sendSuccess(res, "Next assessment scheduled successfully", {
        nextAssessmentDate: providerProfile.nextAssessmentDate,
      });
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

  static async getProvidersByStatus(req: Request<{ status: ProviderOperationalStatus }>, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
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

  static async getProvidersByRiskLevel(req: Request<{ riskLevel: RiskLevel }>, res: Response<ApiResponse<ProviderProfileDocument[]>>, next: NextFunction): Promise<void> {
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

  static async getRiskAssessmentHistory(req: Request<{ id: string }>, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
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
        isRiskAssessmentOverdue: profileInstance.isRiskAssessmentOverdue(),
        lastAssessmentDate: providerProfile.lastRiskAssessmentDate,
        nextAssessmentDate: providerProfile.nextAssessmentDate,
        riskAssessedBy: providerProfile.riskAssessedBy,
        riskFactors: providerProfile.riskFactors,
        mitigationMeasures: providerProfile.mitigationMeasures,
        riskAssessmentNotes: providerProfile.riskAssessmentNotes,
        penaltiesCount: providerProfile.penaltiesCount,
        lastPenaltyDate: providerProfile.lastPenaltyDate,
      });
    } catch (error) {
      handleError(res, error, "Failed to get risk assessment history");
    }
  }

  static async bulkUpdateRiskAssessments(
    req: Request<{}, ApiResponse, {
      providerIds: string[];
      updates: {
        riskLevel?: RiskLevel; riskFactors?: any; mitigationMeasures?: any;
        notes?: string; nextAssessmentDays?: number;
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

  static async getProviderStatistics(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const baseFilter = { isDeleted: { $ne: true } };
      
      const [
        total, active, probationary, suspended,
        lowRisk, mediumRisk, highRisk, criticalRisk,
        available, overdue
      ] = await Promise.all([
        ProviderProfileModel.countDocuments(baseFilter),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.ACTIVE }),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.PROBATIONARY }),
        ProviderProfileModel.countDocuments({ ...baseFilter, operationalStatus: ProviderOperationalStatus.SUSPENDED }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.LOW }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.MEDIUM }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.HIGH }),
        ProviderProfileModel.countDocuments({ ...baseFilter, riskLevel: RiskLevel.CRITICAL }),
        ProviderProfileModel.countDocuments({ ...baseFilter, isAvailableForWork: true }),
        ProviderProfileModel.countDocuments({ ...baseFilter, nextAssessmentDate: { $lt: new Date() } }),
      ]);

      this.sendSuccess(res, "Provider statistics retrieved successfully", {
        total,
        byStatus: { active, probationary, suspended },
        byRiskLevel: { low: lowRisk, medium: mediumRisk, high: highRisk, critical: criticalRisk },
        availability: { available, unavailable: total - available },
        assessments: { overdue, upToDate: total - overdue },
      });
    } catch (error) {
      handleError(res, error, "Failed to get provider statistics");
    }
  }
}

export default ProviderProfileController;