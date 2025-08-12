// types/user.types.ts
import { Types } from "mongoose";

export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLocation {
  ghanaPostGPS: string; // Ghana Post GPS digital address (e.g., "GZ-0123-4567")
  nearbyLandmark?: string;
  region?: string;
  city?: string;
  district?: string;
  locality?: string;
  other?: string;
  // add latitude and longitude
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export enum UserRole {
  CUSTOMER = "customer",
  PROVIDER = "service_provider",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum idType {
  NATIONAL_ID = "national_id",
  PASSPORT = "passport",
  VOTERS_ID = "voters_id",
  DRIVERS_LICENSE = "drivers_license",
  OTHER = "other",
}

export interface ProfilePicture {
  url: string;
  fileName: string;
}

export interface SocialMediaHandle {
  nameOfSocial: string;
  userName: string;
}

export interface IUserPreferences {
  theme?: "light" | "dark" | "system";
  notifications?: boolean;
  language?: string;
  privacySettings?: {
    shareProfile?: boolean;
    shareLocation?: boolean;
    shareContactDetails?: boolean;
    preferCloseProximity?: {
      location?: boolean;
      radius?: number;
    };
  };
}

export interface ContactDetails {
  primaryContact: string;
  secondaryContact?: string;
}

export interface IdDetails {
  idType: idType;
  idNumber: string;
  idFile: {
    url: string;
    fileName: string;
  };
}

// Profile interface
export interface IUserProfile extends BaseEntity {
  userId: Types.ObjectId; // Reference to user
  role?: UserRole;
  bio?: string;
  location?: UserLocation;
  preferences?: IUserPreferences;
  socialMediaHandles?: SocialMediaHandle[];
  lastModified?: Date; // Cache invalidation
  contactDetails?: ContactDetails;
  idDetails?: IdDetails;
  isActive: boolean;
  completeness?: number; // Virtual field calculated by Mongoose
}

// Main user interface
export interface IUser extends BaseEntity {
  name: string;
  email: string;
  password?: string;
  lastLogin: Date;
  isVerified: boolean;
  userRole: "user" | "admin" | "super_admin";
  provider: "credentials" | "google" | "apple";
  providerId?: string;
  avatar?: ProfilePicture | string; // URL or ProfilePicture object
  systemAdminName?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  verificationExpires?: Date;
  resetPasswordExpires?: Date;
  refreshToken?: string;
  profileId?: Types.ObjectId; // Reference to user profile
}

// OAuth-related interfaces
export interface GoogleAuthRequestBody {
  idToken: string; // Google ID token from frontend
}

export interface AppleAuthRequestBody {
  idToken: string; // Apple ID token from frontend
  user?: {
    name?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface OAuthUserData {
  email: string;
  name: string;
  avatar?: string;
  providerId: string;
  provider: "google" | "apple" | "github" | "facebook";
}

// Authentication request interfaces
export interface SignupRequestBody {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface ResetPasswordRequestBody {
  email: string;
}

export interface VerifyEmailRequestBody {
  token: string;
}

export interface UpdatePasswordRequestBody {
  token: string;
  password: string;
}

export interface ResendVerificationRequestBody {
  email: string;
}

// Profile update request interfaces
export interface UpdateProfileRequestBody {
  name?: string;
  avatar?: string | ProfilePicture;
  profile?: Partial<IUserProfile>;
}

export interface UpdateProfilePreferencesRequestBody extends IUserPreferences {}

export interface CreateProfileRequestBody
  extends Omit<IUserProfile, "userId" | "_id" | "createdAt" | "updatedAt"> {}

// Response interfaces
export interface AuthResponse {
  message: string;
  user?: Partial<IUser>;
  token?: string;
  requiresVerification?: boolean;
  email?: string;
  error?: string;
}

export interface ProfileResponse {
  message: string;
  user?: Partial<IUser>;
  profile?: Partial<IUserProfile>;
  error?: string;
}

// Provider linking interface
export interface LinkProviderRequestBody {
  provider: "google" | "apple";
  idToken: string;
}

// Extended request interface for authenticated routes
export interface AuthenticatedRequest extends Request {
  userId?: string;
}
