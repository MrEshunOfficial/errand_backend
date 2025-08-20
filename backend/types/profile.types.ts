// types/profile.types.ts
import { Types } from "mongoose";
import {
  BaseEntity,
  SoftDeletable,
  UserLocation,
  ProfilePicture,
  SocialMediaHandle,
  ContactDetails,
  IdDetails,
  UserRole,
  VerificationStatus,
  ModerationStatus,
  IUserPreferences,
} from "./base.types";

// ProfileWarning interface
export interface ProfileWarning {
  _id?: Types.ObjectId;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  issuedAt: Date;
  issuedBy?: Types.ObjectId;
}

// Updated IUserProfile interface with warnings field
export interface IUserProfile extends BaseEntity, SoftDeletable {
  userId: Types.ObjectId;
  role?: UserRole;
  bio?: string;
  location?: UserLocation;
  preferences?: IUserPreferences;
  socialMediaHandles?: SocialMediaHandle[];
  lastModified?: Date;
  contactDetails?: ContactDetails;
  idDetails?: IdDetails;
  completeness?: number;
  profilePicture?: ProfilePicture;
  isActiveInMarketplace?: boolean;
  verificationStatus: VerificationStatus;
  moderationStatus: ModerationStatus;
  lastModeratedBy?: Types.ObjectId;
  lastModeratedAt?: Date;
  moderationNotes?: string;
  warningsCount: number;
  
  // Add the missing warnings field
  warnings?: ProfileWarning[];
  
  // Additional fields that might be missing from your interface but exist in the model
  verificationReason?: string;
  moderationReason?: string;
  verificationInitiatedAt?: Date;
}

export interface DomainProfile extends BaseEntity {
  userId: Types.ObjectId;
  domain: "service_marketplace" | "other_feature";
  profileId: Types.ObjectId;
  isActive: boolean;
}

export interface CreateProfileRequestBody
  extends Omit<IUserProfile, "userId" | "_id" | "createdAt" | "updatedAt"> {}

export interface ProfileResponse {
  message: string;
  user?: Partial<any>; // Reference to user if needed
  profile?: Partial<IUserProfile>;
  error?: string;
}

// Additional types for warning management
export interface AddWarningRequestBody {
  reason: string;
  severity: 'low' | 'medium' | 'high';
  issuedBy?: string;
}

export interface WarningManagementResponse {
  message: string;
  warnings?: ProfileWarning[];
  warningsCount?: number;
  userId?: string;
  error?: string;
}