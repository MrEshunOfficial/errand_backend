// types/user.types.ts
import { Document } from "mongoose";

export interface IUser extends Document {
  _id: string; // MongoDB ObjectId
  name: string;
  email: string;
  password?: string; // Optional for OAuth users
  lastLogin: Date;
  isVerified: boolean;
  userRole: "user" | "admin" | "super_admin";
  provider: "credentials" | "google" | "apple";
  providerId?: string; // OAuth provider user ID
  avatar?: string; // Profile picture from OAuth or uploaded
  systemAdminName?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  preferences?: IUserPreferences; // User preferences
  verificationToken?: string;
  resetPasswordToken?: string;
  verificationExpires?: Date;
  resetPasswordExpires?: Date;
  refreshToken?: string; // For OAuth token refresh
  createdAt: Date;
  updatedAt: Date;
}

// add user preferences
export interface IUserPreferences {
  theme: "light" | "dark";
  // update to add more preferences as needed
}

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

export interface AuthResponse {
  message: string;
  user?: Partial<IUser>;
  token?: string;
  requiresVerification?: boolean;
  email?: string; // ← Optional: to help frontend know which email needs verification
}

export interface GoogleAuthRequestBody {
  idToken: string; // Google ID token from frontend
}

// resend verification request type:
export interface ResendVerificationRequestBody {
  email: string;
}
export interface OAuthUserData {
  email: string;
  name: string;
  avatar?: string;
  providerId: string;
  provider: "google" | "apple" | "github" | "facebook";
}

// New interface for update requests
export interface UpdateProfileRequestBody {
  name?: string;
  phone?: string;
  avatar?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
    zipCode?: string;
  };
  preferences?: {
    theme?: "light" | "dark";
    notifications?: boolean;
    language?: string;
  };
  bio?: string;
}
