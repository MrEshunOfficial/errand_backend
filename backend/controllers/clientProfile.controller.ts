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
  private static handleAuth(
    req: AuthenticatedRequest,
    res: Response
  ): string | null {
    const userId = ClientProfileController.getUserId(req);
    if (!userId) {
      res.status(401).json({
        message: "Authentication required",
        error: "User not authenticated",
      });
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

  // Enhanced helper method to populate client profile with user profile and user data
  private static async populateProfile(profile: any): Promise<void> {
    try {
      await profile.populate([
        {
          path: "profileId",
          select:
            "userId role bio location contactDetails profilePicture socialMediaHandles createdAt",
          populate: {
            path: "userId",
            select: "name email isActive isVerified createdAt",
          },
        },
        {
          path: "preferredServices",
          select: "title description slug categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);
    } catch (error) {
      console.error("Population error:", error);
    }
  }

  // Helper method to handle errors
  private static handleError(
    error: any,
    res: Response,
    defaultMessage: string
  ): void {
    console.error(`Error: ${defaultMessage}`, error);

    if (error instanceof Error) {
      if (error.name === "ValidationError") {
        res
          .status(400)
          .json({ message: "Validation error", error: error.message });
        return;
      }
      if (error.name === "MongoServerError" && (error as any).code === 11000) {
        res.status(409).json({
          message: "Client profile already exists",
          error: "Duplicate profile ID",
        });
        return;
      }
      if (error.name === "CastError") {
        res.status(400).json({
          message: "Invalid ID format",
          error: "Invalid ObjectId format",
        });
        return;
      }
    }

    res
      .status(500)
      .json({ message: defaultMessage, error: "Internal server error" });
  }

  // Helper method to calculate risk level from trust score
  private static calculateRiskLevel(trustScore: number): RiskLevel {
    if (trustScore >= 80) return RiskLevel.LOW;
    if (trustScore >= 60) return RiskLevel.MEDIUM;
    if (trustScore >= 30) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  static async createClientProfile(
    req: AuthenticatedRequest &
      Request<{}, ClientProfileResponse, CreateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const userId = ClientProfileController.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await ClientProfileController.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({
          message:
            "User profile not found. Please create a user profile first.",
          error: "Profile not found",
        });
        return;
      }

      const existingProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (existingProfile) {
        res.status(409).json({
          message: "Client profile already exists for this user",
          error: "Profile already exists",
        });
        return;
      }

      const clientProfileData = {
        ...req.body,
        profileId: userProfile._id,
        trustScore: 50,
        riskLevel: RiskLevel.LOW,
        totalReviews: 0,
        warningsCount: 0,
        memberSince: new Date(),
        lastActiveDate: new Date(),
        loyaltyTier: "bronze" as const,
      };

      const clientProfile = new ClientProfileModel(clientProfileData);
      const savedProfile = await clientProfile.save();

      await ClientProfileController.populateProfile(savedProfile);

      res.status(201).json({
        message: "Client profile created successfully",
        clientProfile: savedProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to create client profile"
      );
    }
  }

  static async getMyClientProfile(
    req: AuthenticatedRequest,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const userId = ClientProfileController.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await ClientProfileController.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({
          message: "User profile not found",
          error: "Profile not found",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      }).exec();

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      await ClientProfileController.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to retrieve client profile"
      );
    }
  }

  static async getClientProfileByProfileId(
    req: Request<{ profileId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { profileId } = req.params;

      if (!ClientProfileController.validateObjectId(profileId)) {
        res.status(400).json({
          message: "Invalid profile ID format",
          error: "Invalid ObjectId",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: new Types.ObjectId(profileId),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      await ClientProfileController.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to retrieve client profile"
      );
    }
  }

  static async getClientProfileById(
    req: Request<{ id: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!ClientProfileController.validateObjectId(id)) {
        res.status(400).json({
          message: "Invalid client profile ID format",
          error: "Invalid ObjectId",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      await ClientProfileController.populateProfile(clientProfile);

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to retrieve client profile"
      );
    }
  }

  static async updateMyClientProfile(
    req: AuthenticatedRequest &
      Request<{}, ClientProfileResponse, UpdateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const userId = ClientProfileController.handleAuth(req, res);
      if (!userId) return;

      const userProfile = await ClientProfileController.findUserProfile(userId);
      if (!userProfile) {
        res.status(404).json({
          message: "User profile not found",
          error: "Profile not found",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: userProfile._id,
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      // Filter out admin-only fields
      const adminOnlyFields = [
        "profileId",
        "trustScore",
        "riskLevel",
        "riskFactors",
        "flags",
        "loyaltyTier",
        "warningsCount",
        "suspensionHistory",
        "memberSince",
        "totalReviews",
        "averageRating",
      ];

      const userAllowedUpdates = Object.keys(req.body)
        .filter((key) => !adminOnlyFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {} as any);

      Object.assign(clientProfile, userAllowedUpdates);
      clientProfile.lastActiveDate = new Date();

      const updatedProfile = await clientProfile.save();
      await ClientProfileController.populateProfile(updatedProfile);

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to update client profile"
      );
    }
  }

  static async updateClientProfile(
    req: Request<
      { id: string },
      ClientProfileResponse,
      UpdateClientProfileRequestBody
    >,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!ClientProfileController.validateObjectId(id)) {
        res.status(400).json({
          message: "Invalid client profile ID format",
          error: "Invalid ObjectId",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      Object.assign(clientProfile, req.body);
      const updatedProfile = await clientProfile.save();
      await ClientProfileController.populateProfile(updatedProfile);

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to update client profile"
      );
    }
  }

  static async deleteClientProfile(
    req: Request<{ id: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!ClientProfileController.validateObjectId(id)) {
        res.status(400).json({
          message: "Invalid client profile ID format",
          error: "Invalid ObjectId",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      clientProfile.isDeleted = true;
      clientProfile.deletedAt = new Date();
      if (userId)
        clientProfile.deletedBy = new Types.ObjectId(userId.toString());

      await clientProfile.save();
      res.status(200).json({ message: "Client profile deleted successfully" });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to delete client profile"
      );
    }
  }

  static async getAllClientProfiles(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        riskLevel,
        minTrustScore,
        maxTrustScore,
        loyaltyTier,
        hasActiveWarnings,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const filter: any = { isDeleted: { $ne: true } };

      // Apply filters
      if (
        riskLevel &&
        Object.values(RiskLevel).includes(riskLevel as RiskLevel)
      ) {
        filter.riskLevel = riskLevel;
      }

      if (minTrustScore || maxTrustScore) {
        filter.trustScore = {};
        if (minTrustScore)
          filter.trustScore.$gte = parseFloat(minTrustScore as string);
        if (maxTrustScore)
          filter.trustScore.$lte = parseFloat(maxTrustScore as string);
      }

      if (loyaltyTier) filter.loyaltyTier = loyaltyTier;
      if (hasActiveWarnings === "true") filter.warningsCount = { $gt: 0 };
      else if (hasActiveWarnings === "false") filter.warningsCount = 0;

      const sort: any = {};
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.find(filter)
          .populate([
            {
              path: "profileId",
              select:
                "userId role bio location contactDetails profilePicture verificationStatus",
              populate: {
                path: "userId",
                select: "firstName lastName email phoneNumber isActive",
              },
            },
            {
              path: "preferredServices",
              select: "title description categoryId",
            },
            {
              path: "preferredProviders",
              select: "userId businessName contactInfo",
            },
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
      ClientProfileController.handleError(
        error,
        res,
        "Failed to retrieve client profiles"
      );
    }
  }

  static async updateTrustScore(
    req: Request<{ id: string }, ClientProfileResponse, { trustScore: number }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { trustScore } = req.body;

      if (!ClientProfileController.validateObjectId(id)) {
        res.status(400).json({
          message: "Invalid client profile ID format",
          error: "Invalid ObjectId",
        });
        return;
      }

      if (
        typeof trustScore !== "number" ||
        trustScore < 0 ||
        trustScore > 100
      ) {
        res.status(400).json({
          message: "Trust score must be a number between 0 and 100",
          error: "Invalid trust score",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      clientProfile.trustScore = trustScore;
      clientProfile.riskLevel =
        ClientProfileController.calculateRiskLevel(trustScore);

      await clientProfile.save();
      await ClientProfileController.populateProfile(clientProfile);

      res.status(200).json({
        message: "Trust score updated successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        "Failed to update trust score"
      );
    }
  }

  // Generic method to handle preferred items (services/providers)
  private static async updatePreferredItem(
    req: Request<
      { id: string },
      ClientProfileResponse,
      { serviceId?: string; providerId?: string }
    >,
    res: Response<ClientProfileResponse>,
    action: "add" | "remove",
    itemType: "service" | "provider"
  ): Promise<void> {
    try {
      const { id } = req.params;
      const itemId = req.body.serviceId || req.body.providerId;

      if (
        !id ||
        !itemId ||
        !ClientProfileController.validateObjectId(id) ||
        !ClientProfileController.validateObjectId(itemId)
      ) {
        res
          .status(400)
          .json({ message: "Invalid ID format", error: "Invalid ObjectId" });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!clientProfile) {
        res.status(404).json({
          message: "Client profile not found",
          error: "Profile not found",
        });
        return;
      }

      const itemObjectId = new Types.ObjectId(itemId);
      const arrayField =
        itemType === "service" ? "preferredServices" : "preferredProviders";

      if (action === "add") {
        if (
          !clientProfile[arrayField].some((item: any) =>
            item.equals(itemObjectId)
          )
        ) {
          clientProfile[arrayField].push(itemObjectId);
        }
      } else {
        clientProfile[arrayField] = clientProfile[arrayField].filter(
          (item: any) => !item.equals(itemObjectId)
        );
      }

      await clientProfile.save();
      await ClientProfileController.populateProfile(clientProfile);

      res.status(200).json({
        message: `Preferred ${itemType} ${action}${
          action === "add" ? "ed" : "d"
        } successfully`,
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      ClientProfileController.handleError(
        error,
        res,
        `Failed to ${action} preferred ${itemType}`
      );
    }
  }

  static async addPreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    await ClientProfileController.updatePreferredItem(
      req,
      res,
      "add",
      "service"
    );
  }

  static async removePreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    await ClientProfileController.updatePreferredItem(
      req,
      res,
      "remove",
      "service"
    );
  }

  static async addPreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    await ClientProfileController.updatePreferredItem(
      req,
      res,
      "add",
      "provider"
    );
  }

  static async removePreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    await ClientProfileController.updatePreferredItem(
      req,
      res,
      "remove",
      "provider"
    );
  }

  static async getHighRiskClients(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "trustScore",
        sortOrder = "asc",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const sort: any = {};
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.findHighRiskClients()
          .populate([
            {
              path: "profileId",
              select:
                "userId role bio location contactDetails verificationStatus",
              populate: {
                path: "userId",
                select: "firstName lastName email phoneNumber",
              },
            },
            { path: "preferredServices", select: "title description" },
            { path: "preferredProviders", select: "businessName" },
          ])
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
      ClientProfileController.handleError(
        error,
        res,
        "Failed to retrieve high-risk clients"
      );
    }
  }

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
          message: "Invalid client profile ID format",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        riskLevel: { $in: [RiskLevel.LOW, RiskLevel.MEDIUM] },
      }).exec();

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found or not available",
        });
        return;
      }
      await ClientProfileController.populateProfile(clientProfile);

      const publicProfile: Partial<ClientProfile> = {
        _id: clientProfile._id,
        profileId: clientProfile.profileId,
        preferredServices: clientProfile.preferredServices || [],
        preferredProviders: clientProfile.preferredProviders || [],
        averageRating: clientProfile.averageRating || undefined,
        totalReviews: clientProfile.totalReviews || 0,
        loyaltyTier: clientProfile.loyaltyTier || "bronze",
        memberSince: clientProfile.memberSince,
        preferredContactMethod:
          clientProfile.preferredContactMethod || undefined,
        trustScore: clientProfile.trustScore || undefined,
        warningsCount: clientProfile.warningsCount || 0,
        createdAt: clientProfile.createdAt,
        updatedAt: clientProfile.updatedAt,
      };

      res.status(200).json({
        success: true,
        message: "Public client profile retrieved successfully",
        data: publicProfile,
      });
    } catch (error: unknown) {
      console.error("Error retrieving public client profile:", error);

      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profile",
          error:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Internal server error",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profile",
          error:
            process.env.NODE_ENV === "development"
              ? String(error)
              : "Internal server error",
        });
      }
    }
  }

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
          message: "Invalid profile ID format",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        profileId: new Types.ObjectId(profileId),
        isDeleted: { $ne: true },
        riskLevel: { $in: [RiskLevel.LOW, RiskLevel.MEDIUM] },
      })
        .populate([
          {
            path: "profileId",
            select: "bio location userId",
            match: { isDeleted: { $ne: true } },
            populate: {
              path: "userId",
              select: "name email",
            },
          },
          {
            path: "preferredServices",
            select: "name title description",
            match: { isDeleted: { $ne: true } },
          },
        ])
        .select(
          `
          profileId preferredServices averageRating totalReviews 
          loyaltyTier memberSince preferredContactMethod
          createdAt updatedAt
        `
        )
        .lean()
        .exec();

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found or not available",
        });
        return;
      }

      const publicProfile: Partial<ClientProfile> = {
        _id: clientProfile._id,
        profileId: clientProfile.profileId,
        preferredServices: clientProfile.preferredServices ?? [],
        averageRating: clientProfile.averageRating ?? undefined,
        totalReviews: clientProfile.totalReviews ?? 0,
        loyaltyTier: clientProfile.loyaltyTier ?? "bronze",
        memberSince: clientProfile.memberSince,
        preferredContactMethod:
          clientProfile.preferredContactMethod ?? undefined,
        createdAt: clientProfile.createdAt,
        updatedAt: clientProfile.updatedAt,
      };

      res.status(200).json({
        success: true,
        message: "Public client profile retrieved successfully",
        data: publicProfile,
      });
    } catch (error: unknown) {
      console.error(
        "Error retrieving public client profile by profile ID:",
        error
      );

      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profile",
          error:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Internal server error",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profile",
          error:
            process.env.NODE_ENV === "development"
              ? String(error)
              : "Internal server error",
        });
      }
    }
  }

  static async getClientStats(
    req: Request<{ id: string }>,
    res: Response<
      ApiResponse<{
        loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
        memberSince?: Date;
        lastActiveDate?: Date;
        averageRating?: number;
        totalReviews: number;
        trustScore: number;
        riskLevel: RiskLevel;
        warningsCount: number;
      }>
    >,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!ClientProfileController.validateObjectId(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid client profile ID format",
        });
        return;
      }

      const clientProfile = await ClientProfileModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        riskLevel: { $ne: RiskLevel.CRITICAL },
      })
        .select(
          `
          loyaltyTier memberSince lastActiveDate averageRating 
          totalReviews trustScore riskLevel warningsCount
        `
        )
        .lean()
        .exec();

      if (!clientProfile) {
        res.status(404).json({
          success: false,
          message: "Client profile not found or not available",
        });
        return;
      }

      const statsData = {
        loyaltyTier:
          (clientProfile.loyaltyTier as
            | "bronze"
            | "silver"
            | "gold"
            | "platinum"
            | undefined) ?? "bronze",
        memberSince: clientProfile.memberSince,
        lastActiveDate: clientProfile.lastActiveDate,
        averageRating: clientProfile.averageRating ?? undefined,
        totalReviews: clientProfile.totalReviews ?? 0,
        trustScore: clientProfile.trustScore ?? 50,
        riskLevel: clientProfile.riskLevel ?? RiskLevel.LOW,
        warningsCount: clientProfile.warningsCount ?? 0,
      };

      res.status(200).json({
        success: true,
        message: "Client stats retrieved successfully",
        data: statsData,
      });
    } catch (error: unknown) {
      console.error("Error retrieving client stats:", error);

      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve client stats",
          error: process.env.NODE_ENV ? error.message : "Internal server error",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve client stats",
          error: process.env.NODE_ENV ? String(error) : "Internal server error",
        });
      }
    }
  }

  // Add this method to your ClientProfileController class

  static async getPublicClientProfiles(
    req: Request,
    res: Response<
      ApiResponse<{
        profiles: Partial<ClientProfile>[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalCount: number;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      }>
    >,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 12,
        loyaltyTier,
        minRating,
        sortBy = "memberSince",
        sortOrder = "desc",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(50, parseInt(limit as string))); // Max 50 for public
      const skip = (pageNum - 1) * limitNum;

      // Build filter - only show LOW and MEDIUM risk clients
      const filter: any = {
        isDeleted: { $ne: true },
        riskLevel: { $in: [RiskLevel.LOW, RiskLevel.MEDIUM] },
      };

      // Apply optional filters
      if (
        loyaltyTier &&
        ["bronze", "silver", "gold", "platinum"].includes(loyaltyTier as string)
      ) {
        filter.loyaltyTier = loyaltyTier;
      }

      if (minRating) {
        const rating = parseFloat(minRating as string);
        if (!isNaN(rating) && rating >= 0 && rating <= 5) {
          filter.averageRating = { $gte: rating };
        }
      }

      // Build sort - only allow safe fields
      const allowedSortFields = [
        "memberSince",
        "averageRating",
        "totalReviews",
        "loyaltyTier",
        "createdAt",
      ];
      const sortField = allowedSortFields.includes(sortBy as string)
        ? (sortBy as string)
        : "memberSince";
      const sort: any = {};
      sort[sortField] = sortOrder === "asc" ? 1 : -1;

      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.find(filter)
          .populate([
            {
              path: "profileId",
              select: "bio location userId",
              match: { isDeleted: { $ne: true } },
              populate: {
                path: "userId",
                select: "firstName lastName",
              },
            },
            {
              path: "preferredServices",
              select: "name title description",
              match: { isDeleted: { $ne: true } },
            },
          ])
          .select(
            `
          profileId preferredServices averageRating totalReviews 
          loyaltyTier memberSince preferredContactMethod
          createdAt updatedAt
        `
          )
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        ClientProfileModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      // Map to public profile format
      const publicProfiles: Partial<ClientProfile>[] = profiles.map(
        (profile) => ({
          _id: profile._id,
          profileId: profile.profileId,
          preferredServices: profile.preferredServices || [],
          averageRating: profile.averageRating || undefined,
          totalReviews: profile.totalReviews || 0,
          loyaltyTier: profile.loyaltyTier || "bronze",
          memberSince: profile.memberSince,
          preferredContactMethod: profile.preferredContactMethod || undefined,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        })
      );

      res.status(200).json({
        success: true,
        message: "Public client profiles retrieved successfully",
        data: {
          profiles: publicProfiles,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Error retrieving public client profiles:", error);

      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profiles",
          error:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Internal server error",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve public client profiles",
          error:
            process.env.NODE_ENV === "development"
              ? String(error)
              : "Internal server error",
        });
      }
    }
  }
}

export default ClientProfileController;
