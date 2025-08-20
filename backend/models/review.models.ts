// models/review.model.ts
import { Schema, model, Document, Types, Model } from "mongoose";
import {
  Review,
  ReviewResponse,
  ModerationHistoryItem,
  ProviderRatingStats,
  ServiceRatingStats,
  ReviewType,
  ReviewContext,
  ReviewDocumentType,
} from "../types/review.types";
import {
  FileReference,
  ModerationStatus,
  UserRole,
} from "../types/base.types";

// Sub document schemas
const FileReferenceSchema = new Schema<FileReference>({
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const ReviewResponseSchema = new Schema<ReviewResponse>({
  responderId: { type: Schema.Types.ObjectId, required: true, ref: "ServiceUser" },
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
  helpfulVoters: [{ type: Schema.Types.ObjectId, ref: "ServiceUser" }],
}, { timestamps: true });

const ModerationHistorySchema = new Schema<ModerationHistoryItem>({
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
}, { _id: false });

// Main Review Schema
const ReviewSchema = new Schema<Review>({
  // Core Relationships
  reviewerId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "ServiceUser",
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
    ref: "ServiceUser",
    index: true,
  },
  revieweeType: {
    type: String,
    enum: Object.values(UserRole),
    required: true,
  },

  // Context
  reviewType: {
    type: String,
    enum: ["service", "provider"] as ReviewType[],
    required: true,
    index: true,
  },
  context: {
    type: String,
    enum: ["project_completion", "general_experience", "dispute_resolution"] as ReviewContext[],
    required: true,
  },
  serviceId: {
    type: Schema.Types.ObjectId,
    ref: "Service",
    index: true,
    validate: {
      validator: function(this: Review, v: Types.ObjectId) {
        return this.reviewType !== "service" || v != null;
      },
      message: "serviceId is required when reviewType is 'service'",
    },
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: "Project",
    index: true,
  },

  // Review Content
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
  title: {
    type: String,
    maxlength: 100,
    trim: true,
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

  // Verification & Context
  isVerified: { type: Boolean, default: false, index: true },
  verificationSource: {
    type: String,
    enum: ["transaction", "system", "admin"],
  },
  wouldRecommend: { type: Boolean },

  timeline: {
    serviceStartDate: { type: Date },
    serviceEndDate: { type: Date },
    validate: {
      validator: function(this: Review) {
        if (this.timeline?.serviceStartDate && this.timeline?.serviceEndDate) {
          return this.timeline.serviceEndDate >= this.timeline.serviceStartDate;
        }
        return true;
      },
      message: "Service end date must be after or equal to start date",
    },
  },

  // Engagement Metrics
  helpfulVotes: { type: Number, default: 0, min: 0, index: true },
  helpfulVoters: [{ type: Schema.Types.ObjectId, ref: "ServiceUser" }],
  viewCount: { type: Number, default: 0, min: 0 },
  reportCount: { type: Number, default: 0, min: 0 },
  reporters: [{ type: Schema.Types.ObjectId, ref: "ServiceUser" }],

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

  // Quality Metrics
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
}, {
  timestamps: true,
  collection: "reviews",
});

// Provider Rating Stats Schema
const ProviderRatingStatsSchema = new Schema<ProviderRatingStats>({
  providerId: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: "ServiceUser",
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

  // Breakdown by review type
  byReviewType: {
    service: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    provider: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
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
}, {
  timestamps: true,
  collection: "provider_rating_stats",
});

// Service Rating Stats Schema
const ServiceRatingStatsSchema = new Schema<ServiceRatingStats>({
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
    ref: "ServiceUser",
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
}, {
  timestamps: true,
  collection: "service_rating_stats",
});

// Indexes for optimal performance
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
  reviewType: 1, 
  moderationStatus: 1, 
  isDeleted: 1 
});
ReviewSchema.index({ 
  serviceId: 1, 
  rating: -1, 
  createdAt: -1,
  isDeleted: 1 
});

// Pre-save middleware
ReviewSchema.pre('save', function(next) {
  // Calculate quality score based on various factors
  if (this.isModified('comment') || this.isModified('images') || this.isModified('isVerified')) {
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
    
    this.qualityScore = Math.min(score, 100);
    this.isHighQuality = score >= 70;
  }
  
  next();
});

// Post-save middleware to update stats
ReviewSchema.post('save', async function(doc) {
  if (doc.moderationStatus === ModerationStatus.APPROVED && !doc.isDeleted) {
    // Trigger stats recalculation
    // This would typically be handled by a background job or queue
    console.log(`Review ${doc._id} approved - triggering stats update for provider ${doc.revieweeId}`);
  }
});

// Instance methods
ReviewSchema.methods.addResponse = function(responseData: Partial<ReviewResponse>) {
  this.responses = this.responses || [];
  this.responses.push({
    ...responseData,
    _id: new Types.ObjectId(),
    respondedAt: new Date(),
  });
  return this.save();
};

ReviewSchema.methods.markHelpful = function(userId: Types.ObjectId) {
  if (!this.helpfulVoters.includes(userId)) {
    this.helpfulVoters.push(userId);
    this.helpfulVotes += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

ReviewSchema.methods.removeHelpful = function(userId: Types.ObjectId) {
  const index = this.helpfulVoters.indexOf(userId);
  if (index > -1) {
    this.helpfulVoters.splice(index, 1);
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
    return this.save();
  }
  return Promise.resolve(this);
};

ReviewSchema.methods.reportReview = function(userId: Types.ObjectId) {
  if (!this.reporters.includes(userId)) {
    this.reporters.push(userId);
    this.reportCount += 1;
    
    // Auto-flag if too many reports
    if (this.reportCount >= 3 && this.moderationStatus === ModerationStatus.APPROVED) {
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
}

// Static methods
ReviewSchema.statics.findByProvider = function(providerId: Types.ObjectId, options: any = {}) {
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
    .populate('reviewerId', 'fullName profilePicture')
    .populate('serviceId', 'name category');
};

ReviewSchema.statics.getAverageRating = function(revieweeId: Types.ObjectId) {
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

// Define model types
type ReviewModelType = Model<Review, {}, {}, {}, ReviewDocumentType> & ReviewModelStatics;
type ProviderRatingStatsModelType = Model<ProviderRatingStats>;
type ServiceRatingStatsModelType = Model<ServiceRatingStats>;

// Export models
export const ReviewModel = model<Review, ReviewModelType>("Review", ReviewSchema);
export const ProviderRatingStatsModel = model<ProviderRatingStats, ProviderRatingStatsModelType>(
  "ProviderRatingStats", 
  ProviderRatingStatsSchema
);
export const ServiceRatingStatsModel = model<ServiceRatingStats, ServiceRatingStatsModelType>(
  "ServiceRatingStats", 
  ServiceRatingStatsSchema
);

// Export schema for testing or extending
export { ReviewSchema, ProviderRatingStatsSchema, ServiceRatingStatsSchema };