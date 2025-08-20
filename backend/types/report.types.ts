// types/report.types.ts
import { Types } from "mongoose";
import {
  BaseEntity,
  FileReference,
  SoftDeletable,
  UserRole,
} from "./base.types";

export type ReportType = "user_report" | "review_report" | "service_report";
export type ReportReason = 
  | "inappropriate_behavior"
  | "poor_service_quality"
  | "communication_issues"
  | "payment_disputes"
  | "safety_concerns"
  | "fake_profile"
  | "spam_content"
  | "harassment"
  | "discrimination"
  | "other";

export type ReportStatus = 
  | "pending" 
  | "under_investigation" 
  | "requires_more_info"
  | "resolved" 
  | "dismissed"
  | "escalated";

export type ReportPriority = "low" | "medium" | "high" | "urgent";
export type ReportSeverity = "minor" | "moderate" | "major" | "critical";

// Base interface for all report types
export interface BaseReport extends BaseEntity, SoftDeletable {
  reporterId: Types.ObjectId;
  reporterType: UserRole;
  
  reportType: ReportType;
  reason: ReportReason;
  customReason?: string; // When reason is "other"
  description: string; // Max 2000 chars
  evidence?: FileReference[]; // Screenshots, documents, etc.
  
  // Classification
  priority: ReportPriority;
  severity: ReportSeverity;
  category: string; // Auto-assigned based on reason + ML
  
  // Investigation
  status: ReportStatus;
  investigatorId?: Types.ObjectId; // Admin handling the case
  assignedAt?: Date;
  
  // Resolution
  resolutionSummary?: string;
  resolutionActions?: ReportAction[];
  resolvedAt?: Date;
  resolutionType?: "no_action" | "warning_issued" | "account_suspended" | "account_banned" | "content_removed";
  
  // Follow-up
  followUpRequired: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  
  // Internal tracking
  internalNotes?: InternalNote[];
  relatedReports?: Types.ObjectId[]; // Similar reports about same user/service
  isEscalated: boolean;
  escalatedTo?: Types.ObjectId; // Senior admin
  escalatedAt?: Date;
  escalationReason?: string;
}

// Specific report types
export interface UserReport extends BaseReport {
  reportType: "user_report";
  reportedUserId: Types.ObjectId;
  reportedUserType: UserRole;
  
  // Context about where the issue occurred
  relatedServiceId?: Types.ObjectId;
  relatedProjectId?: Types.ObjectId;
  interactionContext?: "service_booking" | "communication" | "payment" | "service_delivery" | "other";
  
  // Specific to user behavior
  behaviorType?: "communication" | "reliability" | "safety" | "professionalism" | "other";
  incidentDate?: Date;
  witnessIds?: Types.ObjectId[]; // Other users who can corroborate
}

export interface ReviewReport extends BaseReport {
  reportType: "review_report";
  reportedReviewId: Types.ObjectId;
  
  // Why this review is being reported
  reviewIssue: "fake_review" | "inappropriate_content" | "spam" | "harassment" | "off_topic" | "other";
  
  // Additional context
  isCompetitorReport: boolean; // Flagged if reporter might be competitor
  hasConflictOfInterest: boolean;
}

export interface ServiceReport extends BaseReport {
  reportType: "service_report";
  reportedServiceId: Types.ObjectId;
  
  // Service-specific issues
  serviceIssue: "misleading_description" | "pricing_issues" | "quality_concerns" | "safety_violations" | "other";
  
  // Impact assessment
  customersAffected?: number;
  financialImpact?: number; // If applicable
}

// Supporting interfaces
export interface ReportAction {
  actionType: "warning" | "suspension" | "content_removal" | "account_restriction" | "no_action";
  description: string;
  executedBy: Types.ObjectId;
  executedAt: Date;
  duration?: number; // For suspensions (in days)
  conditions?: string[]; // Conditions for lifting restrictions
}

export interface InternalNote {
  authorId: Types.ObjectId;
  content: string;
  addedAt: Date;
  isPrivate: boolean; // Visible only to investigators
  category?: "investigation" | "resolution" | "follow_up" | "escalation";
}

// For batch operations and reporting
export interface ReportSummary {
  reportId: Types.ObjectId;
  reportType: ReportType;
  status: ReportStatus;
  priority: ReportPriority;
  severity: ReportSeverity;
  reportedEntityId: Types.ObjectId; // User, Review, or Service ID
  reportedEntityType: "user" | "review" | "service";
  createdAt: Date;
  daysSinceReported: number;
  investigatorId?: Types.ObjectId;
}

// Analytics for admin dashboard
export interface ReportAnalytics {
  // Volume metrics
  totalActiveReports: number;
  newReportsToday: number;
  newReportsThisWeek: number;
  
  // Processing metrics
  averageResolutionTime: number; // in hours
  pendingReports: number;
  overDueReports: number; // Past SLA
  
  // By category
  byReportType: Record<ReportType, number>;
  byStatus: Record<ReportStatus, number>;
  byPriority: Record<ReportPriority, number>;
  bySeverity: Record<ReportSeverity, number>;
  
  // Top issues
  topReasons: Array<{
    reason: ReportReason;
    count: number;
    trend: "up" | "down" | "stable";
  }>;
  
  // Investigator workload
  investigatorWorkload: Array<{
    investigatorId: Types.ObjectId;
    investigatorName: string;
    activeReports: number;
    averageResolutionTime: number;
    resolutionRate: number;
  }>;
  
  // Trends
  weeklyTrends: Array<{
    week: string;
    newReports: number;
    resolvedReports: number;
  }>;
}

// For filtering and querying reports
export interface ReportQuery {
  status?: ReportStatus | ReportStatus[];
  priority?: ReportPriority | ReportPriority[];
  severity?: ReportSeverity | ReportSeverity[];
  reportType?: ReportType | ReportType[];
  reason?: ReportReason | ReportReason[];
  investigatorId?: Types.ObjectId;
  dateRange?: {
    from: Date;
    to: Date;
  };
  isEscalated?: boolean;
  isOverdue?: boolean;
  sortBy?: "newest" | "oldest" | "priority" | "severity" | "days_open";
}