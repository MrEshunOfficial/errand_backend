// models/user.model.ts
import mongoose, { Schema } from "mongoose";
import { IUser } from "../types/user.types";

const userSchema = new Schema<IUser>(
  {
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
        return this.provider === "credentials";
      },
      minlength: [6, "Password must be at least 6 characters long"],
    },
    providerId: {
      type: String,
      sparse: true, // Allows null values but creates index for non-null values
    },
    avatar: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
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
    userRole: {
      type: String,
      enum: {
        values: ["user", "admin", "super_admin"],
        message: "Role must be either user, admin, or super_admin",
      },
      default: "user",
    },
    provider: {
      type: String,
      enum: {
        values: ["credentials", "google", "apple"],
        message: "Provider must be credentials, google, or apple",
      },
      default: "credentials",
    },
    systemAdminName: {
      type: String,
      default: null,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false, // Don't include in queries by default
    },
    resetPasswordToken: {
      type: String,
      select: false, // Don't include in queries by default
    },
    verificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ provider: 1, providerId: 1 }, { sparse: true });

// Compound index for OAuth users
userSchema.index({ provider: 1, email: 1 });

// Pre-save middleware to handle role consistency
userSchema.pre("save", function (next) {
  // Handle role consistency
  if (this.userRole === "admin") {
    this.isAdmin = true;
    this.isSuperAdmin = false;
  } else if (this.userRole === "super_admin") {
    this.isAdmin = true;
    this.isSuperAdmin = true;
  } else {
    this.isAdmin = false;
    this.isSuperAdmin = false;
  }

  // Auto-verify OAuth users
  if (this.provider !== "credentials") {
    this.isVerified = true;
  }

  next();
});

export const User = mongoose.model<IUser>("User", userSchema);
