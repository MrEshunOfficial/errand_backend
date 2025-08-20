// models/warning.model.ts
import mongoose, { Schema, Document, Model } from "mongoose";
import { FileReference, RiskLevel } from "../types/base.types";
import { UserWarning } from "../types/warning.types";

// Extend the UserWarning interface for mongoose methods
interface IUserWarningDocument extends Omit<UserWarning, "_id">, Document {
  acknowledge(acknowledgedBy: string): Promise<this>;
  resolve(resolvedBy: string, notes?: string): Promise<this>;
  activate(): Promise<this>;
  deactivate(): Promise<this>;
  isExpired(): boolean;
  getRiskLevel(): RiskLevel;
  
  // Virtual properties
  readonly isAcknowledged: boolean;
  readonly isResolved: boolean;
  readonly daysUntilExpiry: number | null;
}

// Interface for static methods
interface IWarningModel extends Model<IUserWarningDocument> {
  getActiveWarningsForUser(userId: string): Promise<IUserWarningDocument[]>;
  getWarningsByCategory(category: string): Promise<IUserWarningDocument[]>;
  getExpiredWarnings(): Promise<IUserWarningDocument[]>;
  expireOldWarnings(): Promise<{ modifiedCount: number }>;
}

// File Reference Schema (reused from profile model)
const fileReferenceSchema = new Schema<FileReference>(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Warning Categories Enum
export const WarningCategory = {
  POLICY_VIOLATION: "policy_violation",
  POOR_PERFORMANCE: "poor_performance",
  SAFETY_CONCERN: "safety_concern",
  HARASSMENT: "harassment",
  MISCONDUCT: "misconduct",
  ATTENDANCE_ISSUE: "attendance_issue",
  UNPROFESSIONAL_BEHAVIOR: "unprofessional_behavior",
  DATA_PRIVACY_VIOLATION: "data_privacy_violation",
  INAPPROPRIATE_LANGUAGE: "inappropriate_language",
  THEFT_OR_FRAUD: "theft_or_fraud",
  SUBSTANCE_ABUSE: "substance_abuse",
  CONFLICT_OF_INTEREST: "conflict_of_interest",
  INSUBORDINATION: "insubordination",
  UNAUTHORIZED_ACCESS: "unauthorized_access",
  QUALITY_ISSUE: "quality_issue",
  CUSTOMER_COMPLAINT: "customer_complaint",
  PROVIDER_COMPLAINT: "provider_complaint",
  BREACH_OF_CONFIDENTIALITY: "breach_of_confidentiality",
} as const;

// Severity levels
export const SeverityLevel = {
  MINOR: "minor",
  MAJOR: "major",
  SEVERE: "severe",
} as const;


export const WarningStatus = {
  ACTIVE: "active",
  RESOLVED: "resolved",
  EXPIRED: "expired",
} as const;

export type WarningStatusType = typeof WarningStatus[keyof typeof WarningStatus];

// Main Warning Schema
const warningSchema = new Schema<IUserWarningDocument, IWarningModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: [true, "Profile ID is required"],
      index: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Issuer ID is required"],
    },
    category: {
      type: String,
      enum: {
        values: Object.values(WarningCategory),
        message: "Invalid warning category",
      },
      required: [true, "Warning category is required"],
      index: true,
    },
    severity: {
      type: String,
      enum: {
        values: Object.values(SeverityLevel),
        message: "Invalid severity level",
      },
      required: [true, "Severity level is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(WarningStatus),
        message: "Invalid warning status",
      },
      default: WarningStatus.ACTIVE,
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Warning reason is required"],
      trim: true,
      maxlength: [200, "Reason cannot exceed 200 characters"],
    },
    details: {
      type: String,
      required: [true, "Warning details are required"],
      trim: true,
      maxlength: [1000, "Details cannot exceed 1000 characters"],
    },
    evidence: {
      type: [fileReferenceSchema],
      default: [],
      validate: {
        validator: function (evidence: FileReference[]) {
          return evidence.length <= 10; // Maximum 10 evidence files
        },
        message: "Cannot attach more than 10 evidence files",
      },
    },
    // Acknowledgment fields
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgedAt: {
      type: Date,
    },
    // Resolution fields
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    // Timing fields
    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      validate: {
        validator: function (this: IUserWarningDocument, expiresAt: Date) {
          return !expiresAt || expiresAt > this.issuedAt;
        },
        message: "Expiry date must be after issue date",
      },
    },
    autoExpireAt: {
      type: Date,
      validate: {
        validator: function (this: IUserWarningDocument, autoExpireAt: Date) {
          return !autoExpireAt || autoExpireAt > this.issuedAt;
        },
        message: "Auto-expire date must be after issue date",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
warningSchema.index({ userId: 1, isActive: 1 });
warningSchema.index({ profileId: 1, status: 1 });
warningSchema.index({ category: 1, severity: 1 });
warningSchema.index({ issuedBy: 1, issuedAt: -1 });
warningSchema.index({ status: 1, expiresAt: 1 });
warningSchema.index({ isActive: 1, autoExpireAt: 1 });

// Compound indexes for common queries
warningSchema.index({ userId: 1, status: 1, isActive: 1 });
warningSchema.index({ profileId: 1, category: 1, isActive: 1 });
warningSchema.index({ severity: 1, isActive: 1, issuedAt: -1 });

// Virtual for checking if warning is acknowledged
warningSchema.virtual("isAcknowledged").get(function (this: IUserWarningDocument) {
  return !!(this.acknowledgedBy && this.acknowledgedAt);
});

// Virtual for checking if warning is resolved
warningSchema.virtual("isResolved").get(function (this: IUserWarningDocument) {
  return this.status === WarningStatus.RESOLVED;
});

// Virtual for days until expiry
warningSchema.virtual("daysUntilExpiry").get(function (this: IUserWarningDocument) {
  if (!this.expiresAt) return null;
  const now = new Date();
  const diffTime = this.expiresAt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
warningSchema.pre("save", function (next) {
  // Auto-set expiry based on severity if not set
  if (!this.expiresAt && this.isNew) {
    const now = new Date();
    switch (this.severity) {
      case SeverityLevel.MINOR:
        this.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
        break;
      case SeverityLevel.MAJOR:
        this.expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
        break;
      case SeverityLevel.SEVERE:
        this.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
        break;
    }
  }

  // Set auto-expire date if not set
  if (!this.autoExpireAt && this.expiresAt) {
    this.autoExpireAt = this.expiresAt;
  }

  // Update status based on expiry
  if (this.expiresAt && new Date() > this.expiresAt && this.status === WarningStatus.ACTIVE) {
    this.status = WarningStatus.EXPIRED;
    this.isActive = false;
  }

  next();
});

// Pre-findOneAndUpdate middleware
warningSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as any;
  
  // Handle status changes
  if (update.$set?.status === WarningStatus.RESOLVED && !update.$set?.resolvedAt) {
    update.$set.resolvedAt = new Date();
  }
  
  if (update.$set?.status === WarningStatus.EXPIRED && update.$set?.isActive !== false) {
    update.$set.isActive = false;
  }

  next();
});

// Instance Methods
warningSchema.methods.acknowledge = function (
  this: IUserWarningDocument,
  acknowledgedBy: string
) {
  this.acknowledgedBy = new mongoose.Types.ObjectId(acknowledgedBy);
  this.acknowledgedAt = new Date();
  return this.save();
};

warningSchema.methods.resolve = function (
  this: IUserWarningDocument,
  resolvedBy: string,
  notes?: string
) {
  this.status = WarningStatus.RESOLVED;
  this.resolvedBy = new mongoose.Types.ObjectId(resolvedBy);
  this.resolvedAt = new Date();
  this.isActive = false;
  if (notes) this.notes = notes;
  return this.save();
};

warningSchema.methods.activate = function (this: IUserWarningDocument) {
  if (this.status === WarningStatus.EXPIRED) {
    throw new Error("Cannot activate expired warning");
  }
  this.isActive = true;
  this.status = WarningStatus.ACTIVE;
  return this.save();
};

warningSchema.methods.deactivate = function (this: IUserWarningDocument) {
  this.isActive = false;
  return this.save();
};

warningSchema.methods.isExpired = function (this: IUserWarningDocument): boolean {
  return !!(this.expiresAt && new Date() > this.expiresAt);
};

warningSchema.methods.getRiskLevel = function (this: IUserWarningDocument): RiskLevel {
  const severityPoints = {
    [SeverityLevel.MINOR]: 1,
    [SeverityLevel.MAJOR]: 3,
    [SeverityLevel.SEVERE]: 5,
  };

  const categoryRisk = {
    [WarningCategory.SAFETY_CONCERN]: 2,
    [WarningCategory.THEFT_OR_FRAUD]: 2,
    [WarningCategory.HARASSMENT]: 2,
    [WarningCategory.SUBSTANCE_ABUSE]: 2,
    [WarningCategory.DATA_PRIVACY_VIOLATION]: 1.5,
    [WarningCategory.UNAUTHORIZED_ACCESS]: 1.5,
  };

  const baseScore = severityPoints[this.severity] || 1;
  const categoryMultiplier = categoryRisk[this.category as keyof typeof categoryRisk] || 1;
  const totalScore = baseScore * categoryMultiplier;

  if (totalScore >= 8) return RiskLevel.CRITICAL;
  if (totalScore >= 5) return RiskLevel.HIGH;
  if (totalScore >= 3) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
};

// Static Methods
warningSchema.statics.getActiveWarningsForUser = function (userId: string) {
  return this.find({
    userId,
    isActive: true,
    status: WarningStatus.ACTIVE,
  }).sort({ issuedAt: -1 });
};

warningSchema.statics.getWarningsByCategory = function (category: string) {
  return this.find({ category, isActive: true }).sort({ issuedAt: -1 });
};

warningSchema.statics.getExpiredWarnings = function () {
  return this.find({
    expiresAt: { $lte: new Date() },
    status: WarningStatus.ACTIVE,
  });
};

warningSchema.statics.expireOldWarnings = async function () {
  const result = await this.updateMany(
    {
      expiresAt: { $lte: new Date() },
      status: WarningStatus.ACTIVE,
    },
    {
      $set: {
        status: WarningStatus.EXPIRED,
        isActive: false,
      },
    }
  );
  return { modifiedCount: result.modifiedCount };
};

// Export the model
export const Warning = mongoose.model<IUserWarningDocument, IWarningModel>("Warning", warningSchema);