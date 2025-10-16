// types/provider-profile.types.ts
import { Types } from "mongoose";
import { BaseEntity, SoftDeletable, ProviderOperationalStatus, RiskLevel } from "./base.types";


export interface ProviderProfile extends BaseEntity, SoftDeletable {
  profileId: Types.ObjectId;
  providerContactInfo: {
    businessContact?: string;
    businessEmail?: string;
  };

  operationalStatus: ProviderOperationalStatus;
  serviceOfferings: Types.ObjectId[];
  workingHours?: Record<
    string,
    {
      start: string;
      end: string;
    }
  >;

  isCurrentlyAvailable: boolean;
  isAlwaysAvailable: boolean;
  businessName?: string;
  requireInitialDeposit: boolean;
  percentageDeposit?: number;
  performanceMetrics: {
    completionRate: number;
    averageRating: number;
    totalJobs: number;
    responseTimeMinutes: number;
    averageResponseTime: number;
    cancellationRate: number;
    disputeRate: number;
    clientRetentionRate: number;
  };

  riskLevel: RiskLevel;
  lastRiskAssessmentDate?: Date;
  riskAssessedBy?: Types.ObjectId;
  penaltiesCount: number;
  lastPenaltyDate?: Date;
}

// Request/Response types for provider profile operations
export interface CreateProviderProfileRequestBody
  extends Omit<ProviderProfile, "_id" | "createdAt" | "updatedAt"> {}

export interface UpdateProviderProfileRequestBody
  extends Partial<
    Omit<ProviderProfile, "_id" | "createdAt" | "updatedAt" | "profileId">
  > {}

export interface ProviderProfileResponse {
  message: string;
  providerProfile?: Partial<ProviderProfile>;
  error?: string;
}
