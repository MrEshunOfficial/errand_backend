// controllers/profile.controller.ts
import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import {
  AuthResponse,
  UpdateProfileRequestBody,
  IUser,
  AuthenticatedRequest,
} from "../types/user.types.js";
import {
  UserRole,
  VerificationStatus,
  ModerationStatus,
  IUserPreferences,
  UpdatePreferenceRequest,
  PreferenceCategory,
  BulkUpdatePreferenceRequest,
} from "../types/base.types.js";
import { IUserProfile } from "../types/profile.types.js";

// Helper functions
const createCleanUserResponse = (user: IUser): Partial<IUser> => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  systemAdminName: user.systemAdminName,
  avatar: user.avatar,
  systemRole: user.systemRole,
  provider: user.provider,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  isVerified: user.isVerified,
  isAdmin: user.isAdmin,
  isSuperAdmin: user.isSuperAdmin,
  updatedAt: user.updatedAt,
  status: user.status,
  displayName: user.displayName,
});

const createCleanProfileResponse = (profile: any): Partial<IUserProfile> | null => {
  if (!profile) return null;
  const profileObj = profile.toObject ? profile.toObject() : profile;
  return {
    _id: profileObj._id,
    userId: profileObj.userId,
    role: profileObj.role,
    bio: profileObj.bio,
    location: profileObj.location,
    preferences: profileObj.preferences,
    socialMediaHandles: profileObj.socialMediaHandles,
    contactDetails: profileObj.contactDetails,
    idDetails: profileObj.idDetails,
    profilePicture: profileObj.profilePicture,
    verificationStatus: profileObj.verificationStatus,
    moderationStatus: profileObj.moderationStatus,
    warningsCount: profileObj.warningsCount,
    completeness: profileObj.completeness,
    isActiveInMarketplace: profileObj.isActiveInMarketplace,
    createdAt: profileObj.createdAt,
    updatedAt: profileObj.updatedAt,
    lastModified: profileObj.lastModified,
    isDeleted: profileObj.isDeleted,
    deletedAt: profileObj.deletedAt,
    deletedBy: profileObj.deletedBy,
  };
};

// Utility functions
const asyncHandler = (fn: Function) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error("Controller error:", error);
    const isValidationError = error?.name === "ValidationError";
    res.status(isValidationError ? 400 : 500).json({
      message: isValidationError ? "Validation error" : "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });
};

const validateAuth = (req: AuthenticatedRequest, res: Response): string | null => {
  if (!req.userId) {
    res.status(401).json({ message: "User ID not found in request" });
    return null;
  }
  return req.userId;
};

const validateUpdates = (updates: string[], allowed: string[]): string[] => {
  return updates.filter(update => !allowed.includes(update));
};

const createSuccessResponse = (user: IUser | null, profile: any, message: string, additionalData: any = {}) => ({
  message,
  user: user ? createCleanUserResponse(user) : undefined,
  profile: createCleanProfileResponse(profile),
  ...additionalData,
});

const findUserAndProfile = async (userId: string) => {
  return Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOne({ userId }).lean() as Promise<IUserProfile | null>
  ]);
};

const createDefaultProfile = async (userId: string) => {
  const newProfile = await Profile.create({
    userId,
    role: UserRole.CUSTOMER,
    verificationStatus: VerificationStatus.PENDING,
    moderationStatus: ModerationStatus.PENDING,
    warningsCount: 0,
    completeness: 0,
    isActiveInMarketplace: false,
  });
  return newProfile.toObject() as unknown as IUserProfile;
};

// Controllers
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const [user, profile] = await findUserAndProfile(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const finalProfile = profile || await createDefaultProfile(userId);
  res.status(200).json(createSuccessResponse(user, finalProfile, "Profile retrieved successfully"));
});


export const updateProfile = asyncHandler(
  async (
    req: Request<{}, AuthResponse, UpdateProfileRequestBody> &
      AuthenticatedRequest,
    res: Response<AuthResponse>
  ) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const updates = req.body;
    const allowedUpdates = ["name", "avatar", "profile"];
    const allowedProfileUpdates = [
      "role",
      "bio",
      "location",
      "preferences",
      "socialMediaHandles",
      "contactDetails",
      "idDetails",
      "profilePicture",
      "isActiveInMarketplace",
    ];

    // Validate updates
    const invalidUpdates = validateUpdates(Object.keys(updates), allowedUpdates);
    if (invalidUpdates.length) {
      return res.status(400).json({
        message: `Invalid updates: ${invalidUpdates.join(
          ", "
        )}. Allowed updates are: ${allowedUpdates.join(", ")}`,
      });
    }

    // Validate profile updates if provided
    if (updates.profile) {
      const invalidProfileUpdates = validateUpdates(
        Object.keys(updates.profile),
        allowedProfileUpdates
      );
      if (invalidProfileUpdates.length) {
        return res.status(400).json({
          message: `Invalid profile updates: ${invalidProfileUpdates.join(
            ", "
          )}. Allowed profile updates are: ${allowedProfileUpdates.join(", ")}`,
        });
      }
    }

    // Update user
    const userUpdateObject: Partial<{ name: string; avatar: string }> = {};
    if (updates.name !== undefined) userUpdateObject.name = updates.name;
    if (updates.avatar !== undefined) userUpdateObject.avatar = updates.avatar;

    const user =
      Object.keys(userUpdateObject).length > 0
        ? await User.findByIdAndUpdate(
            userId,
            { $set: userUpdateObject },
            { new: true, runValidators: true, lean: true }
          )
        : await User.findById(userId).lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    // Update profile if provided
    const profile = updates.profile
      ? await Profile.findOneAndUpdate(
          { userId },
          { $set: { ...updates.profile, lastModified: new Date() } },
          { new: true, runValidators: true, upsert: true, lean: true }
        )
      : await Profile.findOne({ userId }).lean();

    res
      .status(200)
      .json(createSuccessResponse(user, profile, "Profile updated successfully"));
  }
);

export const updateProfileRole = asyncHandler(async (req: Request<{}, AuthResponse, { role: UserRole }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { role } = req.body;
  if (!role || !Object.values(UserRole).includes(role)) {
    return res.status(400).json({
      message: `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}`,
    });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { $set: { role, lastModified: new Date() } },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, `Profile role updated to ${role} successfully`));
});

export const updateProfileLocation = asyncHandler(async (req: Request<{}, AuthResponse, { location: IUserProfile["location"] }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { location } = req.body;
  if (!location?.ghanaPostGPS) {
    return res.status(400).json({ message: "Ghana Post GPS address is required" });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { $set: { location, lastModified: new Date() } },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, "Location updated successfully"));
});

export const getProfileCompleteness = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = validateAuth(req, res);
  if (!userId) return res.status(401).json({ message: "User ID not found in request", completeness: 0 });

  const profile = await Profile.findOne({ userId }).lean() as IUserProfile | null;
  const completeness = profile?.completeness || 0;

  res.status(200).json({
    message: profile ? "Profile completeness retrieved successfully" : "No profile found",
    completeness,
    data: { completeness },
  });
});

export const getProfileWithContext = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const [user, profile] = await findUserAndProfile(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json(createSuccessResponse(user, profile, "Profile context retrieved successfully", {
    hasProfile: !!profile,
    profileRole: profile?.role || null,
    completeness: profile?.completeness || 0,
    verificationStatus: profile?.verificationStatus || VerificationStatus.PENDING,
    moderationStatus: profile?.moderationStatus || ModerationStatus.PENDING,
    isActiveInMarketplace: profile?.isActiveInMarketplace || false,
  }));
});

export const updateProfilePreferences = asyncHandler(async (req: Request<{}, AuthResponse, { preferences: Partial<IUserPreferences> }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { preferences } = req.body;
  if (!preferences) return res.status(400).json({ message: "Preferences data is required" });

  const profile = await Profile.findOne({ userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const updatedProfile = await profile.updatePreferences(preferences);
  const user = await User.findById(userId).lean() as IUser | null;
  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json(createSuccessResponse(user, updatedProfile, "Preferences updated successfully"));
});

export const updateSpecificPreference = asyncHandler(async (req: Request<{}, AuthResponse, UpdatePreferenceRequest> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { category, key, value } = req.body;
  if (!category || !key || value === undefined) {
    return res.status(400).json({ message: "Category, key, and value are required" });
  }

  const validCategories: PreferenceCategory[] = ["notifications", "privacy", "app"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    });
  }

  const updateData = {
    [`preferences.${category}.${key}`]: value,
    "preferences.lastUpdated": new Date(),
    lastModified: new Date(),
  };

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true, upsert: true, lean: true })
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, `${category} preference updated successfully`));
});

export const bulkUpdatePreferences = asyncHandler(async (req: Request<{}, AuthResponse, BulkUpdatePreferenceRequest> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { category, updates } = req.body;
  if (!category || !updates || typeof updates !== "object") {
    return res.status(400).json({ message: "Category and updates object are required" });
  }

  const validCategories: PreferenceCategory[] = ["notifications", "privacy", "app"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      message: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
    });
  }

  const updateData: any = {
    "preferences.lastUpdated": new Date(),
    lastModified: new Date(),
  };
  Object.keys(updates).forEach(key => {
    updateData[`preferences.${category}.${key}`] = updates[key];
  });

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true, upsert: true, lean: true })
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, `${category} preferences updated successfully`));
});

export const batchProfileOperations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const [user, profile] = await findUserAndProfile(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  res.status(200).json(createSuccessResponse(user, profile, "Batch profile data retrieved successfully", {
    hasProfile: !!profile,
    profileRole: profile?.role || null,
    completeness: profile?.completeness || 0,
    isActiveInMarketplace: profile?.isActiveInMarketplace || false,
    verificationStatus: profile?.verificationStatus || VerificationStatus.PENDING,
    moderationStatus: profile?.moderationStatus || ModerationStatus.PENDING,
  }));
});

export const deleteProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const profile = await Profile.findOne({ userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  await profile.softDelete(userId);
  res.status(200).json({ message: "Profile deleted successfully" });
});

export const restoreProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const profile = await Profile.findOne({ userId }).setOptions({ includeSoftDeleted: true });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  if (!profile.isDeleted) return res.status(400).json({ message: "Profile is not deleted" });

  await profile.restore();
  res.status(200).json({
    message: "Profile restored successfully",
    profile: createCleanProfileResponse(profile),
  });
});

export const updateMarketplaceStatus = asyncHandler(async (req: Request<{}, AuthResponse, { isActiveInMarketplace: boolean }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { isActiveInMarketplace } = req.body;
  if (typeof isActiveInMarketplace !== "boolean") {
    return res.status(400).json({ message: "isActiveInMarketplace must be a boolean" });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { $set: { isActiveInMarketplace, lastModified: new Date() } },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, "Marketplace status updated successfully"));
});

// Utility functions (kept as-is for backwards compatibility)
export const hasProfileRole = (profile: IUserProfile | null, role: UserRole): boolean => {
  return profile?.role === role;
};

interface AuthenticatedRequestWithProfile extends AuthenticatedRequest {
  profile?: IUserProfile | null;
}

export const requireProfileRole = (role: UserRole) => {
  return async (req: AuthenticatedRequestWithProfile, res: Response, next: any) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const profile = await Profile.findOne({ userId }).lean() as IUserProfile | null;
      if (!hasProfileRole(profile, role)) {
        return res.status(403).json({ message: `Access denied. ${role} role required.` });
      }

      req.profile = profile;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

export const attachProfile = async (req: AuthenticatedRequestWithProfile, res: Response, next: any): Promise<void> => {
  try {
    if (req.userId) {
      req.profile = await Profile.findOne({ userId: req.userId }).lean() as IUserProfile | null;
    }
    next();
  } catch (error) {
    next();
  }
};

// ===== ADMIN PROFILE MANAGEMENT CONTROLLERS =====

// 1. Verification & Moderation Status Updates
export const updateVerificationStatus = asyncHandler(async (req: Request<{}, AuthResponse, { userId: string; status: VerificationStatus; reason?: string }>, res: Response<AuthResponse>) => {
  const { userId, status, reason } = req.body;
  
  if (!userId || !status || !Object.values(VerificationStatus).includes(status)) {
    return res.status(400).json({
      message: `Invalid data. UserId and valid status (${Object.values(VerificationStatus).join(", ")}) are required`,
    });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          verificationStatus: status, 
          lastModified: new Date(),
          ...(reason && { verificationReason: reason })
        }
      },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, `Verification status updated to ${status}`));
});

export const updateModerationStatus = asyncHandler(async (req: Request<{}, AuthResponse, { userId: string; status: ModerationStatus; reason?: string }>, res: Response<AuthResponse>) => {
  const { userId, status, reason } = req.body;
  
  if (!userId || !status || !Object.values(ModerationStatus).includes(status)) {
    return res.status(400).json({
      message: `Invalid data. UserId and valid status (${Object.values(ModerationStatus).join(", ")}) are required`,
    });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          moderationStatus: status, 
          lastModified: new Date(),
          ...(reason && { moderationReason: reason })
        }
      },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, `Moderation status updated to ${status}`));
});

export const initiateProfileVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const profile = await Profile.findOne({ userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  // Check if profile meets verification requirements
  const completeness = profile.completeness || 0;
  if (completeness < 80) {
    return res.status(400).json({
      message: "Profile must be at least 80% complete to initiate verification",
    });
  }

  const updatedProfile = await Profile.findOneAndUpdate(
    { userId },
    { 
      $set: { 
        verificationStatus: VerificationStatus.PENDING,
        verificationInitiatedAt: new Date(),
        lastModified: new Date()
      }
    },
    { new: true, lean: true }
  );

  const user = await User.findById(userId).lean() as IUser | null;
  res.status(200).json(createSuccessResponse(user, updatedProfile, "Profile verification initiated successfully"));
});
interface ProfileListResponse {
  message: string;
  profiles: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const createPaginatedResponse = (profiles: any[], total: number, page: number, limit: number, message: string): ProfileListResponse => ({
  message,
  profiles: profiles.map(profile => ({
    ...createCleanProfileResponse(profile),
    user: profile.userId ? createCleanUserResponse(profile.userId) : null,
  })),
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

export const getAllProfiles = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find({})
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({})
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, "All profiles retrieved successfully"));
});

export const getProfilesByStatus = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const { status } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  if (!['active', 'inactive', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({
      message: "Invalid status. Must be one of: active, inactive, suspended, banned",
    } as any);
  }

  const [profiles, total] = await Promise.all([
    Profile.find({ status })
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ status })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, `Profiles with status '${status}' retrieved successfully`));
});

export const getProfilesByVerificationStatus = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const { status } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  if (!Object.values(VerificationStatus).includes(status as VerificationStatus)) {
    return res.status(400).json({
      message: `Invalid verification status. Must be one of: ${Object.values(VerificationStatus).join(", ")}`,
    } as any);
  }

  const [profiles, total] = await Promise.all([
    Profile.find({ verificationStatus: status })
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ verificationStatus: status })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, `Profiles with verification status '${status}' retrieved successfully`));
});

export const getProfilesByModerationStatus = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const { status } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  if (!Object.values(ModerationStatus).includes(status as ModerationStatus)) {
    return res.status(400).json({
      message: `Invalid moderation status. Must be one of: ${Object.values(ModerationStatus).join(", ")}`,
    } as any);
  }

  const [profiles, total] = await Promise.all([
    Profile.find({ moderationStatus: status })
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ moderationStatus: status })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, `Profiles with moderation status '${status}' retrieved successfully`));
});

export const getIncompleteProfiles = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const threshold = parseInt(req.query.threshold as string) || 50; // Default 50% completeness
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find({ completeness: { $lt: threshold } })
      .populate('userId', 'name email avatar displayName')
      .sort({ completeness: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ completeness: { $lt: threshold } })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, `Incomplete profiles (< ${threshold}%) retrieved successfully`));
});

export const getMarketplaceActiveProfiles = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find({ isActiveInMarketplace: true })
      .populate('userId', 'name email avatar displayName')
      .sort({ lastModified: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ isActiveInMarketplace: true })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, "Marketplace active profiles retrieved successfully"));
});

export const recalculateProfileCompleteness = asyncHandler(async (req: Request<{ userId?: string }>, res: Response) => {
  const { userId } = req.params;

  if (userId) {
    // Recalculate for specific user
    const profile = await Profile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Assuming the Profile model has a method to calculate completeness
    const newCompleteness = await profile.calculateCompleteness();
    await profile.updateOne({ completeness: newCompleteness });

    return res.status(200).json({
      message: "Profile completeness recalculated successfully",
      userId,
      completeness: newCompleteness,
    });
  } else {
    // Recalculate for all profiles (batch operation)
    const profiles = await Profile.find({});
    let updated = 0;

    for (const profile of profiles) {
      const newCompleteness = await profile.calculateCompleteness();
      if (newCompleteness !== profile.completeness) {
        await profile.updateOne({ completeness: newCompleteness });
        updated++;
      }
    }

    return res.status(200).json({
      message: "Profile completeness recalculated for all profiles",
      totalProfiles: profiles.length,
      updatedProfiles: updated,
    });
  }
});
// Additional controller methods to complement your existing profile.controller.ts

// ===== PROFILE SEARCH AND FILTERING =====

export const searchProfiles = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const { 
    q, 
    role, 
    region, 
    city, 
    district,
    verificationStatus,
    moderationStatus,
    isActiveInMarketplace,
    minCompleteness,
    maxCompleteness,
    page = 1, 
    limit = 20 
  } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const query: any = {};

  // Text search
  if (q) {
    query.$text = { $search: q as string };
  }

  // Filter by role
  if (role && Object.values(UserRole).includes(role as UserRole)) {
    query.role = role;
  }

  // Location filters
  if (region) query['location.region'] = { $regex: region, $options: 'i' };
  if (city) query['location.city'] = { $regex: city, $options: 'i' };
  if (district) query['location.district'] = { $regex: district, $options: 'i' };

  // Status filters
  if (verificationStatus && Object.values(VerificationStatus).includes(verificationStatus as VerificationStatus)) {
    query.verificationStatus = verificationStatus;
  }
  if (moderationStatus && Object.values(ModerationStatus).includes(moderationStatus as ModerationStatus)) {
    query.moderationStatus = moderationStatus;
  }
  if (isActiveInMarketplace !== undefined) {
    query.isActiveInMarketplace = isActiveInMarketplace === 'true';
  }

  // Completeness range
  if (minCompleteness || maxCompleteness) {
    query.completeness = {};
    if (minCompleteness) query.completeness.$gte = parseInt(minCompleteness as string);
    if (maxCompleteness) query.completeness.$lte = parseInt(maxCompleteness as string);
  }

  const [profiles, total] = await Promise.all([
    Profile.find(query)
      .populate('userId', 'name email avatar displayName')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean(),
    Profile.countDocuments(query)
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, parseInt(page as string), parseInt(limit as string), "Profiles search completed successfully"));
});

export const getProfilesByLocation = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const { latitude, longitude, radius = 10, page = 1, limit = 20 } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      message: "Latitude and longitude are required for location-based search",
    } as any);
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [profiles, total] = await Promise.all([
    Profile.find({
      'location.gpsCoordinates': {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(longitude as string), parseFloat(latitude as string)], 
            parseFloat(radius as string) / 6378.1 // Convert km to radians
          ]
        }
      }
    })
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean(),
    Profile.countDocuments({
      'location.gpsCoordinates': {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(longitude as string), parseFloat(latitude as string)], 
            parseFloat(radius as string) / 6378.1
          ]
        }
      }
    })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, parseInt(page as string), parseInt(limit as string), `Profiles within ${radius}km retrieved successfully`));
});

// ===== PROFILE ANALYTICS =====

export const getProfileAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalProfiles,
    activeMarketplaceProfiles,
    verificationStats,
    moderationStats,
    roleStats,
    completenessStats,
    locationStats,
    recentlyCreated
  ] = await Promise.all([
    Profile.countDocuments({}),
    Profile.countDocuments({ isActiveInMarketplace: true }),
    Profile.aggregate([
      { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }
    ]),
    Profile.aggregate([
      { $group: { _id: '$moderationStatus', count: { $sum: 1 } } }
    ]),
    Profile.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    Profile.aggregate([
      {
        $group: {
          _id: null,
          avgCompleteness: { $avg: '$completeness' },
          minCompleteness: { $min: '$completeness' },
          maxCompleteness: { $max: '$completeness' }
        }
      }
    ]),
    Profile.aggregate([
      { $group: { _id: '$location.region', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    Profile.countDocuments({ 
      createdAt: { 
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      } 
    })
  ]);

  res.status(200).json({
    message: "Profile analytics retrieved successfully",
    data: {
      overview: {
        totalProfiles,
        activeMarketplaceProfiles,
        recentlyCreated
      },
      verificationStatus: verificationStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
      moderationStatus: moderationStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
      roleDistribution: roleStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {} as Record<string, number>),
      completenessStats: completenessStats[0] || {
        avgCompleteness: 0,
        minCompleteness: 0,
        maxCompleteness: 0
      },
      topRegions: locationStats
    }
  });
});

export const addSocialMediaHandle = asyncHandler(async (req: Request<{}, AuthResponse, { nameOfSocial: string; userName: string }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { nameOfSocial, userName } = req.body;
  if (!nameOfSocial || !userName) {
    return res.status(400).json({ message: "Social media name and username are required" });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { 
        $push: { 
          socialMediaHandles: { nameOfSocial, userName }
        },
        $set: { lastModified: new Date() }
      },
      { new: true, runValidators: true, upsert: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, "Social media handle added successfully"));
});

export const removeSocialMediaHandle = asyncHandler(async (req: Request<{ handleId: string }> & AuthenticatedRequest, res: Response<AuthResponse>) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const { handleId } = req.params;
  if (!handleId) {
    return res.status(400).json({ message: "Handle ID is required" });
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOneAndUpdate(
      { userId },
      { 
        $pull: { socialMediaHandles: { _id: handleId } },
        $set: { lastModified: new Date() }
      },
      { new: true, lean: true }
    )
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  res.status(200).json(createSuccessResponse(user, profile, "Social media handle removed successfully"));
});

// ===== PROFILE MODERATION UTILITIES =====

export const moderateProfileContent = asyncHandler(async (req: Request<{}, AuthResponse, { userId: string; status: ModerationStatus; moderatedBy: string; notes?: string }>, res: Response<AuthResponse>) => {
  const { userId, status, moderatedBy, notes } = req.body;

  if (!userId || !status || !moderatedBy || !Object.values(ModerationStatus).includes(status)) {
    return res.status(400).json({
      message: "Valid userId, status, and moderatedBy are required"
    });
  }

  const profile = await Profile.findOne({ userId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const updatedProfile = await profile.updateModeration(status, moderatedBy, notes);
  const user = await User.findById(userId).lean() as IUser | null;

  res.status(200).json(createSuccessResponse(user, updatedProfile, "Profile moderation updated successfully"));
});

export const getPendingModerationProfiles = asyncHandler(async (req: Request, res: Response<ProfileListResponse>) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find({ 
      $or: [
        { moderationStatus: ModerationStatus.PENDING },
        { verificationStatus: VerificationStatus.PENDING }
      ]
    })
      .populate('userId', 'name email avatar displayName')
      .sort({ createdAt: 1 }) // Oldest first
      .skip(skip)
      .limit(limit)
      .lean(),
    Profile.countDocuments({ 
      $or: [
        { moderationStatus: ModerationStatus.PENDING },
        { verificationStatus: VerificationStatus.PENDING }
      ]
    })
  ]);

  res.status(200).json(createPaginatedResponse(profiles, total, page, limit, "Pending moderation profiles retrieved successfully"));
});

// ===== PROFILE EXPORT/IMPORT =====

export const exportProfileData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const [user, profile] = await findUserAndProfile(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const exportData = {
    user: createCleanUserResponse(user),
    profile: createCleanProfileResponse(profile),
    exportedAt: new Date().toISOString(),
    version: "1.0"
  };

  res.status(200).json({
    message: "Profile data exported successfully",
    data: exportData
  });
});

// ===== PROFILE ACTIVITY TRACKING =====

export const getProfileActivitySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = validateAuth(req, res);
  if (!userId) return;

  const profile = await Profile.findOne({ userId }).lean();
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  const summary = {
    userId,
    profileId: profile._id,
    lastModified: profile.lastModified,
    lastModeratedAt: profile.lastModeratedAt,
    verificationStatus: profile.verificationStatus,
    moderationStatus: profile.moderationStatus,
    warningsCount: profile.warningsCount,
    completeness: profile.completeness,
    isActiveInMarketplace: profile.isActiveInMarketplace,
    accountAge: Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)), // days
    preferencesLastUpdated: profile.preferences?.lastUpdated
  };

  res.status(200).json({
    message: "Profile activity summary retrieved successfully",
    data: summary
  });
});