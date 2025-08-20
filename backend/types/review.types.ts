// types/review.types.ts
import { HydratedDocument, Types } from "mongoose";
import {
  BaseEntity,
  FileReference,
  ModerationStatus,
  SoftDeletable,
  UserRole,
} from "./base.types";

export type ReviewType = "service" | "provider";
export type ReviewContext = "project_completion" | "general_experience" | "dispute_resolution";

export interface Review extends BaseEntity, SoftDeletable {
  // Core Relationships
  reviewerId: Types.ObjectId;
  reviewerType: UserRole; // Could be CUSTOMER or PROVIDER
  
  revieweeId: Types.ObjectId; // Usually provider, but could be customer in peer reviews
  revieweeType: UserRole;
  
  // Context (what's being reviewed)
  reviewType: ReviewType;
  context: ReviewContext; // Why this review was created
  serviceId?: Types.ObjectId; // Required if reviewType is "service"
  projectId?: Types.ObjectId; // The specific project/job
  
  // Review Content
  rating: number; // 1-5, with validation
  title?: string; // Max 100 chars
  comment?: string; // Max 2000 chars
  images?: FileReference[]; // Max 5 images
  
  // Verification & Context
  isVerified: boolean;
  verificationSource?: "transaction" | "system" | "admin";
  wouldRecommend?: boolean;
  
  timeline?: {
    serviceStartDate: Date;
    serviceEndDate: Date;
  };

  // Engagement Metrics
  helpfulVotes: number;
  helpfulVoters?: Types.ObjectId[];
  viewCount: number;
  reportCount: number;
  reporters?: Types.ObjectId[];

  // Moderation System
  moderationStatus: ModerationStatus;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationReason?: string;
  moderationHistory?: ModerationHistoryItem[];
  
  // Visibility Control
  isHidden: boolean;
  hiddenReason?: "moderation" | "user_request" | "system";
  
  // Response System
  responses?: ReviewResponse[];
  
  // Quality Metrics (for ranking/filtering)
  qualityScore?: number; // Calculated based on various factors
  isHighQuality: boolean; // Has detailed comment, verified, etc.
}

export interface ReviewResponse {
  _id?: Types.ObjectId;
  responderId: Types.ObjectId;
  responderType: UserRole;
  comment: string;
  respondedAt: Date;
  isOfficialResponse: boolean; // Business owner vs employee
  moderationStatus: ModerationStatus;
  
  // Response engagement
  helpfulVotes?: number;
  helpfulVoters?: Types.ObjectId[];
}

// Define the instance methods interface
interface ReviewInstanceMethods {
  addResponse(responseData: Partial<ReviewResponse>): Promise<ReviewDocumentType>;
  markHelpful(userId: Types.ObjectId): Promise<ReviewDocumentType>;
  removeHelpful(userId: Types.ObjectId): Promise<ReviewDocumentType>;
  reportReview(userId: Types.ObjectId): Promise<ReviewDocumentType>;
}

// Proper document type that combines Review with Mongoose Document and instance methods
export type ReviewDocumentType = HydratedDocument<Review> & ReviewInstanceMethods;

// Validation schemas
export interface CreateReviewRequest {
  revieweeId: string;
  revieweeType: UserRole;
  reviewType: ReviewType;
  context: ReviewContext;
  serviceId?: string;
  projectId?: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: any[];
  wouldRecommend?: boolean;
  serviceStartDate?: Date;
  serviceEndDate?: Date;
}

export interface ReviewFilters {
  rating?: number | { $gte?: number; $lte?: number };
  reviewType?: ReviewType;
  context?: ReviewContext;
  isVerified?: boolean;
  wouldRecommend?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ModerationHistoryItem {
  status: ModerationStatus;
  moderatedBy: Types.ObjectId;
  moderatedAt: Date;
  reason?: string;
  notes?: string;
  previousStatus?: ModerationStatus;
}


// Enhanced stats with more granular data
export interface ProviderRatingStats extends BaseEntity {
  providerId: Types.ObjectId;
  
  // Overall Stats
  totalReviews: number;
  totalVerifiedReviews: number;
  averageRating: number;
  weightedRating: number; // Bayesian average with confidence interval
  
  // Time-based trends (for showing improvement over time)
  last30Days: {
    count: number;
    average: number;
  };
  last90Days: {
    count: number;
    average: number;
  };
  last365Days: {
    count: number;
    average: number;
  };
  
  // Breakdown by review type
  byReviewType: {
    service: { average: number; count: number; };
    provider: { average: number; count: number; };
  };
  
  // Breakdown by reviewer type
  byReviewerType: {
    [UserRole.CUSTOMER]: { average: number; count: number; };
    [UserRole.PROVIDER]: { average: number; count: number; };
  };
  
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  
  // Additional metrics
  recommendationRate?: number;
  responseRate?: number;
  averageResponseTime?: number; // in hours
  
  // Quality indicators
  averageReviewLength: number; // Character count
  photoAttachmentRate: number; // % of reviews with photos
  verificationRate: number; // % of verified reviews
  
  lastCalculatedAt: Date;
}

// Aggregated stats for services (separate from provider stats)
export interface ServiceRatingStats extends BaseEntity {
  serviceId: Types.ObjectId;
  providerId: Types.ObjectId;
  
  totalReviews: number;
  averageRating: number;
  
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  
  recommendationRate?: number;
  lastReviewAt?: Date;
  lastCalculatedAt: Date;
}

// For review filtering and sorting
export interface ReviewQuery {
  rating?: number | { min?: number; max?: number; };
  reviewType?: ReviewType;
  context?: ReviewContext;
  isVerified?: boolean;
  hasImages?: boolean;
  sortBy?: "newest" | "oldest" | "highest_rating" | "lowest_rating" | "most_helpful";
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Analytics interface for admin dashboard
export interface ReviewAnalytics {
  totalReviews: number;
  averageRating: number;
  reviewsThisMonth: number;
  reviewsLastMonth: number;
  
  topRatedProviders: Array<{
    providerId: Types.ObjectId;
    providerName: string;
    averageRating: number;
    reviewCount: number;
  }>;
  
  flaggedReviews: number;
  pendingModeration: number;
  
  ratingTrends: Array<{
    date: Date;
    averageRating: number;
    reviewCount: number;
  }>;
}