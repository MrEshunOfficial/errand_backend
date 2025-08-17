// controllers/clientProfile.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { ClientProfileModel } from "../models/clientProfile.model";
import {
  CreateClientProfileRequestBody,
  UpdateClientProfileRequestBody,
  ClientProfileResponse,
} from "../types/client-profile.types";
import { RiskLevel } from "../types/base.types";
import { Profile } from "../models/profile.model";

// Extended request interface to include authenticated user
interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export class ClientProfileController {
  /**
   * Create a new client profile
   */
  static async createClientProfile(
    req: AuthenticatedRequest &
      Request<{}, ClientProfileResponse, CreateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
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

      // Find the user's profile first
      const userProfile = await Profile.findOne({
        userId: new Types.ObjectId(userId.toString()),
        isDeleted: { $ne: true },
      }).exec();

      if (!userProfile) {
        res.status(404).json({
          message:
            "User profile not found. Please create a user profile first.",
          error: "Profile not found",
        });
        return;
      }

      // Check if client profile already exists for this user profile
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

      // Create new client profile with the user's profile ID
      const clientProfileData = {
        ...profileData,
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

      // Populate related data with error handling
      try {
        await savedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "preferredServices",
            select: "title description categoryId",
          },
          {
            path: "preferredProviders",
            select: "userId businessName contactInfo",
          },
        ]);

        res.status(201).json({
          message: "Client profile created successfully",
          clientProfile: savedProfile.toObject(),
        });
      } catch (populateError) {
        console.error("Error during population:", populateError);

        // Return success but without populated data
        res.status(201).json({
          message: "Client profile created successfully",
          clientProfile: savedProfile.toObject(),
        });
      }
    } catch (error) {
      console.error("Error creating client profile:", error);

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
            message: "Client profile already exists",
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
        message: "Failed to create client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get current user's client profile
   */
  static async getMyClientProfile(
    req: AuthenticatedRequest,
    res: Response<ClientProfileResponse>
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

      // Find client profile
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
      try {
        await clientProfile.populate({
          path: "profileId",
          model: "Profile",
          select: "userId role bio location contactDetails",
        });
      } catch (populateError) {}

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch {
      res.status(500).json({
        message: "Failed to retrieve client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get client profile by profile ID (Admin use)
   */
  static async getClientProfileByProfileId(
    req: Request<{ profileId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { profileId } = req.params;

      if (!Types.ObjectId.isValid(profileId)) {
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
      try {
        await clientProfile.populate({
          path: "profileId",
          select: "userId role bio location contactDetails",
        });
      } catch (populateError) {}

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch {
      res.status(500).json({
        message: "Failed to retrieve client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get client profile by ID
   */
  static async getClientProfileById(
    req: Request<{ id: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
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
      try {
        await clientProfile.populate({
          path: "profileId",
          select: "userId role bio location contactDetails",
        });
      } catch (populateError) {}

      res.status(200).json({
        message: "Client profile retrieved successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch {
      res.status(500).json({
        message: "Failed to retrieve client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Update current user's client profile
   */
  static async updateMyClientProfile(
    req: AuthenticatedRequest &
      Request<{}, ClientProfileResponse, UpdateClientProfileRequestBody>,
    res: Response<ClientProfileResponse>
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

      // Find and update client profile
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

      // Filter out admin-only fields for regular users
      const {
        profileId,
        trustScore,
        riskLevel,
        riskFactors,
        flags,
        loyaltyTier,
        warningsCount,
        suspensionHistory,
        totalBookings,
        completedBookings,
        cancelledBookings,
        disputedBookings,
        totalSpent,
        averageOrderValue,
        totalReviews,
        averageRating,
        memberSince,
        ...userAllowedUpdates
      } = updateData;

      // Update allowed fields only
      Object.assign(clientProfile, userAllowedUpdates);
      clientProfile.lastActiveDate = new Date();

      // Save updated profile
      const updatedProfile = await clientProfile.save();

      // Try to populate with error handling
      try {
        await updatedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "preferredServices",
            select: "title description categoryId",
          },
          {
            path: "preferredProviders",
            select: "userId businessName contactInfo",
          },
        ]);
      } catch (populateError) {
        console.error(
          "Error during population in updateMyClientProfile:",
          populateError
        );
      }

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      console.error("Error updating client profile:", error);

      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({
          message: "Validation error",
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        message: "Failed to update client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Update client profile by ID (Admin use)
   */
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
      const updateData = req.body;

      if (!Types.ObjectId.isValid(id)) {
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

      // Update fields (exclude profileId from updates)
      const { ...allowedUpdates } = updateData;
      Object.assign(clientProfile, allowedUpdates);

      // Save updated profile
      const updatedProfile = await clientProfile.save();
      try {
        await updatedProfile.populate([
          {
            path: "profileId",
            select: "userId role bio location contactDetails",
          },
          {
            path: "preferredServices",
            select: "title description categoryId",
          },
          {
            path: "preferredProviders",
            select: "userId businessName contactInfo",
          },
        ]);
      } catch (populateError) {
        console.error(
          "Error during population in updateMyClientProfile:",
          populateError
        );
      }

      res.status(200).json({
        message: "Client profile updated successfully",
        clientProfile: updatedProfile.toObject(),
      });
    } catch (error) {
      console.error("Error updating client profile:", error);

      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({
          message: "Validation error",
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        message: "Failed to update client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Delete client profile (soft delete)
   */
  static async deleteClientProfile(
    req: Request<{ id: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      // Get user ID from auth middleware (optional)
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!Types.ObjectId.isValid(id)) {
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

      // Soft delete
      clientProfile.isDeleted = true;
      clientProfile.deletedAt = new Date();
      if (userId) {
        clientProfile.deletedBy = new Types.ObjectId(userId.toString());
      }

      await clientProfile.save();

      res.status(200).json({
        message: "Client profile deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting client profile:", error);
      res.status(500).json({
        message: "Failed to delete client profile",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get all client profiles with filtering and pagination
   */
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
        isVerified,
        minBookings,
        minSpent,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = { isDeleted: { $ne: true } };

      if (
        riskLevel &&
        Object.values(RiskLevel).includes(riskLevel as RiskLevel)
      ) {
        filter.riskLevel = riskLevel;
      }

      if (minTrustScore || maxTrustScore) {
        filter.trustScore = {};
        if (minTrustScore) {
          filter.trustScore.$gte = parseFloat(minTrustScore as string);
        }
        if (maxTrustScore) {
          filter.trustScore.$lte = parseFloat(maxTrustScore as string);
        }
      }

      if (loyaltyTier) {
        filter.loyaltyTier = loyaltyTier;
      }

      if (hasActiveWarnings === "true") {
        filter.warningsCount = { $gt: 0 };
      } else if (hasActiveWarnings === "false") {
        filter.warningsCount = 0;
      }

      if (isVerified === "true") {
        filter.$and = [
          { isPhoneVerified: true },
          { isEmailVerified: true },
          { isAddressVerified: true },
        ];
      }

      if (minBookings) {
        filter.totalBookings = { $gte: parseInt(minBookings as string) };
      }

      if (minSpent) {
        filter.totalSpent = { $gte: parseFloat(minSpent as string) };
      }

      // Build sort query
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      // Execute queries
      const [profiles, totalCount] = await Promise.all([
        ClientProfileModel.find(filter)
          .populate([
            {
              path: "profileId",
              select: "userId role bio location contactDetails",
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
      console.error("Error retrieving client profiles:", error);
      res.status(500).json({
        message: "Failed to retrieve client profiles",
        error: "Internal server error",
      });
    }
  }

  /**
   * Update client trust score
   */
  static async updateTrustScore(
    req: Request<{ id: string }, ClientProfileResponse, { trustScore: number }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { trustScore } = req.body;

      if (!Types.ObjectId.isValid(id)) {
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

      // Update trust score and determine risk level
      clientProfile.trustScore = trustScore;

      // Auto-update risk level based on trust score
      if (trustScore >= 80) {
        clientProfile.riskLevel = RiskLevel.LOW;
      } else if (trustScore >= 60) {
        clientProfile.riskLevel = RiskLevel.MEDIUM;
      } else if (trustScore >= 30) {
        clientProfile.riskLevel = RiskLevel.HIGH;
      } else {
        clientProfile.riskLevel = RiskLevel.CRITICAL;
      }

      await clientProfile.save();
      await clientProfile.populate([
        {
          path: "profileId",
          select: "userId role bio location contactDetails",
        },
        {
          path: "preferredServices",
          select: "title description categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);

      res.status(200).json({
        message: "Trust score updated successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error updating trust score:", error);
      res.status(500).json({
        message: "Failed to update trust score",
        error: "Internal server error",
      });
    }
  }

  /**
   * Add preferred service
   */
  static async addPreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { serviceId } = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(serviceId)) {
        res.status(400).json({
          message: "Invalid ID format",
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

      const serviceObjectId = new Types.ObjectId(serviceId);

      // Check if service is already in preferences
      if (
        !clientProfile.preferredServices.some((s) => s.equals(serviceObjectId))
      ) {
        clientProfile.preferredServices.push(serviceObjectId);
        await clientProfile.save();
      }

      await clientProfile.populate([
        {
          path: "profileId",
          select: "userId role bio location contactDetails",
        },
        {
          path: "preferredServices",
          select: "title description categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);

      res.status(200).json({
        message: "Preferred service added successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error adding preferred service:", error);
      res.status(500).json({
        message: "Failed to add preferred service",
        error: "Internal server error",
      });
    }
  }

  /**
   * Remove preferred service
   */
  static async removePreferredService(
    req: Request<{ id: string }, ClientProfileResponse, { serviceId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { serviceId } = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(serviceId)) {
        res.status(400).json({
          message: "Invalid ID format",
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

      const serviceObjectId = new Types.ObjectId(serviceId);
      clientProfile.preferredServices = clientProfile.preferredServices.filter(
        (s) => !s.equals(serviceObjectId)
      );

      await clientProfile.save();
      await clientProfile.populate([
        {
          path: "profileId",
          select: "userId role bio location contactDetails",
        },
        {
          path: "preferredServices",
          select: "title description categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);

      res.status(200).json({
        message: "Preferred service removed successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error removing preferred service:", error);
      res.status(500).json({
        message: "Failed to remove preferred service",
        error: "Internal server error",
      });
    }
  }

  /**
   * Add preferred provider
   */
  static async addPreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { providerId } = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(providerId)) {
        res.status(400).json({
          message: "Invalid ID format",
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

      const providerObjectId = new Types.ObjectId(providerId);

      // Check if provider is already in preferences
      if (
        !clientProfile.preferredProviders.some((p) =>
          p.equals(providerObjectId)
        )
      ) {
        clientProfile.preferredProviders.push(providerObjectId);
        await clientProfile.save();
      }

      await clientProfile.populate([
        {
          path: "profileId",
          select: "userId role bio location contactDetails",
        },
        {
          path: "preferredServices",
          select: "title description categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);

      res.status(200).json({
        message: "Preferred provider added successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error adding preferred provider:", error);
      res.status(500).json({
        message: "Failed to add preferred provider",
        error: "Internal server error",
      });
    }
  }

  /**
   * Remove preferred provider
   */
  static async removePreferredProvider(
    req: Request<{ id: string }, ClientProfileResponse, { providerId: string }>,
    res: Response<ClientProfileResponse>
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { providerId } = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(providerId)) {
        res.status(400).json({
          message: "Invalid ID format",
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

      const providerObjectId = new Types.ObjectId(providerId);
      clientProfile.preferredProviders =
        clientProfile.preferredProviders.filter(
          (p) => !p.equals(providerObjectId)
        );

      await clientProfile.save();
      await clientProfile.populate([
        {
          path: "profileId",
          select: "userId role bio location contactDetails",
        },
        {
          path: "preferredServices",
          select: "title description categoryId",
        },
        {
          path: "preferredProviders",
          select: "userId businessName contactInfo",
        },
      ]);

      res.status(200).json({
        message: "Preferred provider removed successfully",
        clientProfile: clientProfile.toObject(),
      });
    } catch (error) {
      console.error("Error removing preferred provider:", error);
      res.status(500).json({
        message: "Failed to remove preferred provider",
        error: "Internal server error",
      });
    }
  }

  /**
   * Get high-risk clients
   */
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
      res.status(500).json({
        message: "Failed to retrieve high-risk clients",
        error: "Internal server error",
      });
    }
  }
}

export default ClientProfileController;
