// models/clientProfile.model.ts
import { Schema, model, Document, Types, Model, Query } from "mongoose";
import { ClientProfile, RiskLevel } from "../types";

// Instance methods interface
export interface ClientProfileMethods {
  updateTrustScore(newScore: number): Promise<ClientProfileDocument>;
  addPreferredService(
    serviceId: Types.ObjectId
  ): Promise<ClientProfileDocument>;
  removePreferredService(
    serviceId: Types.ObjectId
  ): Promise<ClientProfileDocument>;
  addPreferredProvider(
    providerId: Types.ObjectId
  ): Promise<ClientProfileDocument>;
  removePreferredProvider(
    providerId: Types.ObjectId
  ): Promise<ClientProfileDocument>;
  calculateRiskLevel(): RiskLevel;
  addWarning(reason: string): Promise<ClientProfileDocument>;
  addSuspension(
    reason: string,
    duration: number
  ): Promise<ClientProfileDocument>;
}

// Static methods interface
export interface ClientProfileStatics {
  findByProfileId(
    profileId: Types.ObjectId
  ): Query<ClientProfileDocument | null, ClientProfileDocument>;
  findByRiskLevel(
    riskLevel: RiskLevel
  ): Query<ClientProfileDocument[], ClientProfileDocument>;
  findByTrustScoreRange(
    minScore: number,
    maxScore: number
  ): Query<ClientProfileDocument[], ClientProfileDocument>;
  findHighRiskClients(): Query<ClientProfileDocument[], ClientProfileDocument>;
  findByLoyaltyTier(
    tier: string
  ): Query<ClientProfileDocument[], ClientProfileDocument>;
  getActiveClients(): Query<ClientProfileDocument[], ClientProfileDocument>;
}

// Document interface that extends both the base ClientProfile and Mongoose Document
export interface ClientProfileDocument
  extends Omit<ClientProfile, "_id">,
    ClientProfileMethods,
    Document {
  _id: Types.ObjectId;
}

// Model interface that combines the document and static methods
export interface ClientProfileModel
  extends Model<ClientProfileDocument>,
    ClientProfileStatics {}

// Sub-schemas
const bookingPatternsSchema = new Schema(
  {
    preferredTimeSlots: [{ type: String }],
    seasonality: [{ type: String }],
    repeatCustomer: { type: Boolean, default: false },
  },
  { _id: false }
);

const suspensionHistorySchema = new Schema(
  {
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    duration: { type: Number, required: true }, // in days
    resolvedAt: { type: Date },
  },
  { _id: false }
);

// Main ClientProfile schema
const clientProfileSchema = new Schema<
  ClientProfileDocument,
  ClientProfileModel
>(
  {
    // In your clientProfile.model.ts
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile", // Change from "UserProfile" to "Profile"
      required: [true, "Profile ID is required"],
      index: true,
      unique: true,
    },

    preferredServices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service", // This should be correct if you have a Service model
      },
    ],

    preferredProviders: [
      {
        type: Schema.Types.ObjectId,
        ref: "ProviderProfile", // This should match your actual model name
      },
    ],

    // Trust and Risk Management
    trustScore: {
      type: Number,
      min: [0, "Trust score cannot be negative"],
      max: [100, "Trust score cannot exceed 100"],
      default: 50,
      validate: {
        validator: function (v: number) {
          return v >= 0 && v <= 100;
        },
        message: "Trust score must be between 0 and 100",
      },
    },

    riskLevel: {
      type: String,
      enum: {
        values: Object.values(RiskLevel),
        message: "Invalid risk level: {VALUE}",
      },
      required: [true, "Risk level is required"],
      default: RiskLevel.LOW,
    },

    riskFactors: [
      {
        type: String,
        trim: true,
      },
    ],

    // Service History and Behavior
    totalBookings: {
      type: Number,
      default: 0,
      min: [0, "Total bookings cannot be negative"],
    },

    completedBookings: {
      type: Number,
      default: 0,
      min: [0, "Completed bookings cannot be negative"],
    },

    cancelledBookings: {
      type: Number,
      default: 0,
      min: [0, "Cancelled bookings cannot be negative"],
    },

    disputedBookings: {
      type: Number,
      default: 0,
      min: [0, "Disputed bookings cannot be negative"],
    },

    // Financial
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, "Total spent cannot be negative"],
    },

    averageOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Average order value cannot be negative"],
    },

    paymentMethods: [
      {
        type: String,
        trim: true,
        enum: {
          values: [
            "mobile_money",
            "bank_transfer",
            "cash",
            "credit_card",
            "paypal",
            "crypto",
          ],
          message: "Invalid payment method: {VALUE}",
        },
      },
    ],

    // Ratings and Reviews
    averageRating: {
      type: Number,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: function (v: number) {
          return v == null || (v >= 0 && v <= 5);
        },
        message: "Rating must be between 0 and 5",
      },
    },

    totalReviews: {
      type: Number,
      default: 0,
      min: [0, "Total reviews cannot be negative"],
    },

    // Behavioral Patterns
    bookingPatterns: bookingPatternsSchema,

    // Communication
    communicationStyle: {
      type: String,
      enum: {
        values: ["formal", "casual", "direct"],
        message: "Invalid communication style: {VALUE}",
      },
    },

    preferredContactMethod: {
      type: String,
      enum: {
        values: ["phone", "email", "in-app"],
        message: "Invalid contact method: {VALUE}",
      },
    },

    responseTime: {
      type: Number,
      min: [0, "Response time cannot be negative"],
    },

    // Special Notes (for providers/admin)
    notes: [
      {
        type: String,
        trim: true,
      },
    ],

    flags: [
      {
        type: String,
        trim: true,
      },
    ],

    // Loyalty and Engagement
    loyaltyTier: {
      type: String,
      enum: {
        values: ["bronze", "silver", "gold", "platinum"],
        message: "Invalid loyalty tier: {VALUE}",
      },
      default: "bronze",
    },

    memberSince: {
      type: Date,
      default: Date.now,
    },

    lastActiveDate: {
      type: Date,
      default: Date.now,
    },

    // Verification Status
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isAddressVerified: {
      type: Boolean,
      default: false,
    },

    // Moderation
    warningsCount: {
      type: Number,
      default: 0,
      min: [0, "Warnings count cannot be negative"],
    },

    suspensionHistory: [suspensionHistorySchema],

    // Soft delete fields
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: undefined,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "clientprofiles",
  }
);

// Indexes for better query performance
clientProfileSchema.index({ profileId: 1 }, { unique: true });
clientProfileSchema.index({ riskLevel: 1 });
clientProfileSchema.index({ trustScore: -1 });
clientProfileSchema.index({ preferredServices: 1 });
clientProfileSchema.index({ preferredProviders: 1 });
clientProfileSchema.index({ isDeleted: 1 });
clientProfileSchema.index({ loyaltyTier: 1 });
clientProfileSchema.index({ lastActiveDate: -1 });
clientProfileSchema.index({ totalSpent: -1 });
clientProfileSchema.index({ averageRating: -1 });
clientProfileSchema.index({ memberSince: -1 });

// Compound indexes
clientProfileSchema.index({ riskLevel: 1, trustScore: -1 });
clientProfileSchema.index({ isDeleted: 1, riskLevel: 1 });
clientProfileSchema.index({ loyaltyTier: 1, totalSpent: -1 });
clientProfileSchema.index({
  isPhoneVerified: 1,
  isEmailVerified: 1,
  isAddressVerified: 1,
});

// Pre-save middleware
clientProfileSchema.pre("save", function (next) {
  // Ensure trust score is within valid range
  if (this.trustScore < 0) this.trustScore = 0;
  if (this.trustScore > 100) this.trustScore = 100;

  // Update last active date when profile is modified
  this.lastActiveDate = new Date();

  // Auto-calculate risk level if not manually set
  if (
    this.isModified("trustScore") ||
    this.isModified("warningsCount") ||
    this.isModified("disputedBookings") ||
    this.isModified("cancelledBookings")
  ) {
    this.riskLevel = this.calculateRiskLevel();
  }

  // Calculate average order value
  if (this.totalBookings > 0) {
    this.averageOrderValue = this.totalSpent / this.totalBookings;
  }

  next();
});

// Instance methods implementation
clientProfileSchema.methods.updateTrustScore = function (
  newScore: number
): Promise<ClientProfileDocument> {
  if (newScore < 0 || newScore > 100) {
    throw new Error("Trust score must be between 0 and 100");
  }
  this.trustScore = newScore;
  return this.save();
};

clientProfileSchema.methods.calculateRiskLevel = function (): RiskLevel {
  let riskScore = 0;

  // Trust score factor (inverse relationship)
  if (this.trustScore < 30) riskScore += 30;
  else if (this.trustScore < 50) riskScore += 20;
  else if (this.trustScore < 70) riskScore += 10;

  // Warnings factor
  riskScore += this.warningsCount * 10;

  // Booking behavior factor
  if (this.totalBookings > 0) {
    const disputeRate = this.disputedBookings / this.totalBookings;
    const cancelRate = this.cancelledBookings / this.totalBookings;

    if (disputeRate > 0.2) riskScore += 25;
    else if (disputeRate > 0.1) riskScore += 15;

    if (cancelRate > 0.3) riskScore += 20;
    else if (cancelRate > 0.15) riskScore += 10;
  }

  // Verification factor
  const verificationCount = [
    this.isPhoneVerified,
    this.isEmailVerified,
    this.isAddressVerified,
  ].filter(Boolean).length;
  if (verificationCount === 0) riskScore += 20;
  else if (verificationCount === 1) riskScore += 10;

  // Determine risk level
  if (riskScore >= 60) return RiskLevel.CRITICAL;
  if (riskScore >= 40) return RiskLevel.HIGH;
  if (riskScore >= 20) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
};

clientProfileSchema.methods.addWarning = function (
  reason: string
): Promise<ClientProfileDocument> {
  this.warningsCount += 1;
  if (!this.flags) this.flags = [];
  this.flags.push(`Warning: ${reason} - ${new Date().toISOString()}`);
  return this.save();
};

clientProfileSchema.methods.addSuspension = function (
  reason: string,
  duration: number
): Promise<ClientProfileDocument> {
  if (!this.suspensionHistory) this.suspensionHistory = [];

  this.suspensionHistory.push({
    date: new Date(),
    reason,
    duration,
  });

  return this.save();
};

clientProfileSchema.methods.addPreferredService = function (
  serviceId: Types.ObjectId
): Promise<ClientProfileDocument> {
  if (!this.preferredServices) {
    this.preferredServices = [];
  }

  const existingService = this.preferredServices.find(
    (id) => id.toString() === serviceId.toString()
  );

  if (!existingService) {
    this.preferredServices.push(serviceId);
  }
  return this.save();
};

clientProfileSchema.methods.removePreferredService = function (
  serviceId: Types.ObjectId
): Promise<ClientProfileDocument> {
  if (this.preferredServices) {
    this.preferredServices = this.preferredServices.filter(
      (id) => id.toString() !== serviceId.toString()
    );
  }
  return this.save();
};

clientProfileSchema.methods.addPreferredProvider = function (
  providerId: Types.ObjectId
): Promise<ClientProfileDocument> {
  if (!this.preferredProviders) {
    this.preferredProviders = [];
  }

  const existingProvider = this.preferredProviders.find(
    (id) => id.toString() === providerId.toString()
  );

  if (!existingProvider) {
    this.preferredProviders.push(providerId);
  }
  return this.save();
};

clientProfileSchema.methods.removePreferredProvider = function (
  providerId: Types.ObjectId
): Promise<ClientProfileDocument> {
  if (this.preferredProviders) {
    this.preferredProviders = this.preferredProviders.filter(
      (id) => id.toString() !== providerId.toString()
    );
  }
  return this.save();
};

// Static methods implementation
clientProfileSchema.statics.findByProfileId = function (
  profileId: Types.ObjectId
): Query<ClientProfileDocument | null, ClientProfileDocument> {
  return this.findOne({ profileId, isDeleted: { $ne: true } });
};

clientProfileSchema.statics.findByRiskLevel = function (
  riskLevel: RiskLevel
): Query<ClientProfileDocument[], ClientProfileDocument> {
  return this.find({ riskLevel, isDeleted: { $ne: true } });
};

clientProfileSchema.statics.findByTrustScoreRange = function (
  minScore: number,
  maxScore: number
): Query<ClientProfileDocument[], ClientProfileDocument> {
  return this.find({
    trustScore: { $gte: minScore, $lte: maxScore },
    isDeleted: { $ne: true },
  });
};

clientProfileSchema.statics.findHighRiskClients = function (): Query<
  ClientProfileDocument[],
  ClientProfileDocument
> {
  return this.find({
    $or: [
      { riskLevel: RiskLevel.HIGH },
      { riskLevel: RiskLevel.CRITICAL },
      { trustScore: { $lt: 30 } },
    ],
    isDeleted: { $ne: true },
  });
};

clientProfileSchema.statics.findByLoyaltyTier = function (
  tier: string
): Query<ClientProfileDocument[], ClientProfileDocument> {
  return this.find({ loyaltyTier: tier, isDeleted: { $ne: true } });
};

clientProfileSchema.statics.getActiveClients = function (): Query<
  ClientProfileDocument[],
  ClientProfileDocument
> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return this.find({
    lastActiveDate: { $gte: thirtyDaysAgo },
    isDeleted: { $ne: true },
  });
};

// Virtual for populated profile data
clientProfileSchema.virtual("profile", {
  ref: "UserProfile",
  localField: "profileId",
  foreignField: "_id",
  justOne: true,
});

// Virtual for completion rate
clientProfileSchema.virtual("completionRate").get(function () {
  if (this.totalBookings === 0) return 0;
  return (this.completedBookings / this.totalBookings) * 100;
});

// Virtual for dispute rate
clientProfileSchema.virtual("disputeRate").get(function () {
  if (this.totalBookings === 0) return 0;
  return (this.disputedBookings / this.totalBookings) * 100;
});

// Virtual for verification status
clientProfileSchema.virtual("isFullyVerified").get(function () {
  return this.isPhoneVerified && this.isEmailVerified && this.isAddressVerified;
});

// Ensure virtual fields are serialized
clientProfileSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

clientProfileSchema.set("toObject", { virtuals: true });

// Create and export the model with proper typing
export const ClientProfileModel = model<
  ClientProfileDocument,
  ClientProfileModel
>("ClientProfile", clientProfileSchema);

// Export default
export default ClientProfileModel;
