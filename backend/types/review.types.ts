// types/review.types.ts
import { HydratedDocument, Types } from "mongoose";
import {
  BaseEntity,
  FileReference,
  ModerationStatus,
  SoftDeletable,
  UserRole,
} from "./base.types";

export interface Review extends BaseEntity, SoftDeletable {
  // Core Relationships (auto-populated from context)
  reviewerId: Types.ObjectId;
  reviewerType: UserRole; // Auto-determined from logged-in user

  revieweeId: Types.ObjectId; // Auto-populated from project/booking context
  revieweeType: UserRole; // Auto-determined (typically PROVIDER)

  // Context (auto-populated from project/booking)
  serviceId?: Types.ObjectId; // From the project/booking
  projectId?: Types.ObjectId; // The specific project/job this review is for

  // Review Content (user input)
  rating: number; // 1-5, with validation
  comment?: string; // Max 2000 chars, optional
  images?: FileReference[]; // Max 5 images, optional
  wouldRecommend?: boolean; // Simple yes/no toggle

  // Verification & Context (system managed)
  isVerified: boolean; // System determines based on transaction history

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

  // Quality Metrics (system calculated)
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
  addResponse(
    responseData: Partial<ReviewResponse>
  ): Promise<ReviewDocumentType>;
  markHelpful(userId: Types.ObjectId): Promise<ReviewDocumentType>;
  removeHelpful(userId: Types.ObjectId): Promise<ReviewDocumentType>;
  reportReview(userId: Types.ObjectId): Promise<ReviewDocumentType>;
}

// Proper document type that combines Review with Mongoose Document and instance methods
export type ReviewDocumentType = HydratedDocument<Review> &
  ReviewInstanceMethods;

// Simplified validation schemas
export interface SimpleReviewRequest {
  // Only what the user actually fills out
  rating: number; // Required: 1-5 star rating
  comment?: string; // Optional: Review text
  wouldRecommend?: boolean; // Optional: Yes/No recommendation
  images?: File[]; // Optional: Photo upload
}

export interface CreateReviewRequest extends SimpleReviewRequest {
  // Auto-populated fields (passed from context)
  revieweeId: string; // From project/booking context
  serviceId?: string; // From project/booking context
  projectId?: string; // From project/booking context
  serviceStartDate?: Date; // From project timeline
  serviceEndDate?: Date; // From project timeline
}

export interface ReviewFilters {
  rating?: number | { $gte?: number; $lte?: number };
  isVerified?: boolean;
  wouldRecommend?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  hasImages?: boolean;
  hasComment?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  sortOrder?: "asc" | "desc";
}

export interface ModerationHistoryItem {
  status: ModerationStatus;
  moderatedBy: Types.ObjectId;
  moderatedAt: Date;
  reason?: string;
  notes?: string;
  previousStatus?: ModerationStatus;
}

// Simplified stats (removed reviewType breakdowns)
export interface ProviderRatingStats extends BaseEntity {
  providerId: Types.ObjectId;

  // Overall Stats
  totalReviews: number;
  totalVerifiedReviews: number;
  averageRating: number;
  weightedRating: number; // Bayesian average with confidence interval

  // Time-based trends
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

  // Breakdown by reviewer type
  byReviewerType: {
    [UserRole.CUSTOMER]: { average: number; count: number };
    [UserRole.PROVIDER]: { average: number; count: number };
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

// Aggregated stats for services (unchanged)
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

// Simplified review filtering and sorting
export interface ReviewQuery {
  rating?: number | { min?: number; max?: number };
  isVerified?: boolean;
  hasImages?: boolean;
  hasComment?: boolean;
  wouldRecommend?: boolean;
  sortBy?:
    | "newest"
    | "oldest"
    | "highest_rating"
    | "lowest_rating"
    | "most_helpful";
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Analytics interface for admin dashboard (simplified)
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
