// models/profile.model.ts
import mongoose, { Schema, Document } from "mongoose";
import {
  IUserProfile,
  ModerationStatus,
  IUserPreferences,
  FileReference,
  ProfilePicture,
  SocialMediaHandle,
  UserLocation,
  ContactDetails,
  IdDetails,
  idType,
  UserRole,
  VerificationStatus,
} from "../types";

// Extend the IUserProfile interface for mongoose methods
interface IUserProfileDocument extends Omit<IUserProfile, "_id">, Document {
  calculateCompleteness(): number;
  softDelete(deletedBy?: string): Promise<this>;
  restore(): Promise<this>;
  updateModeration(
    status: ModerationStatus,
    moderatedBy: string,
    notes?: string
  ): Promise<this>;
  updatePreferences(preferences: Partial<IUserPreferences>): Promise<this>;
}

// File Reference Schema
const fileReferenceSchema = new Schema<FileReference>(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Profile Picture Schema
const profilePictureSchema = new Schema<ProfilePicture>(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Social Media Handle Schema
const socialMediaHandleSchema = new Schema<SocialMediaHandle>(
  {
    nameOfSocial: {
      type: String,
      required: [true, "Social media platform name is required"],
      trim: true,
      maxlength: [50, "Social media name cannot exceed 50 characters"],
    },
    userName: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      maxlength: [100, "Username cannot exceed 100 characters"],
    },
  },
  { _id: true }
);

// User Location Schema
export const userLocationSchema = new Schema<UserLocation>(
  {
    ghanaPostGPS: {
      type: String,
      required: [true, "Ghana Post GPS is required"],
      trim: true,
      match: [
        /^[A-Z]{2}-\d{4}-\d{4}$/,
        "Ghana Post GPS must be in format XX-0000-0000",
      ],
    },
    nearbyLandmark: {
      type: String,
      trim: true,
      maxlength: [100, "Nearby landmark cannot exceed 100 characters"],
    },
    region: {
      type: String,
      trim: true,
      maxlength: [50, "Region cannot exceed 50 characters"],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, "City cannot exceed 50 characters"],
    },
    district: {
      type: String,
      trim: true,
      maxlength: [50, "District cannot exceed 50 characters"],
    },
    locality: {
      type: String,
      trim: true,
      maxlength: [50, "Locality cannot exceed 50 characters"],
    },
    other: {
      type: String,
      trim: true,
      maxlength: [200, "Other location info cannot exceed 200 characters"],
    },
    gpsCoordinates: {
      latitude: {
        type: Number,
        min: [-90, "Latitude must be between -90 and 90"],
        max: [90, "Latitude must be between -90 and 90"],
      },
      longitude: {
        type: Number,
        min: [-180, "Longitude must be between -180 and 180"],
        max: [180, "Longitude must be between -180 and 180"],
      },
    },
  },
  { _id: false }
);

// Notification Preferences Schema
const notificationPreferencesSchema = new Schema(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    // Granular notification controls
    bookingUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    providerMessages: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false },
  },
  { _id: false }
);

// Privacy Settings Schema
const privacySettingsSchema = new Schema(
  {
    shareProfile: { type: Boolean, default: true },
    shareLocation: { type: Boolean, default: true },
    shareContactDetails: { type: Boolean, default: false },
    preferCloseProximity: {
      location: { type: Boolean, default: true },
      radius: { type: Number, default: 5, min: 1, max: 100 }, // in kilometers
    },
    allowDirectContact: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
  },
  { _id: false }
);

// App Preferences Schema
const appPreferencesSchema = new Schema(
  {
    theme: {
      type: String,
      enum: {
        values: ["light", "dark", "system"],
        message: "Theme must be light, dark, or system",
      },
      default: "system",
    },
    language: {
      type: String,
      default: "en",
      trim: true,
      maxlength: [10, "Language code cannot exceed 10 characters"],
    },
    currency: {
      type: String,
      enum: {
        values: ["GHS", "USD", "EUR"],
        message: "Currency must be GHS, USD, or EUR",
      },
      default: "GHS",
    },
    distanceUnit: {
      type: String,
      enum: {
        values: ["km", "miles"],
        message: "Distance unit must be km or miles",
      },
      default: "km",
    },
    autoRefresh: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

// User Preferences Schema
const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    notifications: {
      type: notificationPreferencesSchema,
      required: true,
      default: () => ({}),
    },
    privacy: {
      type: privacySettingsSchema,
      required: true,
      default: () => ({}),
    },
    app: {
      type: appPreferencesSchema,
      required: true,
      default: () => ({}),
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Contact Details Schema
const contactDetailsSchema = new Schema<ContactDetails>(
  {
    primaryContact: {
      type: String,
      required: [true, "Primary contact is required"],
      trim: true,
      match: [
        /^\+233[0-9]{9}$|^0[0-9]{9}$/,
        "Please provide a valid Ghana phone number",
      ],
    },
    secondaryContact: {
      type: String,
      trim: true,
      match: [
        /^\+233[0-9]{9}$|^0[0-9]{9}$/,
        "Please provide a valid Ghana phone number",
      ],
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

// ID Details Schema
const idDetailsSchema = new Schema<IdDetails>(
  {
    idType: {
      type: String,
      enum: {
        values: Object.values(idType),
        message: "Invalid ID type",
      },
      required: [true, "ID type is required"],
    },
    idNumber: {
      type: String,
      required: [true, "ID number is required"],
      trim: true,
      maxlength: [50, "ID number cannot exceed 50 characters"],
    },
    idFile: {
      type: fileReferenceSchema,
      required: [true, "ID file is required"],
    },
  },
  { _id: false }
);

// Main Profile Schema
const profileSchema = new Schema<IUserProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: "Role must be customer or service_provider",
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    location: {
      type: userLocationSchema,
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({
        notifications: {
          email: true,
          sms: true,
          push: true,
          bookingUpdates: true,
          promotions: false,
          providerMessages: true,
          systemAlerts: true,
          weeklyDigest: false,
        },
        privacy: {
          shareProfile: true,
          shareLocation: true,
          shareContactDetails: false,
          preferCloseProximity: {
            location: true,
            radius: 5,
          },
          allowDirectContact: true,
          showOnlineStatus: true,
        },
        app: {
          theme: "system" as const,
          language: "en",
          currency: "GHS" as const,
          distanceUnit: "km" as const,
          autoRefresh: true,
          soundEnabled: true,
        },
        lastUpdated: new Date(),
      }),
    },
    socialMediaHandles: [socialMediaHandleSchema],
    lastModified: {
      type: Date,
      default: Date.now,
    },
    contactDetails: {
      type: contactDetailsSchema,
    },
    idDetails: {
      type: idDetailsSchema,
    },
    completeness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Profile picture
    profilePicture: {
      type: profilePictureSchema,
    },
    isActiveInMarketplace: {
      type: Boolean,
      default: false,
    },

    // Verification status
    verificationStatus: {
      type: String,
      enum: {
        values: Object.values(VerificationStatus),
        message: "Invalid verification status",
      },
      default: VerificationStatus.PENDING,
    },

    // Moderation fields
    moderationStatus: {
      type: String,
      enum: {
        values: Object.values(ModerationStatus),
        message: "Invalid moderation status",
      },
      default: ModerationStatus.PENDING,
    },
    lastModeratedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastModeratedAt: {
      type: Date,
    },
    moderationNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Moderation notes cannot exceed 1000 characters"],
    },
    warningsCount: {
      type: Number,
      default: 0,
      min: [0, "Warnings count cannot be negative"],
    },

    // Soft delete fields
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
  }
);

// Indexes for better performance
profileSchema.index({ userId: 1 }, { unique: true });
profileSchema.index({ role: 1 });
profileSchema.index({ "location.region": 1 });
profileSchema.index({ "location.city": 1 });
profileSchema.index({ "location.district": 1 });
profileSchema.index({ isActiveInMarketplace: 1 });
profileSchema.index({ verificationStatus: 1 });
profileSchema.index({ moderationStatus: 1 });
profileSchema.index({ isDeleted: 1 });
profileSchema.index({ createdAt: 1 });
profileSchema.index({ completeness: 1 });

// Compound indexes
profileSchema.index({ role: 1, isActiveInMarketplace: 1 });
profileSchema.index({ userId: 1, isActiveInMarketplace: 1 });
profileSchema.index({ role: 1, verificationStatus: 1 });
profileSchema.index({ "location.region": 1, "location.city": 1 });
profileSchema.index({ isDeleted: 1, moderationStatus: 1 });
profileSchema.index({ verificationStatus: 1, moderationStatus: 1 });

// Geospatial index for GPS coordinates
profileSchema.index({
  "location.gpsCoordinates": "2dsphere",
});

// Text index for search functionality
profileSchema.index({
  bio: "text",
  "location.nearbyLandmark": "text",
  "location.region": "text",
  "location.city": "text",
  "location.district": "text",
  "location.locality": "text",
});

// Pre-save middleware
profileSchema.pre("save", function (next) {
  this.lastModified = new Date();

  // Update preferences lastUpdated if preferences were modified
  if (this.isModified("preferences")) {
    if (this.preferences) {
      this.preferences.lastUpdated = new Date();
    }
  }

  // Calculate profile completeness
  this.completeness = calculateCompleteness.call(this);

  // Handle soft delete
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }

  next();
});

// Pre-findOneAndUpdate middleware
profileSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as any;

  // Set lastModified
  if (!update.$set) update.$set = {};
  update.$set.lastModified = new Date();

  // Update preferences lastUpdated if preferences are being updated
  if (update.preferences || update.$set.preferences) {
    const prefsUpdate = update.preferences || update.$set.preferences || {};
    prefsUpdate.lastUpdated = new Date();
    update.$set.preferences = prefsUpdate;
  }

  next();
});

// Query middleware to exclude soft-deleted documents by default
profileSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  const options = this.getOptions();
  if (!options.includeSoftDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Method to calculate profile completeness
function calculateCompleteness(this: IUserProfileDocument): number {
  let score = 0;

  // Required fields (15 points each)
  const requiredFields = [
    { field: this.bio, weight: 15 },
    { field: this.location?.ghanaPostGPS, weight: 15 },
    { field: this.contactDetails?.primaryContact, weight: 15 },
    { field: this.idDetails?.idNumber, weight: 15 },
    { field: this.profilePicture?.url, weight: 15 },
  ];

  // Optional fields (5 points each)
  const optionalFields = [
    { field: this.location?.nearbyLandmark, weight: 5 },
    { field: this.location?.region, weight: 5 },
    { field: this.location?.city, weight: 5 },
    { field: this.contactDetails?.secondaryContact, weight: 5 },
    { field: this.contactDetails?.businessEmail, weight: 5 },
    {
      field: this.socialMediaHandles && this.socialMediaHandles.length > 0,
      weight: 5,
    },
    {
      field:
        this.location?.gpsCoordinates?.latitude &&
        this.location?.gpsCoordinates?.longitude,
      weight: 5,
    },
  ];

  // Calculate score for required fields
  requiredFields.forEach(({ field, weight }) => {
    if (field && field.toString().trim()) {
      score += weight;
    }
  });

  // Calculate score for optional fields
  optionalFields.forEach(({ field, weight }) => {
    if (
      field &&
      (typeof field === "boolean" ? field : field.toString().trim())
    ) {
      score += weight;
    }
  });

  return Math.min(score, 100); // Cap at 100%
}

profileSchema.methods.calculateCompleteness = calculateCompleteness;

// Instance methods
profileSchema.methods.softDelete = function (
  this: IUserProfileDocument,
  deletedBy?: string
) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) {
    this.deletedBy = new mongoose.Types.ObjectId(deletedBy);
  }
  return this.save();
};

profileSchema.methods.restore = function (this: IUserProfileDocument) {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

profileSchema.methods.updateModeration = function (
  this: IUserProfileDocument,
  status: ModerationStatus,
  moderatedBy: string,
  notes?: string
) {
  this.moderationStatus = status;
  this.lastModeratedBy = new mongoose.Types.ObjectId(moderatedBy);
  this.lastModeratedAt = new Date();
  if (notes) {
    this.moderationNotes = notes;
  }
  return this.save();
};

profileSchema.methods.updatePreferences = function (
  this: IUserProfileDocument,
  preferences: Partial<IUserPreferences>
) {
  const currentPrefs = this.preferences || {
    notifications: {
      email: true,
      sms: true,
      push: true,
      bookingUpdates: true,
      promotions: false,
      providerMessages: true,
      systemAlerts: true,
      weeklyDigest: false,
    },
    privacy: {
      shareProfile: true,
      shareLocation: true,
      shareContactDetails: false,
      preferCloseProximity: {
        location: true,
        radius: 5,
      },
      allowDirectContact: true,
      showOnlineStatus: true,
    },
    app: {
      theme: "system" as const,
      language: "en",
      currency: "GHS" as const,
      distanceUnit: "km" as const,
      autoRefresh: true,
      soundEnabled: true,
    },
  };

  this.preferences = {
    notifications: {
      ...currentPrefs.notifications,
      ...preferences.notifications,
    },
    privacy: { ...currentPrefs.privacy, ...preferences.privacy },
    app: { ...currentPrefs.app, ...preferences.app },
    lastUpdated: new Date(),
  };
  return this.save();
};

// Ensure virtual fields are serialized
profileSchema.set("toJSON", { virtuals: true });
profileSchema.set("toObject", { virtuals: true });

export const Profile = mongoose.model<IUserProfileDocument>(
  "Profile",
  profileSchema
);
