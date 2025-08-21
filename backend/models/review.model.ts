// models/review.model.ts
import { Schema, model, Types, Model } from "mongoose";
import {
  Review,
  ReviewResponse,
  ModerationHistoryItem,
  ProviderRatingStats,
  ServiceRatingStats,
  ReviewDocumentType,
} from "../types/review.types";
import { FileReference, ModerationStatus, UserRole } from "../types/base.types";

// Sub document schemas
const FileReferenceSchema = new Schema<FileReference>(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReviewResponseSchema = new Schema<ReviewResponse>(
  {
    responderId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    responderType: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    comment: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    respondedAt: { type: Date, default: Date.now },
    isOfficialResponse: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.PENDING,
    },
    helpfulVotes: { type: Number, default: 0, min: 0 },
    helpfulVoters: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const ModerationHistorySchema = new Schema<ModerationHistoryItem>(
  {
    status: {
      type: String,
      enum: Object.values(ModerationStatus),
      required: true,
    },
    moderatedBy: { type: Schema.Types.ObjectId, required: true, ref: "Admin" },
    moderatedAt: { type: Date, default: Date.now },
    reason: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 1000 },
    previousStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
    },
  },
  { _id: false }
);

// Timeline sub document schema
const TimelineSchema = new Schema(
  {
    serviceStartDate: { type: Date },
    serviceEndDate: { type: Date },
  },
  {
    _id: false,
    validate: {
      validator: function (timeline: any) {
        if (timeline?.serviceStartDate && timeline?.serviceEndDate) {
          return timeline.serviceEndDate >= timeline.serviceStartDate;
        }
        return true;
      },
      message: "Service end date must be after or equal to start date",
    },
  }
);

// Main Review Schema (Simplified)
const ReviewSchema = new Schema<Review>(
  {
    // Core Relationships (auto-populated from context)
    reviewerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    reviewerType: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    revieweeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    revieweeType: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },

    // Context (auto-populated from project/booking)
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },

    // Review Content (user input)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
      index: true,
    },
    comment: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    images: {
      type: [FileReferenceSchema],
      validate: {
        validator: (v: FileReference[]) => v.length <= 5,
        message: "Maximum 5 images allowed per review",
      },
    },
    wouldRecommend: { type: Boolean },

    // Verification & Context (system managed)
    isVerified: { type: Boolean, default: false, index: true },

    timeline: {
      type: TimelineSchema,
      default: undefined,
    },

    // Engagement Metrics
    helpfulVotes: { type: Number, default: 0, min: 0, index: true },
    helpfulVoters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    viewCount: { type: Number, default: 0, min: 0 },
    reportCount: { type: Number, default: 0, min: 0 },
    reporters: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // Moderation System
    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.PENDING,
      index: true,
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    moderatedAt: { type: Date },
    moderationReason: { type: String, maxlength: 500 },
    moderationHistory: [ModerationHistorySchema],

    // Visibility Control
    isHidden: { type: Boolean, default: false, index: true },
    hiddenReason: {
      type: String,
      enum: ["moderation", "user_request", "system"],
    },

    // Response System
    responses: [ReviewResponseSchema],

    // Quality Metrics (system calculated)
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      index: true,
    },
    isHighQuality: { type: Boolean, default: false, index: true },

    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  {
    timestamps: true,
    collection: "reviews",
  }
);

// Simplified Provider Rating Stats Schema
const ProviderRatingStatsSchema = new Schema<ProviderRatingStats>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: "User",
      index: true,
    },

    // Overall Stats
    totalReviews: { type: Number, default: 0, min: 0 },
    totalVerifiedReviews: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    weightedRating: { type: Number, default: 0, min: 0, max: 5 },

    // Time-based trends
    last30Days: {
      count: { type: Number, default: 0, min: 0 },
      average: { type: Number, default: 0, min: 0, max: 5 },
    },
    last90Days: {
      count: { type: Number, default: 0, min: 0 },
      average: { type: Number, default: 0, min: 0, max: 5 },
    },
    last365Days: {
      count: { type: Number, default: 0, min: 0 },
      average: { type: Number, default: 0, min: 0, max: 5 },
    },

    // Breakdown by reviewer type
    byReviewerType: {
      [UserRole.CUSTOMER]: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0, min: 0 },
      },
      [UserRole.PROVIDER]: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0, min: 0 },
      },
    },

    ratingDistribution: {
      1: { type: Number, default: 0, min: 0 },
      2: { type: Number, default: 0, min: 0 },
      3: { type: Number, default: 0, min: 0 },
      4: { type: Number, default: 0, min: 0 },
      5: { type: Number, default: 0, min: 0 },
    },

    // Additional metrics
    recommendationRate: { type: Number, min: 0, max: 100 },
    responseRate: { type: Number, min: 0, max: 100 },
    averageResponseTime: { type: Number, min: 0 }, // in hours

    // Quality indicators
    averageReviewLength: { type: Number, default: 0, min: 0 },
    photoAttachmentRate: { type: Number, default: 0, min: 0, max: 100 },
    verificationRate: { type: Number, default: 0, min: 0, max: 100 },

    lastCalculatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "provider_rating_stats",
  }
);

// Service Rating Stats Schema (unchanged)
const ServiceRatingStatsSchema = new Schema<ServiceRatingStats>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: "Service",
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },

    totalReviews: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },

    ratingDistribution: {
      1: { type: Number, default: 0, min: 0 },
      2: { type: Number, default: 0, min: 0 },
      3: { type: Number, default: 0, min: 0 },
      4: { type: Number, default: 0, min: 0 },
      5: { type: Number, default: 0, min: 0 },
    },

    recommendationRate: { type: Number, min: 0, max: 100 },
    lastReviewAt: { type: Date },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "service_rating_stats",
  }
);

// Simplified Indexes for optimal performance
ReviewSchema.index({ revieweeId: 1, moderationStatus: 1, isDeleted: 1 });
ReviewSchema.index({ serviceId: 1, moderationStatus: 1, isDeleted: 1 });
ReviewSchema.index({ projectId: 1 });
ReviewSchema.index({ rating: -1, createdAt: -1 });
ReviewSchema.index({ helpfulVotes: -1 });
ReviewSchema.index({ qualityScore: -1 });
ReviewSchema.index({ createdAt: -1 });
ReviewSchema.index({ "responses.responderId": 1 });

// Compound indexes for common queries
ReviewSchema.index({
  revieweeId: 1,
  moderationStatus: 1,
  isDeleted: 1,
});
ReviewSchema.index({
  serviceId: 1,
  rating: -1,
  createdAt: -1,
  isDeleted: 1,
});

// Pre-save middleware (updated quality calculation)
ReviewSchema.pre("save", function (next) {
  // Calculate quality score based on various factors
  if (
    this.isModified("comment") ||
    this.isModified("images") ||
    this.isModified("isVerified") ||
    this.isModified("wouldRecommend")
  ) {
    let score = 0;

    // Base score for having a rating
    score += 20;

    // Bonus for comment length
    if (this.comment) {
      if (this.comment.length > 100) score += 30;
      else if (this.comment.length > 50) score += 20;
      else if (this.comment.length > 0) score += 10;
    }

    // Bonus for images
    if (this.images && this.images.length > 0) {
      score += Math.min(this.images.length * 10, 30);
    }

    // Bonus for verification
    if (this.isVerified) score += 20;

    // Bonus for recommendation
    if (this.wouldRecommend === true) score += 10;

    this.qualityScore = Math.min(score, 100);
    this.isHighQuality = score >= 70;
  }

  next();
});

// Post-save middleware to update stats (unchanged)
ReviewSchema.post("save", async function (doc) {
  if (doc.moderationStatus === ModerationStatus.APPROVED && !doc.isDeleted) {
    // Trigger stats recalculation
    // This would typically be handled by a background job or queue
    console.log(
      `Review ${doc._id} approved - triggering stats update for provider ${doc.revieweeId}`
    );
  }
});

// Instance methods (unchanged)
ReviewSchema.methods.addResponse = function (
  responseData: Partial<ReviewResponse>
) {
  this.responses = this.responses || [];
  this.responses.push({
    ...responseData,
    _id: new Types.ObjectId(),
    respondedAt: new Date(),
  });
  return this.save();
};

ReviewSchema.methods.markHelpful = function (userId: Types.ObjectId) {
  if (!this.helpfulVoters.includes(userId)) {
    this.helpfulVoters.push(userId);
    this.helpfulVotes += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

ReviewSchema.methods.removeHelpful = function (userId: Types.ObjectId) {
  const index = this.helpfulVoters.indexOf(userId);
  if (index > -1) {
    this.helpfulVoters.splice(index, 1);
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

ReviewSchema.methods.reportReview = function (userId: Types.ObjectId) {
  if (!this.reporters.includes(userId)) {
    this.reporters.push(userId);
    this.reportCount += 1;

    // Auto-flag if too many reports
    if (
      this.reportCount >= 3 &&
      this.moderationStatus === ModerationStatus.APPROVED
    ) {
      this.moderationStatus = ModerationStatus.FLAGGED;
    }

    return this.save();
  }
  return Promise.resolve(this);
};

// Static methods interface
interface ReviewModelStatics {
  findByProvider(providerId: Types.ObjectId, options?: any): any;
  getAverageRating(revieweeId: Types.ObjectId): any;
  findByProjectWithRecommendations(projectId: Types.ObjectId): any;
}

// Updated static methods
ReviewSchema.statics.findByProvider = function (
  providerId: Types.ObjectId,
  options: any = {}
) {
  const query = {
    revieweeId: providerId,
    moderationStatus: ModerationStatus.APPROVED,
    isDeleted: { $ne: true },
    ...options.filters,
  };

  return this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .populate("reviewerId", "fullName profilePicture")
    .populate("serviceId", "name category");
};

ReviewSchema.statics.getAverageRating = function (revieweeId: Types.ObjectId) {
  return this.aggregate([
    {
      $match: {
        revieweeId,
        moderationStatus: ModerationStatus.APPROVED,
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        recommendationRate: {
          $avg: {
            $cond: [
              { $eq: ["$wouldRecommend", true] },
              100,
              { $cond: [{ $eq: ["$wouldRecommend", false] }, 0, null] },
            ],
          },
        },
        ratingDistribution: {
          $push: {
            $switch: {
              branches: [
                { case: { $eq: ["$rating", 1] }, then: 1 },
                { case: { $eq: ["$rating", 2] }, then: 2 },
                { case: { $eq: ["$rating", 3] }, then: 3 },
                { case: { $eq: ["$rating", 4] }, then: 4 },
                { case: { $eq: ["$rating", 5] }, then: 5 },
              ],
            },
          },
        },
      },
    },
  ]);
};

// New method to find reviews by project with recommendation data
ReviewSchema.statics.findByProjectWithRecommendations = function (
  projectId: Types.ObjectId
) {
  return this.findOne({
    projectId,
    moderationStatus: ModerationStatus.APPROVED,
    isDeleted: { $ne: true },
  })
    .populate("reviewerId", "fullName profilePicture")
    .populate("revieweeId", "fullName profilePicture")
    .populate("serviceId", "name category");
};

// Define model types
type ReviewModelType = Model<Review, {}, {}, {}, ReviewDocumentType> &
  ReviewModelStatics;
type ProviderRatingStatsModelType = Model<ProviderRatingStats>;
type ServiceRatingStatsModelType = Model<ServiceRatingStats>;

// Export models
export const ReviewModel = model<Review, ReviewModelType>(
  "Review",
  ReviewSchema
);
export const ProviderRatingStatsModel = model<
  ProviderRatingStats,
  ProviderRatingStatsModelType
>("ProviderRatingStats", ProviderRatingStatsSchema);
export const ServiceRatingStatsModel = model<
  ServiceRatingStats,
  ServiceRatingStatsModelType
>("ServiceRatingStats", ServiceRatingStatsSchema);

// Export schema for testing or extending
export { ReviewSchema, ProviderRatingStatsSchema, ServiceRatingStatsSchema };
