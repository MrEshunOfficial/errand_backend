import { Types } from "mongoose";
import {
  BaseEntity,
  SoftDeletable,
  RiskLevel,
  NotificationPreferences,
  PrivacySettings,
} from "./base.types";

export interface ClientProfile extends BaseEntity, SoftDeletable {
  profileId: Types.ObjectId; // References UserProfile._id

  // Trust and Risk Management
  trustScore: number; // 0–100
  riskLevel: RiskLevel;
  riskFactors?: string[];

  // Preferences
  preferredServices: Types.ObjectId[];
  preferredProviders: Types.ObjectId[];
  preferredContactMethod?: "phone" | "email" | "in-app";

  // User-specific settings
  notificationPreferences: NotificationPreferences;
  privacySettings: PrivacySettings;

  // Ratings and Reviews
  averageRating?: number;
  totalReviews: number;

  // Special Notes (for providers/admin)
  notes?: string[];
  flags?: string[]; // Warning flags

  // Loyalty and Engagement
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  memberSince?: Date;
  lastActiveDate?: Date;

  // Moderation
  warningsCount: number;
  suspensionHistory?: {
    date: Date;
    reason: string;
    duration: number;
    resolvedAt?: Date;
  }[];
}

// Request/Response Types
export interface CreateClientProfileRequestBody {
  // Optional initial data – most fields will be system-set
  preferredServices?: string[];
  preferredProviders?: string[];
  preferredContactMethod?: "phone" | "email" | "any";
  notes?: string[];
  notificationPreferences?: Partial<NotificationPreferences>;
  privacySettings?: Partial<PrivacySettings>;
}

export interface UpdateClientProfileRequestBody {
  preferredServices?: string[];
  preferredProviders?: string[];
  preferredContactMethod?: "phone" | "email" | "any";
  notes?: string[];
  notificationPreferences?: Partial<NotificationPreferences>;
  privacySettings?: Partial<PrivacySettings>;

  // Admin-only fields (restricted in middleware)
  trustScore?: number;
  riskLevel?: RiskLevel;
  riskFactors?: string[];
  flags?: string[];
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
}

export interface ClientProfileResponse {
  message: string;
  clientProfile?: Partial<ClientProfile>;
  error?: string;
}

// For populated responses
export interface ClientProfileWithReferences
  extends Omit<
    ClientProfile,
    "profileId" | "preferredServices" | "preferredProviders"
  > {
  profileId: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    role?: string;
    bio?: string;
    location?: any;
    contactDetails?: any;
  };
  preferredServices: Array<{
    _id: Types.ObjectId;
    title: string;
    description: string;
    categoryId: Types.ObjectId;
  }>;
  preferredProviders: Array<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    businessName?: string;
    contactInfo?: any;
  }>;
}

// Query filters
export interface ClientProfileFilters {
  riskLevel?: RiskLevel;
  minTrustScore?: number;
  maxTrustScore?: number;
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  hasActiveWarnings?: boolean;
  isVerified?: boolean;
  minBookings?: number;
  minSpent?: number;
}

// Dashboard/Analytics types
export interface ClientAnalytics {
  totalClients: number;
  activeClients: number;
  riskDistribution: Record<RiskLevel, number>;
  loyaltyDistribution: Record<string, number>;
  averageTrustScore: number;
  recentlyJoined: ClientProfile[];
}

