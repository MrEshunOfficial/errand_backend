// types/warning.types.ts
import { Types } from "mongoose";
import { BaseEntity, FileReference } from "./base.types";

export interface UserWarning extends BaseEntity {
  userId: Types.ObjectId;
  issuedBy: Types.ObjectId;
  profileId: Types.ObjectId;
  
  category:
    | "policy_violation"
    | "poor_performance"
    | "safety_concern"
    | "harassment"
    | "misconduct"
    | "attendance_issue"
    | "unprofessional_behavior"
    | "data_privacy_violation"
    | "inappropriate_language"
    | "theft_or_fraud"
    | "substance_abuse"
    | "conflict_of_interest"
    | "insubordination"
    | "unauthorized_access"
    | "quality_issue"
    | "customer_complaint"
    | "provider_complaint"
    | "breach_of_confidentiality";

  severity: "minor" | "major" | "severe";
  status: "active" | "resolved" | "expired";

  reason: string;
  details: string;
  evidence?: FileReference[];

  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  notes?: string;

  issuedAt: Date;
  expiresAt?: Date;
  autoExpireAt?: Date;
  isActive: boolean;

  // Virtual properties (computed fields)
  isAcknowledged?: boolean;
  isResolved?: boolean;
  daysUntilExpiry?: number | null;
}

// Extended interface for populated warning responses
export interface PopulatedUserWarning extends UserWarning {
  user?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
    avatar?: string;
    displayName?: string;
  };
  issuer?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
  acknowledgedByUser?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
  resolvedByUser?: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
}

// Request/Response types for warning operations
export interface CreateWarningRequestBody {
  userId: string | Types.ObjectId;
  profileId: string | Types.ObjectId;
  category: UserWarning['category'];
  severity: UserWarning['severity'];
  reason: string;
  details: string;
  evidence?: FileReference[];
  expiresAt?: Date;
  notes?: string;
}

export interface UpdateWarningRequestBody {
  category?: UserWarning['category'];
  severity?: UserWarning['severity'];
  reason?: string;
  details?: string;
  evidence?: FileReference[];
  expiresAt?: Date;
  notes?: string;
}

export interface WarningResponse {
  message: string;
  warning?: UserWarning & {
    // Include virtual fields in response
    isAcknowledged: boolean;
    isResolved: boolean;
    daysUntilExpiry: number | null;
  };
  error?: string;
}

export interface WarningListResponse {
  message: string;
  warnings: (UserWarning & {
    isAcknowledged: boolean;
    isResolved: boolean;
    daysUntilExpiry: number | null;
    user?: {
      _id: Types.ObjectId;
      name: string;
      email: string;
      avatar?: string;
      displayName?: string;
    };
    issuer?: {
      _id: Types.ObjectId;
      name: string;
      email: string;
    };
  })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    active: number;
    resolved: number;
    expired: number;
    acknowledged: number;
    unacknowledged: number;
  };
}

// Bulk operation types
export interface BulkAcknowledgeRequest {
  warningIds: string[];
}

export interface BulkResolveRequest {
  warningIds: string[];
  notes?: string;
}

export interface BulkOperationResponse {
  message: string;
  processed: number;
  total: number;
  failed?: string[];
}

// Analytics types
export interface WarningAnalytics {
  overview: {
    total: number;
    active: number;
    resolved: number;
    expired: number;
    recentWarnings: number;
  };
  categoryDistribution: Record<string, number>;
  severityDistribution: Record<string, number>;
  acknowledgmentStatus: {
    acknowledged: number;
    unacknowledged: number;
  };
  topIssuers: Array<{
    _id: Types.ObjectId;
    count: number;
    name: string;
    email: string;
  }>;
  resolutionAnalysis: Array<{
    _id: string;
    avgDaysToResolve: number;
    count: number;
  }>;
}

export interface UserWarningSummary {
  userId: string;
  counts: {
    total: number;
    active: number;
    resolved: number;
    profileCount: number;
  };
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  riskLevel: string;
  recentWarnings: Array<{
    _id: Types.ObjectId;
    category: string;
    severity: string;
    reason: string;
    issuedAt: Date;
    status: string;
  }>;
}