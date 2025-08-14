// utils/profile.utils.ts
import { Types } from "mongoose";
import { Profile } from "../models/profile.model.js";
import { User } from "../models/user.model.js";
import {
  IUserProfile,
  IUser,
  UserRole,
  UserLocation,
  IUserPreferences,
  ContactDetails,
  IdDetails,
  SocialMediaHandle,
} from "../types/user.types.js";

// ==================== VALIDATION UTILITIES ====================

/**
 * Validates Ghana Post GPS format
 */
export const validateGhanaPostGPS = (gps: string): boolean => {
  const ghanaGPSRegex = /^[A-Z]{2}-\d{4}-\d{4}$/;
  return ghanaGPSRegex.test(gps);
};

/**
 * Validates Ghana phone number format
 */
export const validateGhanaPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+233[0-9]{9}$|^0[0-9]{9}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates GPS coordinates
 */
export const validateGPSCoordinates = (latitude: number, longitude: number): boolean => {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

/**
 * Comprehensive profile data validation
 */
export const validateProfileData = (profileData: Partial<IUserProfile>): { 
  isValid: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];

  // Validate location if provided
  if (profileData.location) {
    const { ghanaPostGPS, gpsCoordinates } = profileData.location;
    
    if (ghanaPostGPS && !validateGhanaPostGPS(ghanaPostGPS)) {
      errors.push("Ghana Post GPS must be in format XX-0000-0000");
    }

    if (gpsCoordinates) {
      const { latitude, longitude } = gpsCoordinates;
      if (latitude !== undefined && longitude !== undefined) {
        if (!validateGPSCoordinates(latitude, longitude)) {
          errors.push("Invalid GPS coordinates");
        }
      }
    }
  }

  // Validate contact details if provided
  if (profileData.contactDetails) {
    const { primaryContact, secondaryContact } = profileData.contactDetails;
    
    if (primaryContact && !validateGhanaPhoneNumber(primaryContact)) {
      errors.push("Invalid primary contact number format");
    }

    if (secondaryContact && !validateGhanaPhoneNumber(secondaryContact)) {
      errors.push("Invalid secondary contact number format");
    }
  }

  // Validate role if provided
  if (profileData.role && !Object.values(UserRole).includes(profileData.role)) {
    errors.push(`Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}`);
  }

  // Validate bio length
  if (profileData.bio && profileData.bio.length > 500) {
    errors.push("Bio cannot exceed 500 characters");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ==================== PROFILE OPERATIONS ====================

/**
 * Creates a new profile with default values
 */
export const createDefaultProfile = async (
  userId: string | Types.ObjectId,
  role: UserRole = UserRole.CUSTOMER
): Promise<IUserProfile> => {
  const defaultProfile = await Profile.create({
    userId,
    role,
    isActive: true,
    preferences: {
      theme: "system",
      notifications: true,
      language: "en",
      privacySettings: {
        shareProfile: true,
        shareLocation: true,
        shareContactDetails: true,
        preferCloseProximity: {
          location: true,
          radius: 1000,
        },
      },
    },
  });

  return defaultProfile;
};

/**
 * Gets profile with user data in a single operation
 */
export const getProfileWithUser = async (userId: string | Types.ObjectId): Promise<{
  user: IUser | null;
  profile: IUserProfile | null;
  hasProfile: boolean;
}> => {
  const [user, profile] = await Promise.all([
    User.findById(userId) as Promise<IUser | null>,
    Profile.findOne({ userId }) as Promise<IUserProfile | null>
  ]);

  return {
    user,
    profile,
    hasProfile: !!profile
  };
};

/**
 * Updates profile with validation
 */
export const updateProfileSafely = async (
  userId: string | Types.ObjectId,
  updates: Partial<IUserProfile>
): Promise<{
  success: boolean;
  profile?: IUserProfile;
  errors?: string[];
}> => {
  // Validate the updates first
  const validation = validateProfileData(updates);
  
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  try {
    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...updates,
          lastModified: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    ) as IUserProfile;

    return {
      success: true,
      profile
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Update failed"]
    };
  }
};

// ==================== COMPLETENESS CALCULATIONS ====================

/**
 * Calculate profile completeness with detailed breakdown
 */
export const calculateProfileCompleteness = (profile: IUserProfile): {
  overall: number;
  breakdown: Record<string, { completed: boolean; weight: number }>;
} => {
  const fields = {
    bio: { completed: !!(profile.bio?.trim()), weight: 15 },
    location: { completed: !!(profile.location?.ghanaPostGPS?.trim()), weight: 25 },
    primaryContact: { completed: !!(profile.contactDetails?.primaryContact?.trim()), weight: 25 },
    idDetails: { completed: !!(profile.idDetails?.idNumber?.trim()), weight: 20 },
    socialMedia: { completed: !!(profile.socialMediaHandles?.length), weight: 10 },
    preferences: { completed: !!(profile.preferences), weight: 5 },
  };

  let totalScore = 0;
  Object.values(fields).forEach(field => {
    if (field.completed) {
      totalScore += field.weight;
    }
  });

  return {
    overall: totalScore,
    breakdown: fields
  };
};

/**
 * Get missing profile fields for completion suggestions
 */
export const getMissingProfileFields = (profile: IUserProfile): string[] => {
  const missing: string[] = [];
  
  if (!profile.bio?.trim()) missing.push("bio");
  if (!profile.location?.ghanaPostGPS?.trim()) missing.push("location");
  if (!profile.contactDetails?.primaryContact?.trim()) missing.push("primaryContact");
  if (!profile.idDetails?.idNumber?.trim()) missing.push("idDetails");
  if (!profile.socialMediaHandles?.length) missing.push("socialMedia");

  return missing;
};

// ==================== QUERY HELPERS ====================

/**
 * Find profiles by role with pagination
 */
export const findProfilesByRole = async (
  role: UserRole,
  page: number = 1,
  limit: number = 10,
  activeOnly: boolean = true
): Promise<{
  profiles: IUserProfile[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;
  const filter: any = { role };
  
  if (activeOnly) {
    filter.isActive = true;
  }

  const [profiles, total] = await Promise.all([
    Profile.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) as Promise<IUserProfile[]>,
    Profile.countDocuments(filter)
  ]);

  return {
    profiles,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Find profiles by location
 */
export const findProfilesByLocation = async (
  region?: string,
  city?: string,
  activeOnly: boolean = true
): Promise<IUserProfile[]> => {
  const filter: any = {};
  
  if (region) filter["location.region"] = new RegExp(region, 'i');
  if (city) filter["location.city"] = new RegExp(city, 'i');
  if (activeOnly) filter.isActive = true;

  return Profile.find(filter).sort({ createdAt: -1 }) as Promise<IUserProfile[]>;
};

/**
 * Search profiles with text search
 */
export const searchProfiles = async (
  searchTerm: string,
  role?: UserRole,
  activeOnly: boolean = true
): Promise<IUserProfile[]> => {
  const filter: any = {
    $or: [
      { bio: new RegExp(searchTerm, 'i') },
      { "location.region": new RegExp(searchTerm, 'i') },
      { "location.city": new RegExp(searchTerm, 'i') },
      { "location.nearbyLandmark": new RegExp(searchTerm, 'i') }
    ]
  };

  if (role) filter.role = role;
  if (activeOnly) filter.isActive = true;

  return Profile.find(filter).sort({ createdAt: -1 }) as Promise<IUserProfile[]>;
};

// ==================== ROLE & PERMISSION UTILITIES ====================

/**
 * Check if profile has specific role
 */
export const hasRole = (profile: IUserProfile | null, role: UserRole): boolean => {
  return profile?.role === role;
};

/**
 * Check if profile has admin privileges
 */
export const hasAdminPrivileges = (profile: IUserProfile | null): boolean => {
  return profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPER_ADMIN;
};

/**
 * Check if profile can access resource based on role hierarchy
 */
export const canAccessResource = (
  profile: IUserProfile | null, 
  requiredRole: UserRole
): boolean => {
  if (!profile) return false;
  
  const roleHierarchy = {
    [UserRole.CUSTOMER]: 1,
    [UserRole.PROVIDER]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.SUPER_ADMIN]: 4,
  };

  const userRoleLevel = roleHierarchy[profile.role || UserRole.CUSTOMER];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  return userRoleLevel >= requiredRoleLevel;
};

// ==================== DATA FORMATTING UTILITIES ====================

/**
 * Format profile for public display (remove sensitive data)
 */
export const formatProfileForPublic = (profile: IUserProfile): Partial<IUserProfile> => {
  const publicProfile: Partial<IUserProfile> = {
    _id: profile._id,
    userId: profile.userId,
    role: profile.role,
    bio: profile.bio,
    socialMediaHandles: profile.socialMediaHandles,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  // Include location based on privacy settings
  if (profile.preferences?.privacySettings?.shareLocation && profile.location) {
    publicProfile.location = {
      ghanaPostGPS: profile.location.ghanaPostGPS,
      region: profile.location.region,
      city: profile.location.city,
      nearbyLandmark: profile.location.nearbyLandmark,
      district: profile.location.district,
      locality: profile.location.locality,
      other: profile.location.other,
      // Optionally include GPS coordinates based on privacy settings
      ...(profile.preferences?.privacySettings?.preferCloseProximity?.location && 
          profile.location.gpsCoordinates && {
        gpsCoordinates: profile.location.gpsCoordinates
      })
    };
  }

  return publicProfile;
};

/**
 * Format location for display
 */
export const formatLocationDisplay = (location: UserLocation): string => {
  const parts: string[] = [];
  
  if (location.nearbyLandmark) parts.push(location.nearbyLandmark);
  if (location.locality) parts.push(location.locality);
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);

  return parts.join(", ");
};

// ==================== CLEANUP UTILITIES ====================

/**
 * Archive inactive profiles (soft delete)
 */
export const archiveInactiveProfiles = async (daysInactive: number = 365): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  const result = await Profile.updateMany(
    {
      lastModified: { $lt: cutoffDate },
      isActive: true
    },
    {
      $set: { isActive: false }
    }
  );

  return result.modifiedCount;
};

/**
 * Get profile statistics
 */
export const getProfileStatistics = async (): Promise<{
  total: number;
  active: number;
  byRole: Record<UserRole, number>;
  completenessAverage: number;
}> => {
  const [total, active, roleStats, profiles] = await Promise.all([
    Profile.countDocuments(),
    Profile.countDocuments({ isActive: true }),
    Profile.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]),
    Profile.find({ isActive: true }, { completeness: 1 }) as Promise<IUserProfile[]>
  ]);

  // Calculate role distribution
  const byRole = roleStats.reduce((acc, stat) => {
    acc[stat._id as UserRole] = stat.count;
    return acc;
  }, {} as Record<UserRole, number>);

  // Calculate average completeness
  const completenessSum = profiles.reduce((sum, profile) => {
    return sum + (profile.completeness || 0);
  }, 0);
  
  const completenessAverage = profiles.length > 0 ? completenessSum / profiles.length : 0;

  return {
    total,
    active,
    byRole,
    completenessAverage
  };
};

// ==================== EXPORT ALL UTILITIES ====================
export const ProfileUtils = {
  // Validation
  validateGhanaPostGPS,
  validateGhanaPhoneNumber,
  validateGPSCoordinates,
  validateProfileData,
  
  // Operations
  createDefaultProfile,
  getProfileWithUser,
  updateProfileSafely,
  
  // Completeness
  calculateProfileCompleteness,
  getMissingProfileFields,
  
  // Queries
  findProfilesByRole,
  findProfilesByLocation,
  searchProfiles,
  
  // Roles & Permissions
  hasRole,
  hasAdminPrivileges,
  canAccessResource,
  
  // Formatting
  formatProfileForPublic,
  formatLocationDisplay,
  
  // Cleanup & Stats
  archiveInactiveProfiles,
  getProfileStatistics,
};