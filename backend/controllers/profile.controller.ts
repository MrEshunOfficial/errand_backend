// controllers/profile.controller.ts
import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { Profile } from "../models/profile.model.js";
import {
  AuthResponse,
  UpdateProfileRequestBody,
  IUserProfile,
  IUser,
  UserRole,
  AuthenticatedRequest,
} from "../types/user.types.js";

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
});

export const getProfile = async (
  req: AuthenticatedRequest, // Use proper authenticated request type
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const user = (await User.findById(req.userId)) as IUser | null;

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get or create user profile
    let profile = (await Profile.findOne({
      userId: req.userId,
    })) as IUserProfile | null;

    if (!profile) {
      // Create default profile if it doesn't exist
      profile = (await Profile.create({
        userId: req.userId,
        role: UserRole.CUSTOMER,
        isActive: true,
      })) as IUserProfile;
    }

    res.status(200).json({
      message: "Profile retrieved successfully",
      user: createCleanUserResponse(user),
      profile: profile,
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
    ];

    const requestedUpdates = Object.keys(
      updates
    ) as (keyof UpdateProfileRequestBody)[];
    const isValidUpdate = requestedUpdates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      res.status(400).json({ message: "Invalid updates" });
      return;
    }

    // If profile updates are provided, validate them
    if (updates.profile) {
      const profileUpdates = Object.keys(
        updates.profile
      ) as (keyof Partial<IUserProfile>)[];
      const isValidProfileUpdate = profileUpdates.every((update) =>
        allowedProfileUpdates.includes(update)
      );

      if (!isValidProfileUpdate) {
        res.status(400).json({ message: "Invalid profile updates" });
        return;
      }
    }

    // Update user basic info (name, avatar)
    const userUpdateObject: Partial<IUser> = {};
    if (updates.name) userUpdateObject.name = updates.name;
    if (updates.avatar) userUpdateObject.avatar = updates.avatar;

    let user: IUser | null;
    if (Object.keys(userUpdateObject).length > 0) {
      user = (await User.findByIdAndUpdate(
        userId,
        { $set: userUpdateObject },
        { new: true, runValidators: true }
      )) as IUser | null;

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    } else {
      user = (await User.findById(userId)) as IUser | null;
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    }

    // Update profile if profile data is provided
    let profile: IUserProfile | null;
    if (updates.profile) {
      // Find existing profile or create new one
      profile = (await Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            ...updates.profile,
            lastModified: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          upsert: true, // Create if doesn't exist
        }
      )) as IUserProfile | null;
    } else {
      // Just get the existing profile
      profile = (await Profile.findOne({ userId })) as IUserProfile | null;
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: createCleanUserResponse(user),
      profile: profile,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

// New controller for updating profile role specifically
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
    const profile = (await Profile.findOneAndUpdate(
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
      }
    )) as IUserProfile | null;

    const user = (await User.findById(userId)) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: `Profile role updated to ${role} successfully`,
      user: createCleanUserResponse(user),
      profile: profile,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// New controller for updating location
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

    const profile = (await Profile.findOneAndUpdate(
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
      }
    )) as IUserProfile | null;

    const user = (await User.findById(userId)) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Location updated successfully",
      user: createCleanUserResponse(user),
      profile: profile,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        message: "Validation error",
        error: error.message,
      });
    } else {
      res.status(500).json({ message: "Internal server error" });
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

// New controller for getting profile completeness
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

    const profile = (await Profile.findOne({ userId })) as IUserProfile | null;

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

    const user = (await User.findById(req.userId)) as IUser | null;
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profile = (await Profile.findOne({
      userId: req.userId,
    })) as IUserProfile | null;

    res.status(200).json({
      message: "Profile context retrieved successfully",
      user: createCleanUserResponse(user),
      profile: profile,
      hasProfile: !!profile,
      profileRole: profile?.role || null,
      completeness: profile?.completeness || 0,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
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
      })) as IUserProfile | null;

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
      })) as IUserProfile | null;
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
  isActive?: boolean;
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
      User.findById(userId) as Promise<IUser | null>,
      Profile.findOne({ userId }) as Promise<IUserProfile | null>,
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      message: "Batch profile data retrieved successfully",
      user: createCleanUserResponse(user),
      profile: profile,
      hasProfile: !!profile,
      profileRole: profile?.role || null,
      completeness: profile?.completeness || 0,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
