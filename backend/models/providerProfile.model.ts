// models/providerProfile.model.ts - Fixed version with working hours serialization
import { Schema, model, Document, Types, Model } from "mongoose";
import {
  ProviderProfile,
  FileReference,
  ProviderContactInfo,
  ProviderOperationalStatus,
  RiskLevel,
} from "../types";

// Extend the interface for Mongoose document with instance methods
export interface ProviderProfileDocument
  extends Omit<ProviderProfile, "_id">,
    Document {
  _id: Types.ObjectId;

  // Instance methods
  updatePerformanceMetrics(
    updates: Partial<{
      completionRate: number;
      averageRating: number;
      totalJobs: number;
      responseTimeMinutes: number;
      averageResponseTime: number;
      cancellationRate: number;
      disputeRate: number;
      clientRetentionRate: number;
    }>
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
      isAvailable: boolean;
    }
  ): Promise<this>;
  toggleAvailability(): Promise<this>;
  addPenalty(): Promise<this>;
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

// File Reference schema
const fileReferenceSchema = new Schema<FileReference>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Provider Contact Info schema
const providerContactInfoSchema = new Schema<ProviderContactInfo>(
  {
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    emergencyContact: {
      type: String,
      required: [true, "Emergency contact is required"],
      trim: true,
      match: [
        /^\+233[0-9]{9}$|^0[0-9]{9}$/,
        "Please provide a valid Ghana phone number",
      ],
    },
  },
  { _id: false }
);

// Working Hours schema
const workingHoursSchema = new Schema(
  {
    start: {
      type: String,
      required: true,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Time must be in HH:MM format",
      ],
    },
    end: {
      type: String,
      required: true,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Time must be in HH:MM format",
      ],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isAlwaysAvailable: {
      type: Boolean,
      default: false,
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
const providerProfileSchema = new Schema<ProviderProfileDocument>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile", // Fixed: Use correct model name that matches your Profile model
      required: [true, "Profile ID is required"],
      index: true,
      unique: true,
    },

    providerContactInfo: {
      type: providerContactInfoSchema,
      required: [true, "Provider contact information is required"],
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

    // Fixed: Use Schema.Types.Mixed for better Map support
    workingHours: {
      type: Schema.Types.Mixed,
      default: () => ({
        monday: { start: "08:00", end: "17:00", isAvailable: true },
        tuesday: { start: "08:00", end: "17:00", isAvailable: true },
        wednesday: { start: "08:00", end: "17:00", isAvailable: true },
        thursday: { start: "08:00", end: "17:00", isAvailable: true },
        friday: { start: "08:00", end: "17:00", isAvailable: true },
        saturday: { start: "08:00", end: "14:00", isAvailable: true },
        sunday: { start: "10:00", end: "16:00", isAvailable: false },
      }),
    },

    isAvailableForWork: {
      type: Boolean,
      default: true,
    },

    isAlwaysAvailable: {
      type: Boolean,
      default: false,
    },

    businessName: {
      type: String,
      trim: true,
      maxlength: [100, "Business name cannot exceed 100 characters"],
    },

    performanceMetrics: {
      type: performanceMetricsSchema,
      required: true,
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

// Pre-save middleware to handle working hours
providerProfileSchema.pre("save", function (next) {
  // Ensure performance metrics are within valid ranges
  const metrics = this.performanceMetrics;
  if (metrics) {
    [
      "completionRate",
      "cancellationRate",
      "disputeRate",
      "clientRetentionRate",
    ].forEach((field) => {
      if (metrics[field as keyof typeof metrics] < 0)
        (metrics[field as keyof typeof metrics] as number) = 0;
      if (metrics[field as keyof typeof metrics] > 100)
        (metrics[field as keyof typeof metrics] as number) = 100;
    });

    if (metrics.averageRating < 0) metrics.averageRating = 0;
    if (metrics.averageRating > 5) metrics.averageRating = 5;
  }

  next();
});

// Instance method to update working hours - Fixed
providerProfileSchema.methods.updateWorkingHours = function (
  day: string,
  hours: {
    start: string;
    end: string;
    isAvailable: boolean;
  }
) {
  if (!this.workingHours) {
    this.workingHours = {};
  }

  // Since we're using Mixed type, we can directly assign
  this.workingHours[day.toLowerCase()] = hours;

  // Mark the field as modified for Mongoose to save it
  this.markModified("workingHours");

  return this.save();
};

// Add all your other instance methods here...
providerProfileSchema.methods.updatePerformanceMetrics = function (
  updates: Partial<{
    completionRate: number;
    averageRating: number;
    totalJobs: number;
    responseTimeMinutes: number;
    averageResponseTime: number;
    cancellationRate: number;
    disputeRate: number;
    clientRetentionRate: number;
  }>
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

  if (!this.serviceOfferings.includes(serviceId)) {
    this.serviceOfferings.push(serviceId);
  }
  return this.save();
};

providerProfileSchema.methods.removeServiceOffering = function (
  serviceId: Types.ObjectId
) {
  if (this.serviceOfferings) {
    this.serviceOfferings = this.serviceOfferings.filter(
      (id) => !id.equals(serviceId)
    );
  }
  return this.save();
};

providerProfileSchema.methods.updateOperationalStatus = function (
  status: ProviderOperationalStatus,
  reason?: string
) {
  this.operationalStatus = status;
  return this.save();
};

providerProfileSchema.methods.toggleAvailability = function () {
  this.isAvailableForWork = !this.isAvailableForWork;
  return this.save();
};

providerProfileSchema.methods.addPenalty = function () {
  this.penaltiesCount += 1;
  this.lastPenaltyDate = new Date();

  if (this.penaltiesCount >= 5) {
    this.riskLevel = RiskLevel.HIGH;
  } else if (this.penaltiesCount >= 3) {
    this.riskLevel = RiskLevel.MEDIUM;
  }

  return this.save();
};

// Add static methods...
providerProfileSchema.statics.findByProfileId = function (
  profileId: Types.ObjectId
) {
  return this.findOne({ profileId, isDeleted: { $ne: true } });
};

providerProfileSchema.statics.findAvailableProviders = function (
  serviceRadius?: number
) {
  const query: any = {
    isAvailableForWork: true,
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

providerProfileSchema.statics.findTopRatedProviders = function (
  limit: number = 10
) {
  return this.find({
    operationalStatus: ProviderOperationalStatus.ACTIVE,
    isAvailableForWork: true,
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
providerProfileSchema.index({ isAvailableForWork: 1 });
providerProfileSchema.index({ serviceOfferings: 1 });
providerProfileSchema.index({ "performanceMetrics.averageRating": -1 });
providerProfileSchema.index({ "performanceMetrics.completionRate": -1 });
providerProfileSchema.index({ isDeleted: 1 });

// Ensure proper JSON serialization
providerProfileSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Ensure working hours is properly serialized
    if (ret.workingHours && typeof ret.workingHours === "object") {
      ret.workingHours = ret.workingHours;
    }
    return ret;
  },
});

providerProfileSchema.set("toObject", {
  virtuals: true,
  transform: function (doc, ret) {
    // Ensure working hours is properly serialized
    if (ret.workingHours && typeof ret.workingHours === "object") {
      ret.workingHours = ret.workingHours;
    }
    return ret;
  },
});

// Virtual for populated profile data
providerProfileSchema.virtual("profile", {
  ref: "Profile", // Fixed: Use correct model name
  localField: "profileId",
  foreignField: "_id",
  justOne: true,
});

// Export the model with proper typing
export const ProviderProfileModel = model<
  ProviderProfileDocument,
  ProviderProfileModel
>("ProviderProfile", providerProfileSchema);

export default ProviderProfileModel;
