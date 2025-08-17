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

// Helper function to create clean user response with proper typing
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

// Helper function to create clean profile response
const createCleanProfileResponse = (
  profile: any
): Partial<IUserProfile> | null => {
  if (!profile) return null;

  // Convert Mongoose document to plain object
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

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const user = (await User.findById(req.userId).lean()) as IUser | null;

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get or create user profile
    let profile = (await Profile.findOne({
      userId: req.userId,
    }).lean()) as IUserProfile | null;

    if (!profile) {
      // Create default profile if it doesn't exist
      const newProfile = await Profile.create({
        userId: req.userId,
        role: UserRole.CUSTOMER,
        verificationStatus: VerificationStatus.PENDING,
        moderationStatus: ModerationStatus.PENDING,
        warningsCount: 0,
        completeness: 0,
        isActiveInMarketplace: false,
      });

      profile = newProfile.toObject() as IUserProfile;
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateProfile = async (
  req: Request<{}, AuthResponse, UpdateProfileRequestBody> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const updates = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    // Validate allowed updates
    const allowedUpdates: (keyof UpdateProfileRequestBody)[] = [
      "name",
      "avatar",
      "profile",
    ];

    const allowedProfileUpdates: (keyof Partial<IUserProfile>)[] = [
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

    const requestedUpdates = Object.keys(
      updates
    ) as (keyof UpdateProfileRequestBody)[];

    // Log the requested updates for debugging
    console.log("Requested updates:", requestedUpdates);
    console.log("Allowed updates:", allowedUpdates);

    const isValidUpdate = requestedUpdates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      // Log which updates are invalid
      const invalidUpdates = requestedUpdates.filter(
        (update) => !allowedUpdates.includes(update)
      );
      console.log("Invalid updates:", invalidUpdates);

      res.status(400).json({
        message: `Invalid updates: ${invalidUpdates.join(
          ", "
        )}. Allowed updates are: ${allowedUpdates.join(", ")}`,
      });
      return;
    }

    // If profile updates are provided, validate them
    if (updates.profile) {
      const profileUpdates = Object.keys(
        updates.profile
      ) as (keyof Partial<IUserProfile>)[];

      console.log("Profile updates:", profileUpdates);
      console.log("Allowed profile updates:", allowedProfileUpdates);

      const isValidProfileUpdate = profileUpdates.every((update) =>
        allowedProfileUpdates.includes(update)
      );

      if (!isValidProfileUpdate) {
        const invalidProfileUpdates = profileUpdates.filter(
          (update) => !allowedProfileUpdates.includes(update)
        );
        console.log("Invalid profile updates:", invalidProfileUpdates);

        res.status(400).json({
          message: `Invalid profile updates: ${invalidProfileUpdates.join(
            ", "
          )}. Allowed profile updates are: ${allowedProfileUpdates.join(", ")}`,
        });
        return;
      }
    }

    // Update user basic info (name, avatar)
    const userUpdateObject: Partial<IUser> = {};
    if (updates.name !== undefined) userUpdateObject.name = updates.name;
    if (updates.avatar !== undefined) userUpdateObject.avatar = updates.avatar;

    let user: IUser | null;
    if (Object.keys(userUpdateObject).length > 0) {
      user = (await User.findByIdAndUpdate(
        userId,
        { $set: userUpdateObject },
        { new: true, runValidators: true, lean: true }
      )) as IUser | null;

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    } else {
      user = (await User.findById(userId).lean()) as IUser | null;
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    }

    // Update profile if profile data is provided
    let profile: any = null;
    if (updates.profile) {
      const updateData = {
        ...updates.profile,
        lastModified: new Date(),
      };

      // Find existing profile or create new one
      profile = await Profile.findOneAndUpdate(
        { userId },
        { $set: updateData },
        {
          new: true,
          runValidators: true,
          upsert: true,
          lean: true,
        }
      );
    } else {
      // Just get the existing profile
      profile = await Profile.findOne({ userId }).lean();
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

// Controller for updating profile role specifically
export const updateProfileRole = async (
  req: Request<{}, AuthResponse, { role: UserRole }> & AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { role } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (!role || !Object.values(UserRole).includes(role)) {
      res.status(400).json({
        message: `Invalid role. Must be one of: ${Object.values(UserRole).join(
          ", "
        )}`,
      });
      return;
    }

    // Update or create profile with new role
    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          role,
          lastModified: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        lean: true,
      }
    );

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: `Profile role updated to ${role} successfully`,
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Controller for updating location
export const updateProfileLocation = async (
  req: Request<{}, AuthResponse, { location: IUserProfile["location"] }> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { location } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (!location || !location.ghanaPostGPS) {
      res.status(400).json({
        message: "Ghana Post GPS address is required",
      });
      return;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          location,
          lastModified: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        lean: true,
      }
    );

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Location updated successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

// Response interface for completeness endpoint
interface ProfileCompletenessResponse {
  message: string;
  completeness: number;
  data?: {
    completeness: number;
  };
}

// Controller for getting profile completeness
export const getProfileCompleteness = async (
  req: AuthenticatedRequest,
  res: Response<ProfileCompletenessResponse>
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        message: "User ID not found in request",
        completeness: 0,
      });
      return;
    }

    const profile = (await Profile.findOne({
      userId,
    }).lean()) as IUserProfile | null;

    if (!profile) {
      res.status(200).json({
        completeness: 0,
        message: "No profile found",
      });
      return;
    }

    res.status(200).json({
      message: "Profile completeness retrieved successfully",
      completeness: profile.completeness || 0,
      data: {
        completeness: profile.completeness || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      completeness: 0,
    });
  }
};

// Extended AuthResponse for context endpoint
interface ProfileContextResponse extends AuthResponse {
  hasProfile?: boolean;
  profileRole?: UserRole | null;
  completeness?: number;
  verificationStatus?: VerificationStatus;
  moderationStatus?: ModerationStatus;
  isActiveInMarketplace?: boolean;
}

// Get profile with full context (for dashboard initialization)
export const getProfileWithContext = async (
  req: AuthenticatedRequest,
  res: Response<ProfileContextResponse>
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const user = (await User.findById(req.userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profile = (await Profile.findOne({
      userId: req.userId,
    }).lean()) as IUserProfile | null;

    res.status(200).json({
      message: "Profile context retrieved successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
      hasProfile: !!profile,
      profileRole: profile?.role || null,
      completeness: profile?.completeness || 0,
      verificationStatus:
        profile?.verificationStatus || VerificationStatus.PENDING,
      moderationStatus: profile?.moderationStatus || ModerationStatus.PENDING,
      isActiveInMarketplace: profile?.isActiveInMarketplace || false,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Controller for updating user preferences
export const updateProfilePreferences = async (
  req: Request<{}, AuthResponse, { preferences: Partial<IUserPreferences> }> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { preferences } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (!preferences) {
      res.status(400).json({ message: "Preferences data is required" });
      return;
    }

    const profile = await Profile.findOne({ userId });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    // Use the model's updatePreferences method
    const updatedProfile = await profile.updatePreferences(preferences);

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Preferences updated successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(updatedProfile),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

// Controller for updating specific preference
export const updateSpecificPreference = async (
  req: Request<{}, AuthResponse, UpdatePreferenceRequest> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { category, key, value } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (!category || !key || value === undefined) {
      res
        .status(400)
        .json({ message: "Category, key, and value are required" });
      return;
    }

    const validCategories: PreferenceCategory[] = [
      "notifications",
      "privacy",
      "app",
    ];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
      return;
    }

    const updatePath = `preferences.${category}.${key}`;
    const updateData = {
      [updatePath]: value,
      "preferences.lastUpdated": new Date(),
      lastModified: new Date(),
    };

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        upsert: true,
        lean: true,
      }
    );

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: `${category} preference updated successfully`,
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

// Controller for bulk preference updates
export const bulkUpdatePreferences = async (
  req: Request<{}, AuthResponse, BulkUpdatePreferenceRequest> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { category, updates } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (!category || !updates || typeof updates !== "object") {
      res
        .status(400)
        .json({ message: "Category and updates object are required" });
      return;
    }

    const validCategories: PreferenceCategory[] = [
      "notifications",
      "privacy",
      "app",
    ];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(
          ", "
        )}`,
      });
      return;
    }

    // Build update object
    const updateData: any = {
      "preferences.lastUpdated": new Date(),
      lastModified: new Date(),
    };

    Object.keys(updates).forEach((key) => {
      updateData[`preferences.${category}.${key}`] = updates[key];
    });

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        upsert: true,
        lean: true,
      }
    );

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: `${category} preferences updated successfully`,
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

// Utility function to check if user has specific profile role
export const hasProfileRole = (
  profile: IUserProfile | null,
  role: UserRole
): boolean => {
  return profile?.role === role;
};

// Middleware interfaces
interface AuthenticatedRequestWithProfile extends AuthenticatedRequest {
  profile?: IUserProfile | null;
}

// Middleware to check profile role
export const requireProfileRole = (role: UserRole) => {
  return async (
    req: AuthenticatedRequestWithProfile,
    res: Response,
    next: any
  ) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const profile = (await Profile.findOne({
        userId,
      }).lean()) as IUserProfile | null;

      if (!hasProfileRole(profile, role)) {
        return res.status(403).json({
          message: `Access denied. ${role} role required.`,
        });
      }

      req.profile = profile;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

// Middleware to attach profile to request
export const attachProfile = async (
  req: AuthenticatedRequestWithProfile,
  res: Response,
  next: any
): Promise<void> => {
  try {
    const userId = req.userId;

    if (userId) {
      const profile = (await Profile.findOne({
        userId,
      }).lean()) as IUserProfile | null;
      req.profile = profile;
    }

    next();
  } catch (error) {
    next();
  }
};

// Extended response interface for batch operations
interface BatchProfileResponse extends AuthResponse {
  hasProfile?: boolean;
  profileRole?: UserRole | null;
  completeness?: number;
  isActiveInMarketplace?: boolean;
  verificationStatus?: VerificationStatus;
  moderationStatus?: ModerationStatus;
}

// Batch profile operations for better performance
export const batchProfileOperations = async (
  req: AuthenticatedRequest,
  res: Response<BatchProfileResponse>
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    // Get user and profile in parallel for better performance
    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOne({ userId }).lean() as Promise<IUserProfile | null>,
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Batch profile data retrieved successfully",
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
      hasProfile: !!profile,
      profileRole: profile?.role || null,
      completeness: profile?.completeness || 0,
      isActiveInMarketplace: profile?.isActiveInMarketplace || false,
      verificationStatus:
        profile?.verificationStatus || VerificationStatus.PENDING,
      moderationStatus: profile?.moderationStatus || ModerationStatus.PENDING,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Controller for soft deleting a profile
export const deleteProfile = async (
  req: AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const profile = await Profile.findOne({ userId });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    await profile.softDelete(userId);

    res.status(200).json({
      message: "Profile deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Controller for restoring a soft-deleted profile
export const restoreProfile = async (
  req: AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    // Find profile including soft deleted ones
    const profile = await Profile.findOne({ userId }).setOptions({
      includeSoftDeleted: true,
    });
    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    if (!profile.isDeleted) {
      res.status(400).json({ message: "Profile is not deleted" });
      return;
    }

    await profile.restore();

    res.status(200).json({
      message: "Profile restored successfully",
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Controller for updating marketplace status
export const updateMarketplaceStatus = async (
  req: Request<{}, AuthResponse, { isActiveInMarketplace: boolean }> &
    AuthenticatedRequest,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { isActiveInMarketplace } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    if (typeof isActiveInMarketplace !== "boolean") {
      res
        .status(400)
        .json({ message: "isActiveInMarketplace must be a boolean" });
      return;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          isActiveInMarketplace,
          lastModified: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        lean: true,
      }
    );

    const user = (await User.findById(userId).lean()) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: `Marketplace status updated successfully`,
      user: createCleanUserResponse(user),
      profile: createCleanProfileResponse(profile),
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
