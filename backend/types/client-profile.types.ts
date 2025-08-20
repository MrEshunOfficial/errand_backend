// types/client-profile.types.ts
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
  trustScore: number; // 0-100
  riskLevel: RiskLevel;
  riskFactors?: string[];

  // Preferences
  preferredServices: Types.ObjectId[];
  preferredProviders: Types.ObjectId[];

  // Service History and Behavior
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  disputedBookings: number;

  // Financial
  totalSpent: number;
  averageOrderValue: number;
  paymentMethods?: string[];

  // Ratings and Reviews
  averageRating?: number;
  totalReviews: number;

  // Behavioral Patterns
  bookingPatterns?: {
    preferredTimeSlots?: string[];
    seasonality?: string[];
    repeatCustomer: boolean;
  };

  // Communication
  communicationStyle?: "formal" | "casual" | "direct";
  preferredContactMethod?: "phone" | "email" | "in-app";
  responseTime?: number; // Average response time in minutes

  // Special Notes (for providers/admin)
  notes?: string[];
  flags?: string[]; // Warning flags

  // Loyalty and Engagement
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  memberSince?: Date;
  lastActiveDate?: Date;

  // Verification Status
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isAddressVerified: boolean;

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
  // Optional initial data - most fields will be calculated/set by system
  preferredServices?: string[];
  preferredProviders?: string[];
  communicationStyle?: "formal" | "casual" | "direct";
  preferredContactMethod?: "phone" | "email" | "in-app";
  notes?: string[];
}

export interface UpdateClientProfileRequestBody {
  preferredServices?: string[];
  preferredProviders?: string[];
  communicationStyle?: "formal" | "casual" | "direct";
  preferredContactMethod?: "phone" | "email" | "in-app";
  notes?: string[];
  // Admin-only fields (should be restricted in middleware)
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
  topSpenders: ClientProfile[];
  recentlyJoined: ClientProfile[];
}
