// types/base.types.ts
import { Types } from "mongoose";

export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

export interface FileReference {
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface UserLocation {
  ghanaPostGPS: string;
  nearbyLandmark?: string;
  region?: string;
  city?: string;
  district?: string;
  locality?: string;
  other?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ProfilePicture {
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface SocialMediaHandle {
  nameOfSocial: string;
  userName: string;
}

export interface ContactDetails {
  primaryContact: string;
  secondaryContact?: string;
  businessEmail?: string;
}

export interface ProviderContactInfo extends ContactDetails {
  emergencyContact?: string;
  businessEmail?: string;
}

export interface IdDetails {
  idType: idType;
  idNumber: string;
  idFile: FileReference;
}

// Enums
export enum UserRole {
  CUSTOMER = "customer",
  PROVIDER = "service_provider",
}

export enum SystemRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BLOCKED = "blocked",
  INACTIVE = "inactive",
}

export enum AuthProvider {
  CREDENTIALS = "credentials",
  GOOGLE = "google",
  APPLE = "apple",
}

export enum VerificationStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under-review",
  VERIFIED = "verified",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}

export enum ModerationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  HIDDEN = "hidden",
  FLAGGED = "flagged",
}

export enum idType {
  NATIONAL_ID = "national_id",
  PASSPORT = "passport",
  VOTERS_ID = "voters_id",
  DRIVERS_LICENSE = "drivers_license",
  NHIS = "nhis",
  OTHER = "other",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ProviderOperationalStatus {
  PROBATIONARY = "probationary",
  ACTIVE = "active",
  RESTRICTED = "restricted",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

// Additional enums specific to services
export enum RequestStatus {
  DRAFT = "draft",
  PENDING = "pending",
  PROVIDER_ASSIGNED = "provider-assigned",
  ACCEPTED = "accepted",
  MATERIALS_SOURCING = "materials-sourcing",
  EN_ROUTE = "en-route",
  ON_SITE = "on-site",
  IN_PROGRESS = "in-progress",
  WORK_COMPLETED = "work-completed",
  AWAITING_CONFIRMATION = "awaiting-confirmation",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
  REFUNDED = "refunded",
}

export enum ServiceStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending-approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

// Preferences interfaces
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  // Granular notification controls
  bookingUpdates: boolean;
  promotions: boolean;
  providerMessages: boolean;
  systemAlerts: boolean;
  weeklyDigest: boolean;
}

export interface PrivacySettings {
  shareProfile: boolean;
  shareLocation: boolean;
  shareContactDetails: boolean;
  preferCloseProximity: {
    location: boolean;
    radius: number; // in kilometers
  };
  allowDirectContact: boolean;
  showOnlineStatus: boolean;
}

export interface AppPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  currency: "GHS" | "USD" | "EUR";
  distanceUnit: "km" | "miles";
  autoRefresh: boolean;
  soundEnabled: boolean;
}

export interface IUserPreferences {
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  app: AppPreferences;
  lastUpdated?: Date;
}

// Individual preference update types
export type PreferenceCategory = "notifications" | "privacy" | "app";

export interface UpdatePreferenceRequest {
  category: PreferenceCategory;
  key: string;
  value: any;
}

export interface BulkUpdatePreferenceRequest {
  category: PreferenceCategory;
  updates: Record<string, any>;
}

export interface ServiceUser extends BaseEntity, SoftDeletable {
  identityId: Types.ObjectId;
  serviceUserId: string;
  role: UserRole;

  fullName: string;
  contactInfo: ContactDetails;
  address: UserLocation;
  idVerification: IdDetails;

  profilePicture?: FileReference;
  socialMediaHandles?: SocialMediaHandle[];

  verificationStatus: VerificationStatus;
  isActiveInMarketplace: boolean;

  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };

  moderationStatus: ModerationStatus;
  lastModeratedBy?: Types.ObjectId;
  lastModeratedAt?: Date;
  moderationNotes?: string;
  warningsCount: number;
}

