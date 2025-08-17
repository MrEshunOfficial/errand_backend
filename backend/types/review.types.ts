// types/review.types.ts
import { Types } from "mongoose";
import {
  BaseEntity,
  FileReference,
  ModerationStatus,
  SoftDeletable,
} from "./base.types";

export interface Review extends BaseEntity, SoftDeletable {
  requestId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  revieweeId: Types.ObjectId;
  serviceId: Types.ObjectId;

  rating: number;
  title?: string;
  comment?: string;
  images?: FileReference[];

  isVerifiedPurchase: boolean;
  helpfulVotes: number;
  reportCount: number;

  moderationStatus: ModerationStatus;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationReason?: string;
  isHidden: boolean;

  response?: {
    comment: string;
    respondedAt: Date;
    respondedBy: Types.ObjectId;
  };
}

export interface UserRatingStats extends BaseEntity {
  userId: Types.ObjectId;
  userType: "customer" | "service_provider";
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  lastUpdatedAt: Date;
}
