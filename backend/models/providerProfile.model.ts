// models/providerProfile.model.ts - Type-safe version aligned with updated interfaces
import { Schema, model, Document, Types, Model } from "mongoose";
import {
  ProviderProfile,
} from "../types/provider-profile.types";
import { ProviderOperationalStatus, RiskLevel } from "../types/base.types";

// File Reference interface (if not in types file, add it there)
export interface FileReference {
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
}

// Extend the interface for Mongoose document with instance methods
export interface ProviderProfileDocument extends Omit<ProviderProfile, '_id' | 'createdAt' | 'updatedAt'>, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updatePerformanceMetrics(
    updates: Partial<ProviderProfile['performanceMetrics']>
  ): Promise<this>;

  addServiceOffering(serviceId: Types.ObjectId): Promise<this>;
  removeServiceOffering(serviceId: Types.ObjectId): Promise<this>;
  updateOperationalStatus(
    status: ProviderOperationalStatus,
    reason?: string
  ): Promise<this>;
  updateWorkingHours(
    day: string,
    hours: {
      start: string;
      end: string;
    }
  ): Promise<this>;
  toggleAvailability(): Promise<this>;
  addPenalty(): Promise<this>;
  updateRiskAssessment(riskData: {
    riskLevel?: RiskLevel;
    notes?: string;
    assessedBy: Types.ObjectId;
    nextAssessmentDays?: number;
  }): Promise<this>;
  calculateRiskScore(): number;
  scheduleNextAssessment(daysFromNow?: number): Promise<this>;
}

// Define static methods interface
interface ProviderProfileModel extends Model<ProviderProfileDocument> {
  findByProfileId(
    profileId: Types.ObjectId
  ): Promise<ProviderProfileDocument | null>;
  findAvailableProviders(
    serviceRadius?: number
  ): Promise<ProviderProfileDocument[]>;
  findByOperationalStatus(
    status: ProviderOperationalStatus
  ): Promise<ProviderProfileDocument[]>;
  findByRiskLevel(riskLevel: RiskLevel): Promise<ProviderProfileDocument[]>;
  findTopRatedProviders(limit?: number): Promise<ProviderProfileDocument[]>;
  findHighRiskProviders(): Promise<ProviderProfileDocument[]>;
}

// Provider Contact Info schema
const providerContactInfoSchema = new Schema(
  {
    businessContact: {
      type: String,
      trim: true,
    },
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
  },
  { _id: false }
);

// Working Hours schema
const workingHoursItemSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM"],
    },
    end: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM"],
    },
  },
  { _id: false }
);

// Performance Metrics schema
const performanceMetricsSchema = new Schema(
  {
    completionRate: {
      type: Number,
      min: [0, "Completion rate cannot be negative"],
      max: [100, "Completion rate cannot exceed 100"],
      default: 0,
    },
    averageRating: {
      type: Number,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
      default: 0,
    },
    totalJobs: {
      type: Number,
      min: [0, "Total jobs cannot be negative"],
      default: 0,
    },
    responseTimeMinutes: {
      type: Number,
      min: [0, "Response time cannot be negative"],
      default: 0,
    },
    averageResponseTime: {
      type: Number,
      min: [0, "Average response time cannot be negative"],
      default: 0,
    },
    cancellationRate: {
      type: Number,
      min: [0, "Cancellation rate cannot be negative"],
      max: [100, "Cancellation rate cannot exceed 100"],
      default: 0,
    },
    disputeRate: {
      type: Number,
      min: [0, "Dispute rate cannot be negative"],
      max: [100, "Dispute rate cannot exceed 100"],
      default: 0,
    },
    clientRetentionRate: {
      type: Number,
      min: [0, "Client retention rate cannot be negative"],
      max: [100, "Client retention rate cannot exceed 100"],
      default: 0,
    },
  },
  { _id: false }
);

// Main ProviderProfile schema
const providerProfileSchema = new Schema<ProviderProfileDocument, ProviderProfileModel>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: [true, "Profile ID is required"],
      index: true,
      unique: true,
    },

    providerContactInfo: {
      type: providerContactInfoSchema,
      required: [true, "Provider contact information is required"],
      default: () => ({}),
    },

    operationalStatus: {
      type: String,
      enum: {
        values: Object.values(ProviderOperationalStatus),
        message: "Invalid operational status: {VALUE}",
      },
      required: [true, "Operational status is required"],
      default: ProviderOperationalStatus.PROBATIONARY,
    },

    serviceOfferings: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
        required: true,
      },
    ],

    workingHours: {
      type: Map,
      of: workingHoursItemSchema,
      required: false,
    },

    isCurrentlyAvailable: {
      type: Boolean,
      default: true,
      required: [true, "Availability status is required"],
    },

    isAlwaysAvailable: {
      type: Boolean,
      default: false,
      required: [true, "Always available flag is required"],
    },

    businessName: {
      type: String,
      trim: true,
      maxlength: [100, "Business name cannot exceed 100 characters"],
    },

    requireInitialDeposit: {
      type: Boolean,
      default: false,
      required: [true, "Require initial deposit flag is required"],
    },

    percentageDeposit: {
      type: Number,
      min: [0, "Percentage deposit cannot be negative"],
      max: [100, "Percentage deposit cannot exceed 100"],
      validate: {
        validator: function (this: ProviderProfileDocument, value?: number) {
          return !this.requireInitialDeposit || (value != null && value > 0);
        },
        message: "Percentage deposit is required when requireInitialDeposit is true",
      },
    },

    performanceMetrics: {
      type: performanceMetricsSchema,
      required: [true, "Performance metrics are required"],
      default: () => ({
        completionRate: 0,
        averageRating: 0,
        totalJobs: 0,
        responseTimeMinutes: 0,
        averageResponseTime: 0,
        cancellationRate: 0,
        disputeRate: 0,
        clientRetentionRate: 0,
      }),
    },

    riskLevel: {
      type: String,
      enum: {
        values: Object.values(RiskLevel),
        message: "Invalid risk level: {VALUE}",
      },
      required: [true, "Risk level is required"],
      default: RiskLevel.MEDIUM,
    },

    lastRiskAssessmentDate: {
      type: Date,
    },

    riskAssessedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    penaltiesCount: {
      type: Number,
      min: [0, "Penalties count cannot be negative"],
      default: 0,
      required: [true, "Penalties count is required"],
    },

    lastPenaltyDate: {
      type: Date,
    },

    // SoftDeletable fields
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "providerprofiles",
  }
);

// Pre-save middleware
providerProfileSchema.pre("save", function (next) {
  // Ensure performance metrics are within valid ranges
  const metrics = this.performanceMetrics;
  if (metrics) {
    // Clamp percentage values
    const percentageFields: Array<keyof typeof metrics> = [
      "completionRate",
      "cancellationRate",
      "disputeRate",
      "clientRetentionRate",
    ];
    
    percentageFields.forEach((field) => {
      const value = metrics[field];
      if (typeof value === 'number') {
        if (value < 0) metrics[field] = 0;
        if (value > 100) metrics[field] = 100;
      }
    });

    // Clamp rating
    if (metrics.averageRating < 0) metrics.averageRating = 0;
    if (metrics.averageRating > 5) metrics.averageRating = 5;
  }

  // Validate deposit fields consistency
  if (this.requireInitialDeposit) {
    if (!this.percentageDeposit || this.percentageDeposit <= 0) {
      return next(new Error("Percentage deposit is required and must be greater than 0 when requireInitialDeposit is true"));
    }
  }

  next();
});

// Instance methods
providerProfileSchema.methods.updateWorkingHours = function (
  day: string,
  hours: {
    start: string;
    end: string;
  }
) {
  if (!this.workingHours) {
    this.workingHours = new Map();
  }

  this.workingHours.set(day.toLowerCase(), hours);
  this.markModified("workingHours");

  return this.save();
};

providerProfileSchema.methods.updatePerformanceMetrics = function (
  updates: Partial<ProviderProfile['performanceMetrics']>
) {
  const currentMetrics = this.performanceMetrics || {};
  this.performanceMetrics = {
    ...currentMetrics,
    ...updates,
  };
  return this.save();
};

providerProfileSchema.methods.addServiceOffering = function (
  serviceId: Types.ObjectId
) {
  if (!this.serviceOfferings) {
    this.serviceOfferings = [];
  }

  const exists = this.serviceOfferings.some(
    (id: Types.ObjectId) => id.equals(serviceId)
  );

  if (!exists) {
    this.serviceOfferings.push(serviceId);
  }
  return this.save();
};

providerProfileSchema.methods.removeServiceOffering = function (
  serviceId: Types.ObjectId
) {
  if (this.serviceOfferings) {
    this.serviceOfferings = this.serviceOfferings.filter(
      (id: Types.ObjectId) => !id.equals(serviceId)
    );
  }
  return this.save();
};

providerProfileSchema.methods.updateOperationalStatus = function (
  status: ProviderOperationalStatus,
  reason?: string
) {
  this.operationalStatus = status;
  // Optional: Add audit trail for status changes
  return this.save();
};

providerProfileSchema.methods.toggleAvailability = function () {
  this.isCurrentlyAvailable = !this.isCurrentlyAvailable;
  return this.save();
};

providerProfileSchema.methods.addPenalty = function () {
  this.penaltiesCount += 1;
  this.lastPenaltyDate = new Date();

  // Automatically update risk level based on penalties
  if (this.penaltiesCount >= 5) {
    this.riskLevel = RiskLevel.CRITICAL;
  } else if (this.penaltiesCount >= 3) {
    this.riskLevel = RiskLevel.HIGH;
  } else if (this.penaltiesCount >= 1) {
    this.riskLevel = RiskLevel.MEDIUM;
  }

  return this.save();
};

providerProfileSchema.methods.updateRiskAssessment = function (riskData: {
  riskLevel?: RiskLevel;
  notes?: string;
  assessedBy: Types.ObjectId;
  nextAssessmentDays?: number;
}) {
  if (riskData.riskLevel) {
    this.riskLevel = riskData.riskLevel;
  }

  this.lastRiskAssessmentDate = new Date();
  this.riskAssessedBy = riskData.assessedBy;

  return this.save();
};

providerProfileSchema.methods.calculateRiskScore = function (): number {
  let score = 0;
  const metrics = this.performanceMetrics;

  if (!metrics) return 50; // Default medium risk

  // Low completion rate increases risk
  if (metrics.completionRate < 70) score += 25;
  else if (metrics.completionRate < 85) score += 15;

  // High cancellation rate increases risk
  if (metrics.cancellationRate > 20) score += 20;
  else if (metrics.cancellationRate > 10) score += 10;

  // High dispute rate increases risk
  if (metrics.disputeRate > 15) score += 20;
  else if (metrics.disputeRate > 5) score += 10;

  // Low rating increases risk
  if (metrics.averageRating < 3.0) score += 20;
  else if (metrics.averageRating < 3.5) score += 10;

  // Penalties increase risk
  if (this.penaltiesCount > 0) {
    score += Math.min(this.penaltiesCount * 5, 25);
  }

  // New provider with few jobs
  if (metrics.totalJobs < 5) score += 15;
  else if (metrics.totalJobs < 10) score += 10;

  return Math.min(score, 100);
};

providerProfileSchema.methods.scheduleNextAssessment = function (daysFromNow: number = 30) {
  // This method can be implemented if you want to add nextAssessmentDate field
  // For now, it's a placeholder that matches the interface
  return this.save();
};

// Static methods
providerProfileSchema.statics.findByProfileId = function (
  profileId: Types.ObjectId
) {
  return this.findOne({ profileId, isDeleted: { $ne: true } });
};

providerProfileSchema.statics.findAvailableProviders = function (
  serviceRadius?: number
) {
  const query: any = {
    isCurrentlyAvailable: true,
    isDeleted: { $ne: true },
    operationalStatus: {
      $in: [
        ProviderOperationalStatus.ACTIVE,
        ProviderOperationalStatus.PROBATIONARY,
      ],
    },
  };

  return this.find(query);
};

providerProfileSchema.statics.findByOperationalStatus = function (
  status: ProviderOperationalStatus
) {
  return this.find({
    operationalStatus: status,
    isDeleted: { $ne: true },
  });
};

providerProfileSchema.statics.findByRiskLevel = function (
  riskLevel: RiskLevel
) {
  return this.find({
    riskLevel,
    isDeleted: { $ne: true },
  });
};

providerProfileSchema.statics.findTopRatedProviders = function (
  limit: number = 10
) {
  return this.find({
    operationalStatus: ProviderOperationalStatus.ACTIVE,
    isCurrentlyAvailable: true,
    isDeleted: { $ne: true },
  })
    .sort({
      "performanceMetrics.averageRating": -1,
      "performanceMetrics.totalJobs": -1,
    })
    .limit(limit);
};

providerProfileSchema.statics.findHighRiskProviders = function () {
  return this.find({
    isDeleted: { $ne: true },
    $or: [
      { riskLevel: RiskLevel.HIGH },
      { riskLevel: RiskLevel.CRITICAL },
      { penaltiesCount: { $gte: 3 } },
      { "performanceMetrics.disputeRate": { $gte: 20 } },
      { "performanceMetrics.cancellationRate": { $gte: 30 } },
    ],
  });
};

// Indexes
providerProfileSchema.index({ profileId: 1 }, { unique: true });
providerProfileSchema.index({ operationalStatus: 1 });
providerProfileSchema.index({ riskLevel: 1 });
providerProfileSchema.index({ isCurrentlyAvailable: 1 });
providerProfileSchema.index({ serviceOfferings: 1 });
providerProfileSchema.index({ "performanceMetrics.averageRating": -1 });
providerProfileSchema.index({ "performanceMetrics.completionRate": -1 });
providerProfileSchema.index({ isDeleted: 1 });
providerProfileSchema.index({ penaltiesCount: 1 });

// JSON serialization
providerProfileSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc: ProviderProfileDocument, ret: any) {
    // Convert Map to plain object for workingHours
    if (ret.workingHours instanceof Map) {
      ret.workingHours = Object.fromEntries(ret.workingHours);
    }

    // Add computed risk score
    ret.riskScore = doc.calculateRiskScore();

    return ret;
  },
});

providerProfileSchema.set("toObject", {
  virtuals: true,
  transform: function (doc, ret) {
    // Convert Map to plain object for workingHours
    if (ret.workingHours instanceof Map) {
      ret.workingHours = Object.fromEntries(ret.workingHours);
    }
    return ret;
  },
});

// Virtual for populated profile data
providerProfileSchema.virtual("profile", {
  ref: "Profile",
  localField: "profileId",
  foreignField: "_id",
  justOne: true,
});

export const ProviderProfileModel = model<
  ProviderProfileDocument,
  ProviderProfileModel
>("ProviderProfile", providerProfileSchema);

export default ProviderProfileModel;