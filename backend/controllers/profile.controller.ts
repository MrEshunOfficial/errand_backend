// controllers/profile.controller.ts
import { Request, Response } from "express";
import { User } from "../models/user.model.js"; // Added .js extension
import { Profile } from "../models/profile.model.js"; // Added .js extension
import {
  AuthResponse,
  UpdateProfileRequestBody,
  IUserProfile,
  UserRole,
} from "../types/user.types.js"; // Added .js extension
import { createUserResponse } from "../utils/oath.utils.js";

export const getProfile = async (
  req: Request & { userId?: string },
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    console.log("getProfile called with userId:", req.userId);

    if (!req.userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const user = await User.findById(req.userId);
    console.log("User found in getProfile:", user ? "Yes" : "No");

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get or create user profile
    let profile = await Profile.findOne({ userId: req.userId });

    if (!profile) {
      // Create default profile if it doesn't exist
      profile = await Profile.create({
        userId: req.userId,
        role: UserRole.CUSTOMER,
        isActive: true,
      });
    }

    const userWithProfile = {
      ...createUserResponse(user),
      profile: profile,
    };

    res.status(200).json({
      message: "Profile retrieved successfully",
      user: userWithProfile,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    } as any);
  }
};

export const updateProfile = async (
  req: Request<{}, AuthResponse, UpdateProfileRequestBody>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const updates = req.body;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    // Validate allowed updates
    const allowedUpdates = ["name", "avatar", "profile"];
    const allowedProfileUpdates = [
      "role",
      "bio",
      "location",
      "preferences",
      "socialMediaHandles",
      "contactDetails",
      "idDetails",
    ];

    const requestedUpdates = Object.keys(updates);
    const isValidUpdate = requestedUpdates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidUpdate) {
      res.status(400).json({ message: "Invalid updates" });
      return;
    }

    // If profile updates are provided, validate them
    if (updates.profile) {
      const profileUpdates = Object.keys(updates.profile);
      const isValidProfileUpdate = profileUpdates.every((update) =>
        allowedProfileUpdates.includes(update)
      );

      if (!isValidProfileUpdate) {
        res.status(400).json({ message: "Invalid profile updates" });
        return;
      }
    }

    // Update user basic info (name, avatar)
    const userUpdateObject: any = {};
    if (updates.name) userUpdateObject.name = updates.name;
    if (updates.avatar) userUpdateObject.avatar = updates.avatar;

    let user;
    if (Object.keys(userUpdateObject).length > 0) {
      user = await User.findByIdAndUpdate(
        userId,
        { $set: userUpdateObject },
        { new: true, runValidators: true }
      );

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    } else {
      user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
    }

    // Update profile if profile data is provided
    let profile;
    if (updates.profile) {
      // Find existing profile or create new one
      profile = await Profile.findOneAndUpdate(
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
      );
    } else {
      // Just get the existing profile
      profile = await Profile.findOne({ userId });
    }

    const userWithProfile = {
      ...createUserResponse(user),
      profile: profile,
    };

    res.status(200).json({
      message: "Profile updated successfully",
      user: userWithProfile,
    });
  } catch (error) {
    console.error("Update profile error:", error);
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
  req: Request<{}, AuthResponse, { role: UserRole }>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { role } = req.body;
    const userId = (req as any).userId;

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
      }
    );

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const userWithProfile = {
      ...createUserResponse(user),
      profile: profile,
    };

    res.status(200).json({
      message: `Profile role updated to ${role} successfully`,
      user: userWithProfile,
    });
  } catch (error) {
    console.error("Update profile role error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// New controller for updating location
export const updateProfileLocation = async (
  req: Request<{}, AuthResponse, { location: IUserProfile["location"] }>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { location } = req.body;
    const userId = (req as any).userId;

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
      }
    );

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const userWithProfile = {
      ...createUserResponse(user),
      profile: profile,
    };

    res.status(200).json({
      message: "Location updated successfully",
      user: userWithProfile,
    });
  } catch (error) {
    console.error("Update profile location error:", error);
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

// New controller for getting profile completeness
export const getProfileCompleteness = async (
  req: Request & { userId?: string },
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: "User ID not found in request" });
      return;
    }

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      res.status(200).json({
        completeness: 0,
        message: "No profile found",
      });
      return;
    }

    res.status(200).json({
      completeness: profile.completeness,
      message: "Profile completeness retrieved successfully",
    });
  } catch (error) {
    console.error("Get profile completeness error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Utility function to check if user has specific profile role
export const hasProfileRole = (
  profile: IUserProfile | null,
  role: UserRole
): boolean => {
  return profile?.role === role;
};

// Middleware to check profile role
export const requireProfileRole = (role: UserRole) => {
  return async (
    req: Request & { userId?: string },
    res: Response,
    next: any
  ) => {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const profile = await Profile.findOne({ userId });

      if (!hasProfileRole(profile, role)) {
        return res.status(403).json({
          message: `Access denied. ${role} role required.`,
        });
      }

      // Attach profile to request for use in subsequent middleware/controllers
      (req as any).profile = profile;

      next();
    } catch (error) {
      console.error("Profile role check error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

// Middleware to attach profile to request
export const attachProfile = async (
  req: Request & { userId?: string },
  res: Response,
  next: any
): Promise<void> => {
  try {
    const userId = req.userId;

    if (userId) {
      const profile = await Profile.findOne({ userId });
      (req as any).profile = profile;
    }

    next();
  } catch (error) {
    console.error("Attach profile error:", error);
    // Don't fail the request, just continue without profile
    next();
  }
};
