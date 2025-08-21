// models/report.model.ts
import { Schema, model, Document, Types, Model } from "mongoose";
import { UserRole } from "../types/base.types";
import { FileReference } from "../types/base.types";

// Import shared schemas (these should be moved to a shared file)
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

// Report-specific interfaces
interface InternalNote {
  authorId: Types.ObjectId;
  content: string;
  addedAt: Date;
  isPrivate: boolean;
  category: "investigation" | "resolution" | "follow_up" | "escalation";
}

interface ReportAction {
  actionType:
    | "warning"
    | "suspension"
    | "content_removal"
    | "account_restriction"
    | "no_action";
  description: string;
  executedBy: Types.ObjectId;
  executedAt: Date;
  duration?: number; // Duration in days for suspensions
  conditions: string[];
}

interface BaseReport {
  reporterId: Types.ObjectId;
  reporterType: UserRole;
  reportType: "user_report" | "review_report" | "service_report";
  reason:
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
  customReason?: string;
  description: string;
  evidence: FileReference[];
  priority: "low" | "medium" | "high" | "urgent";
  severity: "minor" | "moderate" | "major" | "critical";
  category?: string;
  status:
    | "pending"
    | "under_investigation"
    | "requires_more_info"
    | "resolved"
    | "dismissed"
    | "escalated";
  investigatorId?: Types.ObjectId;
  assignedAt?: Date;
  resolutionSummary?: string;
  resolutionActions?: ReportAction[];
  resolvedAt?: Date;
  resolutionType?:
    | "no_action"
    | "warning_issued"
    | "account_suspended"
    | "account_banned"
    | "content_removed";
  followUpRequired: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  internalNotes: InternalNote[];
  relatedReports: Types.ObjectId[];
  isEscalated: boolean;
  escalatedTo?: Types.ObjectId;
  escalatedAt?: Date;
  escalationReason?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface UserReport extends BaseReport {
  reportType: "user_report";
  reportedUserId: Types.ObjectId;
  reportedUserType: UserRole;
  relatedServiceId?: Types.ObjectId;
  relatedProjectId?: Types.ObjectId;
  interactionContext?:
    | "service_booking"
    | "communication"
    | "payment"
    | "service_delivery"
    | "other";
  behaviorType?:
    | "communication"
    | "reliability"
    | "safety"
    | "professionalism"
    | "other";
  incidentDate?: Date;
  witnessIds: Types.ObjectId[];
}

interface ReviewReport extends BaseReport {
  reportType: "review_report";
  reportedReviewId: Types.ObjectId;
  reviewIssue:
    | "fake_review"
    | "inappropriate_content"
    | "spam"
    | "harassment"
    | "off_topic"
    | "other";
  isCompetitorReport: boolean;
  hasConflictOfInterest: boolean;
}

interface ServiceReport extends BaseReport {
  reportType: "service_report";
  reportedServiceId: Types.ObjectId;
  serviceIssue:
    | "misleading_description"
    | "pricing_issues"
    | "quality_concerns"
    | "safety_violations"
    | "other";
  customersAffected?: number;
  financialImpact?: number;
}

// Define instance method interfaces
interface ReportInstanceMethods {
  assignInvestigator(investigatorId: Types.ObjectId): Promise<this>;
  addInternalNote(
    authorId: Types.ObjectId,
    content: string,
    category?: "investigation" | "resolution" | "follow_up" | "escalation",
    isPrivate?: boolean
  ): Promise<this>;
  escalate(escalatedTo: Types.ObjectId, reason: string): Promise<this>;
  resolve(resolutionData: {
    resolutionType: string;
    resolutionSummary: string;
    actions?: ReportAction[];
  }): Promise<this>;
  linkRelatedReports(relatedReportIds: Types.ObjectId[]): Promise<this>;
}

// Define static method interfaces
interface ReportStaticMethods {
  getUnassignedReports(priority?: string): Promise<ReportDocument[]>;
  getOverdueReports(): Promise<ReportDocument[]>;
  getReportAnalytics(dateRange?: { from: Date; to: Date }): Promise<any[]>;
}

// Create the document interface that combines everything
interface ReportDocument extends BaseReport, Document, ReportInstanceMethods {}

// Create the model interface that includes static methods
interface ReportModel extends Model<ReportDocument>, ReportStaticMethods {}

// Internal Note Schema
const InternalNoteSchema = new Schema<InternalNote>(
  {
    authorId: { type: Schema.Types.ObjectId, required: true, ref: "Admin" },
    content: { type: String, required: true, maxlength: 1000, trim: true },
    addedAt: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ["investigation", "resolution", "follow_up", "escalation"],
    },
  },
  { _id: false }
);

// Report Action Schema
const ReportActionSchema = new Schema<ReportAction>(
  {
    actionType: {
      type: String,
      enum: [
        "warning",
        "suspension",
        "content_removal",
        "account_restriction",
        "no_action",
      ],
      required: true,
    },
    description: { type: String, required: true, maxlength: 500, trim: true },
    executedBy: { type: Schema.Types.ObjectId, required: true, ref: "Admin" },
    executedAt: { type: Date, default: Date.now },
    duration: { type: Number, min: 0 }, // Duration in days for suspensions
    conditions: [{ type: String, maxlength: 200 }],
  },
  { _id: false }
);

// Base Report Schema (discriminated)
const BaseReportSchema = new Schema<ReportDocument>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User", // Standardized to "User" instead of "ServiceUser"
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
        validator: function (this: ReportDocument, v: string) {
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
      enum: [
        "pending",
        "under_investigation",
        "requires_more_info",
        "resolved",
        "dismissed",
        "escalated",
      ],
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
      enum: [
        "no_action",
        "warning_issued",
        "account_suspended",
        "account_banned",
        "content_removed",
      ],
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
  },
  {
    timestamps: true,
    collection: "reports",
    discriminatorKey: "reportType",
  }
);

// User Report Schema - Only define additional fields for this discriminator
const UserReportSchema = new Schema({
  reportedUserId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
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
    enum: [
      "service_booking",
      "communication",
      "payment",
      "service_delivery",
      "other",
    ],
  },

  // Behavior specifics
  behaviorType: {
    type: String,
    enum: [
      "communication",
      "reliability",
      "safety",
      "professionalism",
      "other",
    ],
  },
  incidentDate: { type: Date },
  witnessIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

// Review Report Schema - Only define additional fields for this discriminator
const ReviewReportSchema = new Schema({
  reportedReviewId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Review",
    index: true,
  },

  reviewIssue: {
    type: String,
    enum: [
      "fake_review",
      "inappropriate_content",
      "spam",
      "harassment",
      "off_topic",
      "other",
    ],
    required: true,
  },

  isCompetitorReport: { type: Boolean, default: false },
  hasConflictOfInterest: { type: Boolean, default: false },
});

// Service Report Schema - Only define additional fields for this discriminator
const ServiceReportSchema = new Schema({
  reportedServiceId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "Service",
    index: true,
  },

  serviceIssue: {
    type: String,
    enum: [
      "misleading_description",
      "pricing_issues",
      "quality_concerns",
      "safety_violations",
      "other",
    ],
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
  isDeleted: 1,
});

// Pre-save middleware for automatic classification
BaseReportSchema.pre("save", function (next) {
  // Auto-assign priority based on reason and severity
  if (this.isModified("reason") || this.isModified("severity")) {
    const urgentReasons = ["safety_concerns", "harassment", "discrimination"];
    const highSeverityReasons = ["fake_profile", "payment_disputes"];

    if (urgentReasons.includes(this.reason) || this.severity === "critical") {
      this.priority = "urgent";
    } else if (
      highSeverityReasons.includes(this.reason) ||
      this.severity === "major"
    ) {
      this.priority = "high";
    } else if (this.severity === "moderate") {
      this.priority = "medium";
    } else {
      this.priority = "low";
    }
  }

  // Auto-assign category based on reason
  if (this.isModified("reason")) {
    const categoryMap: Record<string, string> = {
      inappropriate_behavior: "Behavioral",
      poor_service_quality: "Service Quality",
      communication_issues: "Communication",
      payment_disputes: "Financial",
      safety_concerns: "Safety",
      fake_profile: "Trust & Safety",
      spam_content: "Content Moderation",
      harassment: "Trust & Safety",
      discrimination: "Trust & Safety",
      other: "General",
    };
    this.category = categoryMap[this.reason] || "General";
  }

  // Set follow-up requirements
  if (this.isModified("resolutionType")) {
    const followUpRequired = [
      "warning_issued",
      "account_suspended",
      "account_restricted",
    ];
    this.followUpRequired = followUpRequired.includes(
      this.resolutionType || ""
    );

    if (this.followUpRequired && this.resolutionType === "account_suspended") {
      // Set follow-up date based on suspension duration
      const suspensionAction = this.resolutionActions?.find(
        (a) => a.actionType === "suspension"
      );
      if (suspensionAction?.duration) {
        this.followUpDate = new Date(
          Date.now() + suspensionAction.duration * 24 * 60 * 60 * 1000
        );
      }
    }
  }

  next();
});

// Post-save middleware for notifications and related actions
BaseReportSchema.post("save", async function (doc) {
  // Trigger notifications based on status changes
  if (doc.isModified && doc.isModified("status")) {
    console.log(`Report ${doc._id} status changed to ${doc.status}`);

    // Auto-escalate if report is high priority and unassigned for too long
    if (
      doc.priority === "urgent" &&
      doc.status === "pending" &&
      !doc.investigatorId
    ) {
      const hoursSinceCreated =
        (Date.now() - doc.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated > 2) {
        // 2 hours for urgent reports
        console.log(
          `Auto-escalating urgent report ${doc._id} after ${hoursSinceCreated} hours`
        );
      }
    }
  }
});

// Instance methods
BaseReportSchema.methods.assignInvestigator = function (
  investigatorId: Types.ObjectId
) {
  this.investigatorId = investigatorId;
  this.assignedAt = new Date();
  this.status = "under_investigation";
  return this.save();
};

BaseReportSchema.methods.addInternalNote = function (
  authorId: Types.ObjectId,
  content: string,
  category:
    | "investigation"
    | "resolution"
    | "follow_up"
    | "escalation" = "investigation",
  isPrivate: boolean = false
) {
  this.internalNotes = this.internalNotes || [];
  this.internalNotes.push({
    authorId,
    content,
    addedAt: new Date(),
    category,
    isPrivate,
  });
  return this.save();
};

BaseReportSchema.methods.escalate = function (
  escalatedTo: Types.ObjectId,
  reason: string
) {
  this.isEscalated = true;
  this.escalatedTo = escalatedTo;
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.status = "escalated";
  this.priority = this.priority === "urgent" ? "urgent" : "high";
  return this.save();
};

BaseReportSchema.methods.resolve = function (resolutionData: {
  resolutionType: string;
  resolutionSummary: string;
  actions?: ReportAction[];
}) {
  this.status = "resolved";
  this.resolvedAt = new Date();
  this.resolutionType = resolutionData.resolutionType as any;
  this.resolutionSummary = resolutionData.resolutionSummary;

  if (resolutionData.actions) {
    this.resolutionActions = resolutionData.actions;
  }

  return this.save();
};

BaseReportSchema.methods.linkRelatedReports = function (
  relatedReportIds: Types.ObjectId[]
) {
  this.relatedReports = [...(this.relatedReports || []), ...relatedReportIds];
  return this.save();
};

// Static methods
BaseReportSchema.statics.getUnassignedReports = function (priority?: string) {
  const query: any = {
    investigatorId: { $exists: false },
    status: "pending",
    isDeleted: { $ne: true },
  };

  if (priority) {
    query.priority = priority;
  }

  return this.find(query)
    .sort({ priority: 1, createdAt: 1 }) // Urgent first, then oldest
    .populate("reporterId", "fullName profilePicture");
};

BaseReportSchema.statics.getOverdueReports = function () {
  const now = new Date();
  const urgentSLA = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours
  const highSLA = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
  const mediumSLA = new Date(now.getTime() - 72 * 60 * 60 * 1000); // 72 hours

  return this.find({
    status: { $in: ["pending", "under_investigation"] },
    isDeleted: { $ne: true },
    $or: [
      { priority: "urgent", createdAt: { $lt: urgentSLA } },
      { priority: "high", createdAt: { $lt: highSLA } },
      { priority: "medium", createdAt: { $lt: mediumSLA } },
    ],
  }).populate("investigatorId", "fullName");
};

BaseReportSchema.statics.getReportAnalytics = function (dateRange?: {
  from: Date;
  to: Date;
}) {
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
              if: { $ne: ["$resolvedAt", null] },
              then: { $subtract: ["$resolvedAt", "$createdAt"] },
              else: null,
            },
          },
        },
        byStatus: {
          $push: {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        },
        byPriority: {
          $push: {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
            },
          },
        },
        byReportType: {
          $push: {
            $group: {
              _id: "$reportType",
              count: { $sum: 1 },
            },
          },
        },
      },
    },
  ]);
};

// Create base model with proper typing
const ReportModel = model<ReportDocument, ReportModel>(
  "Report",
  BaseReportSchema
);

// Discriminator models for specific report types
const UserReportModel = ReportModel.discriminator(
  "user_report",
  UserReportSchema
);
const ReviewReportModel = ReportModel.discriminator(
  "review_report",
  ReviewReportSchema
);
const ServiceReportModel = ReportModel.discriminator(
  "service_report",
  ServiceReportSchema
);

// Export all models and schemas
export {
  BaseReportSchema,
  UserReportSchema,
  ReviewReportSchema,
  ServiceReportSchema,
};

export { ReportModel, UserReportModel, ReviewReportModel, ServiceReportModel };

// Export types for use in other files
export type {
  BaseReport,
  UserReport,
  ReviewReport,
  ServiceReport,
  InternalNote,
  ReportAction,
  ReportDocument,
  ReportModel as ReportModelType,
};
