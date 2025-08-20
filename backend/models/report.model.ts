// models/review.model.ts
import { Schema, model, Document, Types } from "mongoose";
import {
  Review,
  ReviewResponse,
  ModerationHistoryItem,
  ProviderRatingStats,
  ServiceRatingStats,
  ReviewType,
  ReviewContext,
  ReviewAnalytics,
} from "../types/review.types";
import {
  BaseEntity,
  FileReference,
  ModerationStatus,
  UserRole,
} from "../types/base.types";

// Subdocument schemas
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
const ReviewSchema = new Schema<Review & Document>({
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
      validator: function(this: Review & Document, v: Types.ObjectId) {
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
      validator: function(this: any) {
        if (this.serviceStartDate && this.serviceEndDate) {
          return this.serviceEndDate >= this.serviceStartDate;
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
const ProviderRatingStatsSchema = new Schema<ProviderRatingStats & Document>({
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
const ServiceRatingStatsSchema = new Schema<ServiceRatingStats & Document>({
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

// Export models
export const ReviewModel = model<Review & Document>("Review", ReviewSchema);
export const ProviderRatingStatsModel = model<ProviderRatingStats & Document>(
  "ProviderRatingStats", 
  ProviderRatingStatsSchema
);
export const ServiceRatingStatsModel = model<ServiceRatingStats & Document>(
  "ServiceRatingStats", 
  ServiceRatingStatsSchema
);

// Report Models
// =============

const InternalNoteSchema = new Schema({
  authorId: { type: Schema.Types.ObjectId, required: true, ref: "Admin" },
  content: { type: String, required: true, maxlength: 1000, trim: true },
  addedAt: { type: Date, default: Date.now },
  isPrivate: { type: Boolean, default: false },
  category: {
    type: String,
    enum: ["investigation", "resolution", "follow_up", "escalation"],
  },
}, { _id: false });

const ReportActionSchema = new Schema({
  actionType: {
    type: String,
    enum: ["warning", "suspension", "content_removal", "account_restriction", "no_action"],
    required: true,
  },
  description: { type: String, required: true, maxlength: 500, trim: true },
  executedBy: { type: Schema.Types.ObjectId, required: true, ref: "Admin" },
  executedAt: { type: Date, default: Date.now },
  duration: { type: Number, min: 0 }, // Duration in days for suspensions
  conditions: [{ type: String, maxlength: 200 }],
}, { _id: false });

// Base Report Schema (discriminated)
const BaseReportSchema = new Schema({
  reporterId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "ServiceUser",
    index: true,
  },
  reporterType: {
    type: String,
    enum: Object.values(UserRole),
    required: true,
  },

  reportType: {
    type: String,
    enum: ["user_report", "review_report", "service_report"],
    required: true,
    index: true,
  },
  reason: {
    type: String,
    enum: [
      "inappropriate_behavior",
      "poor_service_quality",
      "communication_issues",
      "payment_disputes",
      "safety_concerns",
      "fake_profile",
      "spam_content",
      "harassment",
      "discrimination",
      "other",
    ],
    required: true,
    index: true,
  },
  customReason: {
  type: String,
  maxlength: 200,
  trim: true,
  validate: {
    validator: function(this: any, v: string) {
      // Return boolean only - if reason is "other", customReason must exist and have length > 0
      return this.reason !== "other" || (v != null && v.length > 0);
    },
    message: "Custom reason is required when reason is 'other'",
    },
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true,
    minlength: 10,
  },
  evidence: {
    type: [FileReferenceSchema],
    validate: {
      validator: (v: FileReference[]) => v.length <= 10,
      message: "Maximum 10 evidence files allowed per report",
    },
  },

  // Classification
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
    index: true,
  },
  severity: {
    type: String,
    enum: ["minor", "moderate", "major", "critical"],
    default: "moderate",
    index: true,
  },
  category: { type: String, index: true }, // Auto-assigned based on ML/rules

  // Investigation
  status: {
    type: String,
    enum: ["pending", "under_investigation", "requires_more_info", "resolved", "dismissed", "escalated"],
    default: "pending",
    index: true,
  },
  investigatorId: { type: Schema.Types.ObjectId, ref: "Admin", index: true },
  assignedAt: { type: Date },

  // Resolution
  resolutionSummary: { type: String, maxlength: 1000, trim: true },
  resolutionActions: [ReportActionSchema],
  resolvedAt: { type: Date, index: true },
  resolutionType: {
    type: String,
    enum: ["no_action", "warning_issued", "account_suspended", "account_banned", "content_removed"],
  },

  // Follow-up
  followUpRequired: { type: Boolean, default: false, index: true },
  followUpDate: { type: Date },
  followUpNotes: { type: String, maxlength: 1000, trim: true },

  // Internal tracking
  internalNotes: [InternalNoteSchema],
  relatedReports: [{ type: Schema.Types.ObjectId, ref: "Report" }],
  isEscalated: { type: Boolean, default: false, index: true },
  escalatedTo: { type: Schema.Types.ObjectId, ref: "Admin" },
  escalatedAt: { type: Date },
  escalationReason: { type: String, maxlength: 500, trim: true },

  // Soft Delete
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
}, {
  timestamps: true,
  collection: "reports",
  discriminatorKey: "reportType",
});

// User Report Schema
const UserReportSchema = new Schema({
  reportedUserId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "ServiceUser",
    index: true,
  },
  reportedUserType: {
    type: String,
    enum: Object.values(UserRole),
    required: true,
  },

  // Context
  relatedServiceId: { type: Schema.Types.ObjectId, ref: "Service" },
  relatedProjectId: { type: Schema.Types.ObjectId, ref: "Project" },
  interactionContext: {
    type: String,
    enum: ["service_booking", "communication", "payment", "service_delivery", "other"],
  },

  // Behavior specifics
  behaviorType: {
    type: String,
    enum: ["communication", "reliability", "safety", "professionalism", "other"],
  },
  incidentDate: { type: Date },
  witnessIds: [{ type: Schema.Types.ObjectId, ref: "ServiceUser" }],
});

// Review Report Schema
const ReviewReportSchema = new Schema({
  reportedReviewId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Review",
    index: true,
  },

  reviewIssue: {
    type: String,
    enum: ["fake_review", "inappropriate_content", "spam", "harassment", "off_topic", "other"],
    required: true,
  },

  isCompetitorReport: { type: Boolean, default: false },
  hasConflictOfInterest: { type: Boolean, default: false },
});

// Service Report Schema
const ServiceReportSchema = new Schema({
  reportedServiceId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Service",
    index: true,
  },

  serviceIssue: {
    type: String,
    enum: ["misleading_description", "pricing_issues", "quality_concerns", "safety_violations", "other"],
    required: true,
  },

  customersAffected: { type: Number, min: 0 },
  financialImpact: { type: Number, min: 0 },
});

// Indexes for optimal performance
BaseReportSchema.index({ status: 1, priority: 1, createdAt: -1 });
BaseReportSchema.index({ investigatorId: 1, status: 1 });
BaseReportSchema.index({ reportType: 1, reason: 1 });
BaseReportSchema.index({ isEscalated: 1, escalatedAt: -1 });
BaseReportSchema.index({ followUpRequired: 1, followUpDate: 1 });
BaseReportSchema.index({ resolvedAt: -1 });

// Compound indexes for common queries
BaseReportSchema.index({ 
  reportType: 1, 
  status: 1, 
  priority: 1, 
  createdAt: -1,
  isDeleted: 1 
});

// Pre-save middleware for automatic classification
BaseReportSchema.pre('save', function(next) {
  // Auto-assign priority based on reason and severity
  if (this.isModified('reason') || this.isModified('severity')) {
    const urgentReasons = ['safety_concerns', 'harassment', 'discrimination'];
    const highSeverityReasons = ['fake_profile', 'payment_disputes'];
    
    if (urgentReasons.includes(this.reason) || this.severity === 'critical') {
      this.priority = 'urgent';
    } else if (highSeverityReasons.includes(this.reason) || this.severity === 'major') {
      this.priority = 'high';
    } else if (this.severity === 'moderate') {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
  }

  // Auto-assign category based on reason
  if (this.isModified('reason')) {
    const categoryMap: Record<string, string> = {
      'inappropriate_behavior': 'Behavioral',
      'poor_service_quality': 'Service Quality',
      'communication_issues': 'Communication',
      'payment_disputes': 'Financial',
      'safety_concerns': 'Safety',
      'fake_profile': 'Trust & Safety',
      'spam_content': 'Content Moderation',
      'harassment': 'Trust & Safety',
      'discrimination': 'Trust & Safety',
      'other': 'General',
    };
    this.category = categoryMap[this.reason] || 'General';
  }

  // Set follow-up requirements
  if (this.isModified('resolutionType')) {
    const followUpRequired = ['warning_issued', 'account_suspended', 'account_restricted'];
    this.followUpRequired = followUpRequired.includes(this.resolutionType || '');
    
    if (this.followUpRequired && this.resolutionType === 'account_suspended') {
      // Set follow-up date based on suspension duration
      const suspensionAction = this.resolutionActions?.find(a => a.actionType === 'suspension');
      if (suspensionAction?.duration) {
        this.followUpDate = new Date(Date.now() + (suspensionAction.duration * 24 * 60 * 60 * 1000));
      }
    }
  }

  next();
});

// Post-save middleware for notifications and related actions
BaseReportSchema.post('save', async function(doc) {
  // Trigger notifications based on status changes
  if (doc.isModified && doc.isModified('status')) {
    console.log(`Report ${doc._id} status changed to ${doc.status}`);
    
    // Auto-escalate if report is high priority and unassigned for too long
    if (doc.priority === 'urgent' && doc.status === 'pending' && !doc.investigatorId) {
      const hoursSinceCreated = (Date.now() - doc.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated > 2) { // 2 hours for urgent reports
        // This would trigger an auto-escalation process
        console.log(`Auto-escalating urgent report ${doc._id} after ${hoursSinceCreated} hours`);
      }
    }
  }
});

// Instance methods
BaseReportSchema.methods.assignInvestigator = function(investigatorId: Types.ObjectId) {
  this.investigatorId = investigatorId;
  this.assignedAt = new Date();
  this.status = 'under_investigation';
  return this.save();
};

BaseReportSchema.methods.addInternalNote = function(authorId: Types.ObjectId, content: string, category?: string, isPrivate?: boolean) {
  this.internalNotes = this.internalNotes || [];
  this.internalNotes.push({
    authorId,
    content,
    addedAt: new Date(),
    category: category || 'investigation',
    isPrivate: isPrivate || false,
  });
  return this.save();
};

BaseReportSchema.methods.escalate = function(escalatedTo: Types.ObjectId, reason: string) {
  this.isEscalated = true;
  this.escalatedTo = escalatedTo;
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.status = 'escalated';
  this.priority = this.priority === 'urgent' ? 'urgent' : 'high';
  return this.save();
};

BaseReportSchema.methods.resolve = function(resolutionData: {
  resolutionType: string;
  resolutionSummary: string;
  actions?: any[];
}) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolutionType = resolutionData.resolutionType as any;
  this.resolutionSummary = resolutionData.resolutionSummary;
  
  if (resolutionData.actions) {
    this.resolutionActions = resolutionData.actions;
  }
  
  return this.save();
};

BaseReportSchema.methods.linkRelatedReports = function(relatedReportIds: Types.ObjectId[]) {
  this.relatedReports = [...(this.relatedReports || []), ...relatedReportIds];
  return this.save();
};

// Static methods
BaseReportSchema.statics.getUnassignedReports = function(priority?: string) {
  const query: any = {
    investigatorId: { $exists: false },
    status: 'pending',
    isDeleted: { $ne: true },
  };
  
  if (priority) {
    query.priority = priority;
  }
  
  return this.find(query)
    .sort({ priority: 1, createdAt: 1 }) // Urgent first, then oldest
    .populate('reporterId', 'fullName profilePicture');
};

BaseReportSchema.statics.getOverdueReports = function() {
  const now = new Date();
  const urgentSLA = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // 4 hours
  const highSLA = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours
  const mediumSLA = new Date(now.getTime() - (72 * 60 * 60 * 1000)); // 72 hours
  
  return this.find({
    status: { $in: ['pending', 'under_investigation'] },
    isDeleted: { $ne: true },
    $or: [
      { priority: 'urgent', createdAt: { $lt: urgentSLA } },
      { priority: 'high', createdAt: { $lt: highSLA } },
      { priority: 'medium', createdAt: { $lt: mediumSLA } },
    ],
  }).populate('investigatorId', 'fullName');
};

BaseReportSchema.statics.getReportAnalytics = function(dateRange?: { from: Date; to: Date }) {
  const matchStage: any = { isDeleted: { $ne: true } };
  
  if (dateRange) {
    matchStage.createdAt = { $gte: dateRange.from, $lte: dateRange.to };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: {
              if: { $ne: ['$resolvedAt', null] },
              then: { $subtract: ['$resolvedAt', '$createdAt'] },
              else: null,
            },
          },
        },
        byStatus: {
          $push: {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        },
        byPriority: {
          $push: {
            $group: {
              _id: '$priority',
              count: { $sum: 1 },
            },
          },
        },
        byReportType: {
          $push: {
            $group: {
              _id: '$reportType',
              count: { $sum: 1 },
            },
          },
        },
      },
    },
  ]);
};

// Create base model and discriminators
const ReportModel = model("Report", BaseReportSchema);

// Discriminator models for specific report types
const UserReportModel = ReportModel.discriminator("user_report", UserReportSchema);
const ReviewReportModel = ReportModel.discriminator("review_report", ReviewReportSchema);
const ServiceReportModel = ReportModel.discriminator("service_report", ServiceReportSchema);

// Export all models and schemas
export { 
  ReviewSchema, 
  ProviderRatingStatsSchema, 
  ServiceRatingStatsSchema,
  BaseReportSchema,
  UserReportSchema,
  ReviewReportSchema,
  ServiceReportSchema,
};

export {
  ReportModel,
  UserReportModel,
  ReviewReportModel,
  ServiceReportModel,
};