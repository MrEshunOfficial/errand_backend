// models/profile.model.ts
import mongoose, { Schema } from "mongoose";
import { idType, IUserProfile, UserRole } from "../types/user.types";

const profileSchema = new Schema<IUserProfile>(
  {
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message:
          "Role must be one of: customer, service_provider, admin, super_admin",
      },
      default: UserRole.CUSTOMER,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    location: {
      ghanaPostGPS: {
        type: String,
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
    preferences: {
      theme: {
        type: String,
        enum: {
          values: ["light", "dark", "system"],
          message: "Theme must be light, dark, or system",
        },
        default: "system",
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: "en",
        trim: true,
        maxlength: [10, "Language code cannot exceed 10 characters"],
      },
      privacySettings: {
        type: Schema.Types.Mixed,
        default: {
          shareProfile: true,
          shareLocation: true,
          shareContactDetails: true,
          preferCloseProximity: {
            location: true,
            radius: 1000,
          },
        },
      },
    },
    socialMediaHandles: [
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
    ],
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    contactDetails: {
      primaryContact: {
        type: String,
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
    },
    idDetails: {
      idType: {
        type: String,
        enum: Object.values(idType),
      },
      idNumber: {
        type: String,
        trim: true,
        maxlength: [50, "ID number cannot exceed 50 characters"],
      },
      idFile: {
        url: {
          type: String,
          trim: true,
        },
        fileName: {
          type: String,
          trim: true,
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
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
profileSchema.index({ isActive: 1 });

// Compound indexes
profileSchema.index({ role: 1, isActive: 1 });
profileSchema.index({ userId: 1, isActive: 1 });

// Pre-save middleware to update lastModified
profileSchema.pre("save", function (next) {
  this.lastModified = new Date();
  next();
});

// Pre-findOneAndUpdate middleware to update lastModified
profileSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastModified: new Date() });
  next();
});

// Virtual for profile completeness
profileSchema.virtual("completeness").get(function () {
  let score = 0;
  const fields = [
    this.bio,
    this.location?.ghanaPostGPS,
    this.contactDetails?.primaryContact,
    this.idDetails?.idNumber,
  ];

  fields.forEach((field) => {
    if (field && field.toString().trim()) score += 25;
  });

  return score;
});

// Ensure virtual fields are serialized
profileSchema.set("toJSON", { virtuals: true });
profileSchema.set("toObject", { virtuals: true });

export const Profile = mongoose.model<IUserProfile>("Profile", profileSchema);
