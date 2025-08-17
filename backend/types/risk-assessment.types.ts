// types/risk-assessment.types.ts
import { Types } from "mongoose";
import { BaseEntity, RiskLevel } from "./base.types";

export interface ProviderRiskAssessment extends BaseEntity {
  providerId: Types.ObjectId;
  riskLevel: RiskLevel;

  riskFactors: {
    newProvider: boolean;
    lowCompletionRate: boolean;
    highCancellationRate: boolean;
    recentComplaints: number;
    verificationGaps: string[];
    negativeReviews: number;
  };

  mitigationMeasures: {
    requiresDeposit: boolean;
    limitedJobValue: boolean;
    maxJobValue?: number;
    requiresSupervision: boolean;
    frequentCheckins: boolean;
    clientConfirmationRequired: boolean;
  };

  assessedBy: Types.ObjectId;
  nextAssessmentDate: Date;
  notes?: string;
}
