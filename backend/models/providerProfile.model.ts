// models/providerProfile.model.ts - Updated version with enhanced risk assessment
import { Schema, model, Document, Types, Model } from "mongoose";
import {
  ProviderProfile,
  FileReference,
  ProviderContactInfo,
  ProviderOperationalStatus,
  RiskLevel,
} from "../types";

// Extend the interface for Mongoose document with instance methods
export interface ProviderProfileDocument extends Document {
  _id: Types.ObjectId;
  profileId: Types.ObjectId;
  providerContactInfo: ProviderContactInfo;
  operationalStatus: ProviderOperationalStatus;
  serviceOfferings: Types.ObjectId[];
  workingHours: Record<string, { start: string; end: string; isAvailable: boolean }>;
  isAvailableForWork: boolean;
  isAlwaysAvailable: boolean;
  businessName?: string;
  businessRegistration?: {
    registrationNumber: string;
    registrationDocument: FileReference;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    document: FileReference;
  };
  safetyMeasures: {
    requiresDeposit: boolean;
    depositAmount?: number;
    hasInsurance: boolean;
    insuranceProvider?: string;
    insuranceExpiryDate?: Date;
    emergencyContactVerified: boolean;
  };
  performanceMetrics: {
    completionRate: number;
    averageRating: number;
    totalJobs: number;
    responseTimeMinutes: number;
    averageResponseTime: number;
    cancellationRate: number;
    disputeRate: number;
    clientRetentionRate: number;
  };
  riskLevel: RiskLevel;
  riskFactors: {
    newProvider: boolean;
    lowCompletionRate: boolean;
    highCancellationRate: boolean;
    recentComplaints: number;
    verificationGaps: string[];
    negativeReviews: number;
  };
  mitigationMeasures: {
    requiresDeposit: boolean;
    limitedJobValue: boolean;
    maxJobValue?: number;
    requiresSupervision: boolean;
    frequentCheckins: boolean;
    clientConfirmationRequired: boolean;
  };
  lastRiskAssessmentDate?: Date;
  riskAssessedBy?: Types.ObjectId;
  nextAssessmentDate: Date;
  riskAssessmentNotes?: string;
  penaltiesCount: number;
  lastPenaltyDate?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

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
  
  // Enhanced risk assessment methods
  updateRiskAssessment(riskData: {
    riskLevel?: RiskLevel;
    riskFactors?: any;
    mitigationMeasures?: any;
    notes?: string;
    assessedBy: Types.ObjectId;
    nextAssessmentDays?: number;
  }): Promise<this>;
  calculateRiskScore(): number;
  isRiskAssessmentOverdue(): boolean;
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
  findOverdueRiskAssessments(): Promise<ProviderProfileDocument[]>;
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

// Provider Contact Info schema - Enhanced with all ContactDetails fields
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
    // From ProviderContactInfo extension
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

// Business Registration schema
const businessRegistrationSchema = new Schema(
  {
    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      trim: true,
    },
    registrationDocument: {
      type: fileReferenceSchema,
      required: [true, "Registration document is required"],
    },
  },
  { _id: false }
);

// Insurance schema
const insuranceSchema = new Schema(
  {
    provider: {
      type: String,
      required: [true, "Insurance provider is required"],
      trim: true,
    },
    policyNumber: {
      type: String,
      required: [true, "Policy number is required"],
      trim: true,
    },
    expiryDate: {
      type: Date,
      required: [true, "Insurance expiry date is required"],
    },
    document: {
      type: fileReferenceSchema,
      required: [true, "Insurance document is required"],
    },
  },
  { _id: false }
);

// Safety Measures schema
const safetyMeasuresSchema = new Schema(
  {
    requiresDeposit: {
      type: Boolean,
      default: false,
    },
    depositAmount: {
      type: Number,
      min: [0, "Deposit amount cannot be negative"],
      validate: {
        validator: function (this: any, value: number) {
          return !this.requiresDeposit || (value && value > 0);
        },
        message: "Deposit amount is required when deposit is required",
      },
    },
    hasInsurance: {
      type: Boolean,
      default: false,
    },
    insuranceProvider: {
      type: String,
      trim: true,
      validate: {
        validator: function (this: any, value: string): boolean {
          return !this.hasInsurance || (typeof value === "string" && value.trim().length > 0);
        },
        message: "Insurance provider is required when insurance is indicated",
      },
    },
    insuranceExpiryDate: {
      type: Date,
      validate: {
        validator: function (this: any, value: Date) {
          return !this.hasInsurance || (value && value > new Date());
        },
        message: "Insurance expiry date must be in the future",
      },
    },
    emergencyContactVerified: {
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

// NEW: Risk Factors schema
const riskFactorsSchema = new Schema(
  {
    newProvider: {
      type: Boolean,
      default: true,
      description: "Provider is new to the platform",
    },
    lowCompletionRate: {
      type: Boolean,
      default: false,
      description: "Provider has low job completion rate",
    },
    highCancellationRate: {
      type: Boolean,
      default: false,
      description: "Provider has high job cancellation rate",
    },
    recentComplaints: {
      type: Number,
      min: [0, "Recent complaints cannot be negative"],
      default: 0,
      description: "Number of complaints in the last 30 days",
    },
    verificationGaps: [{
      type: String,
      trim: true,
      description: "List of verification gaps (e.g., missing documents)",
    }],
    negativeReviews: {
      type: Number,
      min: [0, "Negative reviews count cannot be negative"],
      default: 0,
      description: "Number of negative reviews (1-2 stars)",
    },
  },
  { _id: false }
);

// NEW: Mitigation Measures schema
const mitigationMeasuresSchema = new Schema(
  {
    requiresDeposit: {
      type: Boolean,
      default: false,
      description: "Provider must pay deposit before job assignment",
    },
    limitedJobValue: {
      type: Boolean,
      default: false,
      description: "Provider is limited to lower value jobs",
    },
    maxJobValue: {
      type: Number,
      min: [0, "Max job value cannot be negative"],
      validate: {
        validator: function (this: any, value: number) {
          return !this.limitedJobValue || (value && value > 0);
        },
        message: "Max job value is required when job value is limited",
      },
      description: "Maximum job value allowed for this provider",
    },
    requiresSupervision: {
      type: Boolean,
      default: false,
      description: "Provider requires supervision during jobs",
    },
    frequentCheckins: {
      type: Boolean,
      default: false,
      description: "Provider requires frequent check-ins during jobs",
    },
    clientConfirmationRequired: {
      type: Boolean,
      default: false,
      description: "Client confirmation required before payment release",
    },
  },
  { _id: false }
);

// Main ProviderProfile schema
const providerProfileSchema = new Schema<ProviderProfileDocument>(
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

    businessRegistration: {
      type: businessRegistrationSchema,
      required: false,
    },

    insurance: {
      type: insuranceSchema,
      required: false,
    },

    safetyMeasures: {
      type: safetyMeasuresSchema,
      required: [true, "Safety measures are required"],
      default: () => ({
        requiresDeposit: false,
        hasInsurance: false,
        emergencyContactVerified: false,
      }),
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

    // ENHANCED RISK ASSESSMENT FIELDS
    riskLevel: {
      type: String,
      enum: {
        values: Object.values(RiskLevel),
        message: "Invalid risk level: {VALUE}",
      },
      required: [true, "Risk level is required"],
      default: RiskLevel.MEDIUM,
    },

    // NEW: Detailed risk factors
    riskFactors: {
      type: riskFactorsSchema,
      required: true,
      default: () => ({
        newProvider: true,
        lowCompletionRate: false,
        highCancellationRate: false,
        recentComplaints: 0,
        verificationGaps: [],
        negativeReviews: 0,
      }),
    },

    // NEW: Mitigation measures
    mitigationMeasures: {
      type: mitigationMeasuresSchema,
      required: true,
      default: () => ({
        requiresDeposit: false,
        limitedJobValue: false,
        requiresSupervision: false,
        frequentCheckins: false,
        clientConfirmationRequired: false,
      }),
    },

    lastRiskAssessmentDate: {
      type: Date,
    },

    riskAssessedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // NEW: Next assessment scheduling
    nextAssessmentDate: {
      type: Date,
      required: [true, "Next assessment date is required"],
      default: () => {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30); // 30 days from creation
        return nextDate;
      },
    },

    // NEW: Risk assessment notes
    riskAssessmentNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Risk assessment notes cannot exceed 1000 characters"],
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

// Pre-save middleware
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

    // Auto-update risk factors based on performance metrics
    if (this.riskFactors) {
      this.riskFactors.lowCompletionRate = metrics.completionRate < 70;
      this.riskFactors.highCancellationRate = metrics.cancellationRate > 20;
    }
  }

  // Validate insurance fields consistency
  if (this.safetyMeasures?.hasInsurance) {
    if (!this.safetyMeasures.insuranceProvider || !this.safetyMeasures.insuranceExpiryDate) {
      return next(new Error("Insurance provider and expiry date are required when hasInsurance is true"));
    }
  }

  // Validate deposit fields consistency
  if (this.safetyMeasures?.requiresDeposit) {
    if (!this.safetyMeasures.depositAmount || this.safetyMeasures.depositAmount <= 0) {
      return next(new Error("Deposit amount is required when requiresDeposit is true"));
    }
  }

  // Validate mitigation measures consistency
  if (this.mitigationMeasures?.limitedJobValue) {
    if (!this.mitigationMeasures.maxJobValue || this.mitigationMeasures.maxJobValue <= 0) {
      return next(new Error("Max job value is required when job value is limited"));
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
    isAvailable: boolean;
  }
) {
  if (!this.workingHours) {
    this.workingHours = {};
  }

  this.workingHours[day.toLowerCase()] = hours;
  this.markModified("workingHours");

  return this.save();
};

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
      (id: { equals: (arg0: Types.ObjectId) => any; }) => !id.equals(serviceId)
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

// ENHANCED: addPenalty method with risk assessment integration
providerProfileSchema.methods.addPenalty = function () {
  this.penaltiesCount += 1;
  this.lastPenaltyDate = new Date();

  // Update risk factors
  if (this.riskFactors) {
    this.riskFactors.recentComplaints = this.penaltiesCount;
  }

  // Automatically update risk level and mitigation measures based on penalties
  if (this.penaltiesCount >= 5) {
    this.riskLevel = RiskLevel.CRITICAL;
    // Add stricter mitigation measures
    if (this.mitigationMeasures) {
      this.mitigationMeasures.requiresDeposit = true;
      this.mitigationMeasures.requiresSupervision = true;
      this.mitigationMeasures.frequentCheckins = true;
      this.mitigationMeasures.clientConfirmationRequired = true;
      this.mitigationMeasures.limitedJobValue = true;
      this.mitigationMeasures.maxJobValue = 500; // Very low limit
    }
  } else if (this.penaltiesCount >= 3) {
    this.riskLevel = RiskLevel.HIGH;
    if (this.mitigationMeasures) {
      this.mitigationMeasures.limitedJobValue = true;
      this.mitigationMeasures.maxJobValue = 2000;
      this.mitigationMeasures.frequentCheckins = true;
      this.mitigationMeasures.clientConfirmationRequired = true;
    }
  }

  return this.save();
};

// NEW: Enhanced risk assessment methods
providerProfileSchema.methods.updateRiskAssessment = function (riskData: {
  riskLevel?: RiskLevel;
  riskFactors?: any;
  mitigationMeasures?: any;
  notes?: string;
  assessedBy: Types.ObjectId;
  nextAssessmentDays?: number;
}) {
  if (riskData.riskLevel) {
    this.riskLevel = riskData.riskLevel;
  }
  
  if (riskData.riskFactors) {
    this.riskFactors = {
      ...this.riskFactors,
      ...riskData.riskFactors,
    };
    this.markModified('riskFactors');
  }
  
  if (riskData.mitigationMeasures) {
    this.mitigationMeasures = {
      ...this.mitigationMeasures,
      ...riskData.mitigationMeasures,
    };
    this.markModified('mitigationMeasures');
  }
  
  this.lastRiskAssessmentDate = new Date();
  this.riskAssessedBy = riskData.assessedBy;
  
  if (riskData.notes) {
    this.riskAssessmentNotes = riskData.notes;
  }
  
  // Set next assessment date
  const daysFromNow = riskData.nextAssessmentDays || 30;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysFromNow);
  this.nextAssessmentDate = nextDate;
  
  return this.save();
};

providerProfileSchema.methods.calculateRiskScore = function (): number {
  let score = 0;
  const factors = this.riskFactors;

  if (!factors) return 0;

  // Risk factor scoring
  if (factors.newProvider) score += 20;
  if (factors.lowCompletionRate) score += 25;
  if (factors.highCancellationRate) score += 20;
  
  // Recent complaints scoring (scaled)
  if (factors.recentComplaints > 0) {
    score += Math.min(factors.recentComplaints * 5, 20);
  }

  // Verification gaps
  if (factors.verificationGaps && factors.verificationGaps.length > 0) {
    score += Math.min(factors.verificationGaps.length * 10, 30);
  }

  // Negative reviews (scaled)
  if (factors.negativeReviews > 0) {
    score += Math.min(factors.negativeReviews * 3, 15);
  }

  return Math.min(score, 100);
};

providerProfileSchema.methods.isRiskAssessmentOverdue = function (): boolean {
  return new Date() > this.nextAssessmentDate;
};

providerProfileSchema.methods.scheduleNextAssessment = function (daysFromNow: number = 30) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysFromNow);
  this.nextAssessmentDate = nextDate;
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

// NEW: Find providers with overdue risk assessments
providerProfileSchema.statics.findOverdueRiskAssessments = function () {
  return this.find({
    nextAssessmentDate: { $lt: new Date() },
    isDeleted: { $ne: true },
  })
    .populate('riskAssessedBy', 'fullName email')
    .sort({ nextAssessmentDate: 1 });
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
providerProfileSchema.index({ nextAssessmentDate: 1 }); // NEW: For overdue assessments
providerProfileSchema.index({ penaltiesCount: 1 }); // NEW: For penalty tracking

// JSON serialization
providerProfileSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc: ProviderProfileDocument, ret: any) {
    if (ret.workingHours && typeof ret.workingHours === "object") {
      ret.workingHours = ret.workingHours;
    }
    
    // Add computed risk assessment fields
    ret.riskScore = doc.calculateRiskScore();
    ret.isRiskAssessmentOverdue = doc.isRiskAssessmentOverdue();
    
    // Calculate days until next assessment
    if (ret.nextAssessmentDate) {
      const nextDate = new Date(ret.nextAssessmentDate);
      const currentDate = new Date();
      ret.daysUntilNextAssessment = Math.ceil(
        (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    
    return ret;
  },
});

providerProfileSchema.set("toObject", {
  virtuals: true,
  transform: function (doc, ret) {
    if (ret.workingHours && typeof ret.workingHours === "object") {
      ret.workingHours = ret.workingHours;
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