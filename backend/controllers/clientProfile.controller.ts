// controllers/clientProfile.controller.ts
import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ClientProfileModel } from "../models/clientProfile.model";
import {
  CreateClientProfileRequestBody,
  UpdateClientProfileRequestBody,
  ClientProfileResponse,
  ClientProfile,
} from "../types/client-profile.types";
import { RiskLevel } from "../types/base.types";
import { Profile } from "../models/profile.model";
import { ApiResponse } from "../types/aggregated.types";

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export class ClientProfileController {
  // Helper method to extract user ID
  private static getUserId(req: AuthenticatedRequest): string | null {
    return req.userId || req.user?.id || req.user?._id;
  }

  // Helper method to validate ObjectId
  private static validateObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  // Helper method to handle authentication
  private static handleAuth(req: AuthenticatedRequest, res: Response): string | null {
    const userId = this.getUserId(req);
    if (!userId) {
      res.status(401).json({ message: "Authentication required", error: "User not authenticated" });
      return null;
    }
    return userId;
  }

  // Helper method to find user profile
  private static async findUserProfile(userId: string): Promise<any> {
    return Profile.findOne({
      userId: new Types.ObjectId(userId.toString()),
      isDeleted: { $ne: true },
    }).exec();
  }

  // Helper method to populate client profile
  private static async populateProfile(profile: any): Promise<void> {
    try {
      await profile.populate([
        { path: "profileId", select: "userId role bio location contactDetails" },
        { path: "preferredServices", select: "title description categoryId" },
        { path: "preferredProviders", select: "userId businessName contactInfo" },
      ]);
    } catch (error) {
      // Silently handle population errors
      console.error("Population error:", error);
    }
  }

  // Helper method to handle errors
  private static handleError(error: any, res: Response, defaultMessage: string): void {
    console.error(`Error: ${defaultMessage}`, error);

    if (error instanceof Error) {
      if (error.name === "ValidationError") {
        res.status(400).json({ message: "Validation error", error: error.message });
        return;
      }
      if (error.name === "MongoServerError" && (error as any).code === 11000) {
        res.status(409).json({ message: "Client profile already exists", error: "Duplicate profile ID" });
        return;
      }
      if (error.name === "CastError") {
        res.status(400).json({ message: "Invalid ID format", error: "Invalid ObjectId format" });
        return;
      }
    }

    res.status(500).json({ message: defaultMessage, error: "Internal server error" });
  }

  // Helper method to calculate risk level from trust score
  private static calculateRiskLevel(trustScore: number): RiskLevel {
    if (trustScore >= 80) return RiskLevel.LOW;
    if (trustScore >= 60) return RiskLevel.MEDIUM;
    if (trustScore >= 30) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  static async createClientProfile(
    req: AuthenticatedRequest & Request<{}, ClientProfileResponse, CreateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const userId = this.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await this.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({ message: "User profile not found. Please create a user profile first.", error: "Profile not found" });
        return;
      }

      const existingProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (existingProfile) {
        res.status(409).json({ message: "Client profile already exists for this user", error: "Profile already exists" });
        return;
      }

      const clientProfileData = {
        ...req.body,
        profileId: userProfile._id,
        trustScore: 50,
        riskLevel: RiskLevel.LOW,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        disputedBookings: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        totalReviews: 0,
        warningsCount: 0,
        isPhoneVerified: false,
        isEmailVerified: false,
        isAddressVerified: false,
        memberSince: new Date(),
        lastActiveDate: new Date(),
        loyaltyTier: "bronze",
      };

      const clientProfile = new ClientProfileModel(clientProfileData);
      const savedProfile = await clientProfile.save();

      await this.populateProfile(savedProfile);

      res.status(201).json({
        message: "Client profile created successfully",
        clientProfile: savedProfile.toObject(),
      });
    } catch (error) {
      this.handleError(error, res, "Failed to create client profile");
    }
  }

  static async getMyClientProfile(req: AuthenticatedRequest, res: Response<ClientProfileResponse>): Promise<void> {
    try {
      const userId = this.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await this.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({ message: "User profile not found", error: "Profile not found" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      await this.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve client profile", error: "Internal server error" });
    }
  }

  static async getClientProfileByProfileId(
    req: Request<{ profileId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { profileId } = req.params;

      if (!this.validateObjectId(profileId)) {
        res.status(400).json({ message: "Invalid profile ID format", error: "Invalid ObjectId" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: new Types.ObjectId(profileId),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      await this.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve client profile", error: "Internal server error" });
    }
  }

  static async getClientProfileById(
    req: Request<{ id: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ message: "Invalid client profile ID format", error: "Invalid ObjectId" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      await this.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve client profile", error: "Internal server error" });
    }
  }

  static async updateMyClientProfile(
    req: AuthenticatedRequest & Request<{}, ClientProfileResponse, UpdateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const userId = this.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await this.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({ message: "User profile not found", error: "Profile not found" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      // Filter out admin-only fields
      const adminOnlyFields = [
        'profileId', 'trustScore', 'riskLevel', 'riskFactors', 'flags', 
        'loyaltyTier', 'warningsCount', 'suspensionHistory', 'totalBookings', 
        'completedBookings', 'cancelledBookings', 'disputedBookings', 
        'totalSpent', 'averageOrderValue', 'totalReviews', 'averageRating', 'memberSince'
      ];
      
      const userAllowedUpdates = Object.keys(req.body)
        .filter(key => !adminOnlyFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {} as any);

      Object.assign(clientProfile, userAllowedUpdates);
      clientProfile.lastActiveDate = new Date();

      const updatedProfile = await clientProfile.save();
      await this.populateProfile(updatedProfile);

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      this.handleError(error, res, "Failed to update client profile");
    }
  }

  static async updateClientProfile(
    req: Request<{ id: string }, ClientProfileResponse, UpdateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ message: "Invalid client profile ID format", error: "Invalid ObjectId" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      Object.assign(clientProfile, req.body);
      const updatedProfile = await clientProfile.save();
      await this.populateProfile(updatedProfile);

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      this.handleError(error, res, "Failed to update client profile");
    }
  }

  static async deleteClientProfile(req: Request<{ id: string }>, res: Response<ClientProfileResponse>): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ message: "Invalid client profile ID format", error: "Invalid ObjectId" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      clientProfile.isDeleted = true;
      clientProfile.deletedAt = new Date();
      if (userId) clientProfile.deletedBy = new Types.ObjectId(userId.toString());

      await clientProfile.save();
      res.status(200).json({ message: "Client profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting client profile:", error);
      res.status(500).json({ message: "Failed to delete client profile", error: "Internal server error" });
    }
  }

  static async getAllClientProfiles(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1, limit = 10, riskLevel, minTrustScore, maxTrustScore,
        loyaltyTier, hasActiveWarnings, isVerified, minBookings, minSpent,
        sortBy = "createdAt", sortOrder = "desc"
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const filter: any = { isDeleted: { $ne: true } };

      // Apply filters
      if (riskLevel && Object.values(RiskLevel).includes(riskLevel as RiskLevel)) {
        filter.riskLevel = riskLevel;
      }
      
      if (minTrustScore || maxTrustScore) {
        filter.trustScore = {};
        if (minTrustScore) filter.trustScore.$gte = parseFloat(minTrustScore as string);
        if (maxTrustScore) filter.trustScore.$lte = parseFloat(maxTrustScore as string);
      }

      if (loyaltyTier) filter.loyaltyTier = loyaltyTier;
      if (hasActiveWarnings === "true") filter.warningsCount = { $gt: 0 };
      else if (hasActiveWarnings === "false") filter.warningsCount = 0;
      
      if (isVerified === "true") {
        filter.$and = [
          { isPhoneVerified: true },
          { isEmailVerified: true },
          { isAddressVerified: true }
        ];
      }
      
      if (minBookings) filter.totalBookings = { $gte: parseInt(minBookings as string) };
      if (minSpent) filter.totalSpent = { $gte: parseFloat(minSpent as string) };

      const sort: any = {};
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.find(filter)
          .populate([
            { path: "profileId", select: "userId role bio location contactDetails" },
            { path: "preferredServices", select: "title description categoryId" },
            { path: "preferredProviders", select: "userId businessName contactInfo" }
          ])
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ClientProfileModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        message: "Client profiles retrieved successfully",
        data: {
          profiles,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving client profiles:", error);
      res.status(500).json({ message: "Failed to retrieve client profiles", error: "Internal server error" });
    }
  }

  static async updateTrustScore(
    req: Request<{ id: string }, ClientProfileResponse, { trustScore: number }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { trustScore } = req.body;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ message: "Invalid client profile ID format", error: "Invalid ObjectId" });
        return;
      }

      if (typeof trustScore !== "number" || trustScore < 0 || trustScore > 100) {
        res.status(400).json({ message: "Trust score must be a number between 0 and 100", error: "Invalid trust score" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      clientProfile.trustScore = trustScore;
      clientProfile.riskLevel = this.calculateRiskLevel(trustScore);

      await clientProfile.save();
      await this.populateProfile(clientProfile);

      res.status(200).json({
        message: "Trust score updated successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error updating trust score:", error);
      res.status(500).json({ message: "Failed to update trust score", error: "Internal server error" });
    }
  }

  // Generic method to handle preferred items (services/providers)
  private static async updatePreferredItem(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId?: string; providerId?: string }>,
    res: Response<ClientProfileResponse>,
    action: 'add' | 'remove',
    itemType: 'service' | 'provider'
  ): Promise<void> {
    try {
      const { id } = req.params;
      const itemId = req.body.serviceId || req.body.providerId;

      if (!id || !itemId || !this.validateObjectId(id) || !this.validateObjectId(itemId)) {
        res.status(400).json({ message: "Invalid ID format", error: "Invalid ObjectId" });
        return;
      }


      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({ message: "Client profile not found", error: "Profile not found" });
        return;
      }

      const itemObjectId = new Types.ObjectId(itemId);
      const arrayField = itemType === 'service' ? 'preferredServices' : 'preferredProviders';
      
      if (action === 'add') {
        if (!clientProfile[arrayField].some((item: any) => item.equals(itemObjectId))) {
          clientProfile[arrayField].push(itemObjectId);
        }
      } else {
        clientProfile[arrayField] = clientProfile[arrayField].filter(
          (item: any) => !item.equals(itemObjectId)
        );
      }

      await clientProfile.save();
      await this.populateProfile(clientProfile);

      res.status(200).json({
        message: `Preferred ${itemType} ${action}${action === 'add' ? 'ed' : 'd'} successfully`,
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error(`Error ${action}ing preferred ${itemType}:`, error);
      res.status(500).json({ 
        message: `Failed to ${action} preferred ${itemType}`, 
        error: "Internal server error" 
      });
    }
  }

  static async addPreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    return this.updatePreferredItem(req, res, 'add', 'service');
  }

  static async removePreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    return this.updatePreferredItem(req, res, 'remove', 'service');
  }

  static async addPreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    return this.updatePreferredItem(req, res, 'add', 'provider');
  }

  static async removePreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    return this.updatePreferredItem(req, res, 'remove', 'provider');
  }

  static async getHighRiskClients(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, sortBy = "trustScore", sortOrder = "asc" } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const sort: any = {};
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.findHighRiskClients()
          .populate("profileId preferredServices preferredProviders")
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ClientProfileModel.findHighRiskClients().countDocuments().exec(),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        message: "High-risk clients retrieved successfully",
        data: {
          profiles,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error retrieving high-risk clients:", error);
      res.status(500).json({ message: "Failed to retrieve high-risk clients", error: "Internal server error" });
    }
  }

  /**
 * Get public client profile by ID (No authentication required)
 * Shows only public information suitable for providers/service providers
 */
static async getPublicClientProfile(
  req: Request<{ id: string }>,
  res: Response<ApiResponse<Partial<ClientProfile>>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!ClientProfileController.validateObjectId(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid client profile ID format" 
      });
      return;
    }

    // Use more specific field selection to avoid issues with missing fields
    const clientProfile = await ClientProfileModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
      // Only show profiles that are not high risk or critical
      riskLevel: { $in: [RiskLevel.LOW, RiskLevel.MEDIUM] }
    })
    .populate([
      { 
        path: "profileId", 
        select: "bio location",
        match: { isDeleted: { $ne: true } } // Ensure populated profile is not deleted
      },
      { 
        path: "preferredServices", 
        select: "name title description", // Include both name and title for compatibility
        match: { isDeleted: { $ne: true } }
      }
    ])
    .select(`
      profileId preferredServices totalBookings completedBookings 
      averageRating totalReviews loyaltyTier memberSince 
      isPhoneVerified isEmailVerified isAddressVerified 
      communicationStyle preferredContactMethod responseTime 
      createdAt updatedAt
    `)
    .lean()
    .exec();

    if (!clientProfile) {
      res.status(404).json({ 
        success: false, 
        message: "Client profile not found or not available" 
      });
      return;
    }

    // Only show public-facing information with safe defaults
    const publicProfile: Partial<ClientProfile> = {
      _id: clientProfile._id,
      profileId: clientProfile.profileId,
      preferredServices: clientProfile.preferredServices || [],
      totalBookings: clientProfile.totalBookings || 0,
      completedBookings: clientProfile.completedBookings || 0,
      averageRating: clientProfile.averageRating || undefined,
      totalReviews: clientProfile.totalReviews || 0,
      loyaltyTier: clientProfile.loyaltyTier || "bronze",
      memberSince: clientProfile.memberSince,
      isPhoneVerified: clientProfile.isPhoneVerified || false,
      isEmailVerified: clientProfile.isEmailVerified || false,
      isAddressVerified: clientProfile.isAddressVerified || false,
      communicationStyle: clientProfile.communicationStyle || undefined,
      preferredContactMethod: clientProfile.preferredContactMethod || undefined,
      responseTime: clientProfile.responseTime || undefined,
      createdAt: clientProfile.createdAt,
      updatedAt: clientProfile.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Public client profile retrieved successfully",
      data: publicProfile
    });
  } catch (error) {
    console.error("Error retrieving public client profile:", error);
    
    // More detailed error logging for debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve public client profile",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
    });
  }
}

/**
 * Get public client profile by profile ID (No authentication required)
 * Alternative lookup method for providers who have the profile ID
 */
static async getPublicClientProfileByProfileId(
  req: Request<{ profileId: string }>,
  res: Response<ApiResponse<Partial<ClientProfile>>>,
  next: NextFunction
): Promise<void> {
  try {
    const { profileId } = req.params;

    if (!ClientProfileController.validateObjectId(profileId)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid profile ID format" 
      });
      return;
    }

    const clientProfile = await ClientProfileModel.findOne({
      profileId: new Types.ObjectId(profileId),
      isDeleted: { $ne: true },
      // Only show profiles that are not high risk or critical
      riskLevel: { $in: [RiskLevel.LOW, RiskLevel.MEDIUM] }
    })
    .populate([
      { 
        path: "profileId", 
        select: "bio location",
        match: { isDeleted: { $ne: true } }
      },
      { 
        path: "preferredServices", 
        select: "name title description",
        match: { isDeleted: { $ne: true } }
      }
    ])
    .select(`
      profileId preferredServices totalBookings completedBookings 
      averageRating totalReviews loyaltyTier memberSince 
      isPhoneVerified isEmailVerified isAddressVerified 
      communicationStyle preferredContactMethod responseTime 
      createdAt updatedAt
    `)
    .lean()
    .exec();

    if (!clientProfile) {
      res.status(404).json({ 
        success: false, 
        message: "Client profile not found or not available" 
      });
      return;
    }

    // Only show public-facing information with safe defaults
    const publicProfile: Partial<ClientProfile> = {
      _id: clientProfile._id,
      profileId: clientProfile.profileId,
      preferredServices: clientProfile.preferredServices || [],
      totalBookings: clientProfile.totalBookings || 0,
      completedBookings: clientProfile.completedBookings || 0,
      averageRating: clientProfile.averageRating || undefined,
      totalReviews: clientProfile.totalReviews || 0,
      loyaltyTier: clientProfile.loyaltyTier || "bronze",
      memberSince: clientProfile.memberSince,
      isPhoneVerified: clientProfile.isPhoneVerified || false,
      isEmailVerified: clientProfile.isEmailVerified || false,
      isAddressVerified: clientProfile.isAddressVerified || false,
      communicationStyle: clientProfile.communicationStyle || undefined,
      preferredContactMethod: clientProfile.preferredContactMethod || undefined,
      responseTime: clientProfile.responseTime || undefined,
      createdAt: clientProfile.createdAt,
      updatedAt: clientProfile.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Public client profile retrieved successfully",
      data: publicProfile
    });
  } catch (error) {
    console.error("Error retrieving public client profile by profile ID:", error);
    
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve public client profile",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
    });
  }
}

/**
 * Get basic client verification status (No authentication required)
 * Useful for providers to check client reliability before accepting jobs
 */
static async getClientVerificationStatus(
  req: Request<{ id: string }>,
  res: Response<ApiResponse<{
    isVerified: boolean;
    verificationLevel: 'none' | 'partial' | 'full';
    verifiedAspects: {
      phone: boolean;
      email: boolean;
      address: boolean;
    };
    loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
    memberSince?: Date;
    totalBookings: number;
    completedBookings: number;
    completionRate: number;
    averageRating?: number;
    totalReviews: number;
  }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!ClientProfileController.validateObjectId(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid client profile ID format"
      });
      return;
    }

    const clientProfile = await ClientProfileModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
      // Only show profiles that are not critical risk
      riskLevel: { $ne: RiskLevel.CRITICAL }
    })
    .select(`
      isPhoneVerified isEmailVerified isAddressVerified loyaltyTier 
      memberSince totalBookings completedBookings cancelledBookings 
      averageRating totalReviews
    `)
    .lean()
    .exec();

    if (!clientProfile) {
      res.status(404).json({ 
        success: false, 
        message: "Client profile not found or not available"
      });
      return;
    }

    const verifiedAspects = {
      phone: clientProfile.isPhoneVerified || false,
      email: clientProfile.isEmailVerified || false,
      address: clientProfile.isAddressVerified || false
    };

    const verifiedCount = Object.values(verifiedAspects).filter(Boolean).length;
    let verificationLevel: 'none' | 'partial' | 'full' = 'none';
    
    if (verifiedCount === 3) verificationLevel = 'full';
    else if (verifiedCount > 0) verificationLevel = 'partial';

    const isVerified = verificationLevel === 'full';

    // Calculate completion rate with safe defaults
    const totalAttempted = clientProfile.totalBookings || 0;
    const completed = clientProfile.completedBookings || 0;
    const completionRate = totalAttempted > 0 ? (completed / totalAttempted) * 100 : 0;

    const verificationData = {
      isVerified,
      verificationLevel,
      verifiedAspects,
      loyaltyTier: clientProfile.loyaltyTier as "bronze" | "silver" | "gold" | "platinum" | undefined,
      memberSince: clientProfile.memberSince,
      totalBookings: totalAttempted,
      completedBookings: completed,
      completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
      averageRating: clientProfile.averageRating,
      totalReviews: clientProfile.totalReviews || 0
    };

    res.status(200).json({
      success: true,
      message: "Client verification status retrieved successfully",
      data: verificationData
    });
  } catch (error) {
    console.error("Error retrieving client verification status:", error);
    
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve client verification status",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
    });
  }
}

/**
 * Get client reliability metrics (No authentication required)
 * Extended version with more detailed metrics for provider decision making
 */
static async getClientReliabilityMetrics(
  req: Request<{ id: string }>,
  res: Response<ApiResponse<{
    reliabilityScore: number; // 0-100 calculated score
    bookingHistory: {
      totalBookings: number;
      completedBookings: number;
      cancelledBookings: number;
      disputedBookings: number;
      completionRate: number;
      cancellationRate: number;
      disputeRate: number;
    };
    engagement: {
      memberSince?: Date;
      lastActiveDate?: Date;
      responseTime?: number;
      loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
    };
    reputation: {
      averageRating?: number;
      totalReviews: number;
    };
    verification: {
      isPhoneVerified: boolean;
      isEmailVerified: boolean;
      isAddressVerified: boolean;
      verificationLevel: 'none' | 'partial' | 'full';
    };
  }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!ClientProfileController.validateObjectId(id)) {
      res.status(400).json({ 
        success: false, 
        message: "Invalid client profile ID format"
      });
      return;
    }

    const clientProfile = await ClientProfileModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
      // Only show profiles that are not critical risk
      riskLevel: { $ne: RiskLevel.CRITICAL }
    })
    .select(`
      isPhoneVerified isEmailVerified isAddressVerified loyaltyTier 
      memberSince lastActiveDate totalBookings completedBookings 
      cancelledBookings disputedBookings averageRating totalReviews responseTime
    `)
    .lean()
    .exec();

    if (!clientProfile) {
      res.status(404).json({ 
        success: false, 
        message: "Client profile not found or not available"
      });
      return;
    }

    // Calculate rates with safe defaults
    const totalBookings = clientProfile.totalBookings || 0;
    const completedBookings = clientProfile.completedBookings || 0;
    const cancelledBookings = clientProfile.cancelledBookings || 0;
    const disputedBookings = clientProfile.disputedBookings || 0;

    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const disputeRate = totalBookings > 0 ? (disputedBookings / totalBookings) * 100 : 0;

    // Calculate verification level
    const verifiedAspects = {
      phone: clientProfile.isPhoneVerified || false,
      email: clientProfile.isEmailVerified || false,
      address: clientProfile.isAddressVerified || false
    };
    const verifiedCount = Object.values(verifiedAspects).filter(Boolean).length;
    let verificationLevel: 'none' | 'partial' | 'full' = 'none';
    if (verifiedCount === 3) verificationLevel = 'full';
    else if (verifiedCount > 0) verificationLevel = 'partial';

    // Calculate reliability score (0-100)
    let reliabilityScore = 0;
    
    // Completion rate weight: 40%
    reliabilityScore += completionRate * 0.4;
    
    // Verification weight: 25%
    reliabilityScore += (verifiedCount / 3) * 100 * 0.25;
    
    // Rating weight: 20% (if available)
    if (clientProfile.averageRating && clientProfile.totalReviews > 0) {
      reliabilityScore += (clientProfile.averageRating / 5) * 100 * 0.2;
    }
    
    // Low dispute/cancellation rate weight: 15%
    const lowProblemRate = Math.max(0, 100 - (cancellationRate + disputeRate * 2)); // Disputes weighted more heavily
    reliabilityScore += lowProblemRate * 0.15;

    // Round to 2 decimal places
    reliabilityScore = Math.round(reliabilityScore * 100) / 100;

    const reliabilityData = {
      reliabilityScore,
      bookingHistory: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        disputedBookings,
        completionRate: Math.round(completionRate * 100) / 100,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        disputeRate: Math.round(disputeRate * 100) / 100
      },
      engagement: {
        memberSince: clientProfile.memberSince,
        lastActiveDate: clientProfile.lastActiveDate,
        responseTime: clientProfile.responseTime,
        loyaltyTier: clientProfile.loyaltyTier as "bronze" | "silver" | "gold" | "platinum" | undefined
      },
      reputation: {
        averageRating: clientProfile.averageRating,
        totalReviews: clientProfile.totalReviews || 0
      },
      verification: {
        isPhoneVerified: verifiedAspects.phone,
        isEmailVerified: verifiedAspects.email,
        isAddressVerified: verifiedAspects.address,
        verificationLevel
      }
    };

    res.status(200).json({
      success: true,
      message: "Client reliability metrics retrieved successfully",
      data: reliabilityData
    });
  } catch (error) {
    console.error("Error retrieving client reliability metrics:", error);
    
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve client reliability metrics",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
    });
  }
}

}

export default ClientProfileController;