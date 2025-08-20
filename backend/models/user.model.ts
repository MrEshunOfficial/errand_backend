// models/user.model.ts
import mongoose, { Schema, Model } from "mongoose";
import { ProfilePicture, ModerationStatus, IUserDocument, IUser, AuthProvider, SystemRole, UserStatus } from "../types";


const profilePictureSchema = new Schema<ProfilePicture>(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSecuritySchema = new Schema(
  {
    lastLoginAt: { type: Date },
    lastLoggedOut: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { _id: false }
);

const userModerationSchema = new Schema(
  {
    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.APPROVED,
    },
    lastModeratedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastModeratedAt: { type: Date },
    moderationNotes: { type: String, trim: true },
    warningsCount: { type: Number, default: 0 },
    statusChangedBy: { type: Schema.Types.ObjectId, ref: "User" },
    statusChangedAt: { type: Date },
    statusReason: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    // Basic info
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === AuthProvider.CREDENTIALS;
      },
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // System roles
    systemRole: {
      type: String,
      enum: {
        values: Object.values(SystemRole),
        message: "Role must be user, admin, or super_admin",
      },
      default: SystemRole.USER,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(UserStatus),
        message: "Status must be active, suspended, blocked, or inactive",
      },
      default: UserStatus.ACTIVE,
    },

    // Auth provider info
    provider: {
      type: String,
      enum: {
        values: Object.values(AuthProvider),
        message: "Provider must be credentials, google, or apple",
      },
      default: AuthProvider.CREDENTIALS,
    },
    providerId: {
      type: String,
      sparse: true,
    },

    // Profile and avatar - updated to use ProfilePicture type
    avatar: {
      type: profilePictureSchema,
      default: null,
    },
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "UserProfile",
    },

    // Admin fields
    systemAdminName: {
      type: String,
      default: null,
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    // Security tokens
    verificationToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },

    // Enhanced security - updated to match types
    security: {
      type: userSecuritySchema,
      required: true,
      default: () => ({}),
    },

    // Moderation - updated to match types
    moderation: {
      type: userModerationSchema,
      required: true,
      default: () => ({}),
    },

    // Display name
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, "Display name cannot exceed 50 characters"],
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
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ provider: 1, providerId: 1 }, { sparse: true });
userSchema.index({ systemRole: 1 });
userSchema.index({ status: 1 });
userSchema.index({ "moderation.moderationStatus": 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: 1 });
userSchema.index({ lastLogin: 1 });

// Compound indexes
userSchema.index({ provider: 1, email: 1 });
userSchema.index({ systemRole: 1, status: 1 });
userSchema.index({ isDeleted: 1, status: 1 });

// Pre-save middleware
userSchema.pre("save", function (next) {
  // Handle role consistency
  if (this.systemRole === SystemRole.ADMIN) {
    this.isAdmin = true;
    this.isSuperAdmin = false;
  } else if (this.systemRole === SystemRole.SUPER_ADMIN) {
    this.isAdmin = true;
    this.isSuperAdmin = true;
  } else {
    this.isAdmin = false;
    this.isSuperAdmin = false;
  }

  // Auto-verify OAuth users
  if (this.provider !== AuthProvider.CREDENTIALS) {
    this.isVerified = true;
  }

  // Set display name if not provided
  if (!this.displayName) {
    this.displayName = this.name;
  }

  // Update security tracking
  if (this.isModified("password")) {
    this.security.passwordChangedAt = new Date();
  }

  // Update lastLoginAt when lastLogin is modified
  if (this.isModified("lastLogin")) {
    this.security.lastLoginAt = this.lastLogin;
  }

  // Handle soft delete
  if (this.isDeleted && !this.deletedAt) {
    this.deletedAt = new Date();
  }

  next();
});

// Query middleware to exclude soft-deleted documents by default
userSchema.pre(/^find/, function (this: mongoose.Query<any, any>, next) {
  // Only exclude soft-deleted if not explicitly including them
  const options = this.getOptions();
  if (!options.includeSoftDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Instance methods
userSchema.methods.softDelete = function (
  this: IUserDocument,
  deletedBy?: string
): Promise<IUserDocument> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) {
    this.deletedBy = new mongoose.Types.ObjectId(deletedBy);
  }
  return this.save();
};

userSchema.methods.restore = function (this: IUserDocument): Promise<IUserDocument> {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Create the model with proper typing
interface UserModel extends Model<IUserDocument> {}

export const User: UserModel = mongoose.model<IUserDocument>("User", userSchema);