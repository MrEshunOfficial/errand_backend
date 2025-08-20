// models/service.model.ts
import { Schema, model, Model, Document, Types, Query } from "mongoose";
import { Service } from "../types/service.types";
import { ServiceStatus } from "../types/base.types";

// Interface for instance methods
interface IServiceMethods {
  softDelete(deletedBy?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;
  approve(approvedBy: Types.ObjectId): Promise<this>;
  reject(rejectedBy: Types.ObjectId, reason?: string): Promise<this>;
  markPopular(): Promise<this>;
  unmarkPopular(): Promise<this>;
}

// Interface for static methods - return Query objects, not Promises
interface IServiceStatics {
  findActive(): Query<ServiceDocument[], ServiceDocument>;
  findBySlug(slug: string): Query<ServiceDocument | null, ServiceDocument>;
  findByCategory(
    categoryId: Types.ObjectId
  ): Query<ServiceDocument[], ServiceDocument>;
  findPopular(): Query<ServiceDocument[], ServiceDocument>;
  findPendingApproval(): Query<ServiceDocument[], ServiceDocument>;
}

// Combined interface for the model
interface IServiceModel extends Model<Service, {}, IServiceMethods>, IServiceStatics {}

// Document type that includes both the Service interface and instance methods
export type ServiceDocument = Document<unknown, {}, Service> &
  Service &
  IServiceMethods;

const fileReferenceSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const priceRangeSchema = new Schema(
  {
    min: {
      type: Number,
      required: true,
      min: 0,
    },
    max: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "GHS",
      enum: ["GHS", "USD", "EUR"],
    },
  },
  { _id: false }
);

const serviceSchema = new Schema<Service, IServiceModel, IServiceMethods>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: {
      type: [fileReferenceSchema],
      default: [],
      validate: {
        validator: function (images: any[]) {
          return images.length <= 10; // Maximum 10 images
        },
        message: "A service can have a maximum of 10 images",
      },
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(ServiceStatus),
      default: ServiceStatus.DRAFT,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 50,
      },
    ],
    basePrice: {
      type: Number,
      min: 0,
      validate: {
        validator: function (this: Service, price: number) {
          // Only allow basePrice when priceBasedOnServiceType is false
          if (price && this.priceBasedOnServiceType !== false) {
            return false;
          }
          // Cannot have both basePrice and priceRange
          return !(price && this.priceRange);
        },
        message: "basePrice can only be set when priceBasedOnServiceType is false, and cannot coexist with priceRange",
      },
    },
    priceRange: {
      type: priceRangeSchema,
      validate: {
        validator: function (this: Service, range: any) {
          // Only allow priceRange when priceBasedOnServiceType is false
          if (range && this.priceBasedOnServiceType !== false) {
            return false;
          }
          // Cannot have both basePrice and priceRange
          if (range && this.basePrice) return false;
          // Min must be less than max
          if (range && range.min >= range.max) return false;
          return true;
        },
        message: "priceRange can only be set when priceBasedOnServiceType is false, and cannot coexist with basePrice",
      },
    },
    priceDescription: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 250,
      validate: {
        validator: function (this: Service, description: string) {
          // Only allow priceDescription when priceBasedOnServiceType is false
          return !(description && this.priceBasedOnServiceType !== false);
        },
        message: "priceDescription can only be set when priceBasedOnServiceType is false",
      },
    },
    priceBasedOnServiceType: {
      type: Boolean,
      default: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    moderationNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Soft delete fields - make them optional in schema but handle properly in methods
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: undefined, // Use undefined instead of null
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined, // Use undefined instead of null
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for better performance
serviceSchema.index({ slug: 1 });
serviceSchema.index({ categoryId: 1, status: 1 });
serviceSchema.index({ status: 1, isDeleted: 1 });
serviceSchema.index({ isPopular: 1, status: 1 });
serviceSchema.index({ title: "text", description: "text" });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ basePrice: 1 });
serviceSchema.index({ "priceRange.min": 1, "priceRange.max": 1 });
serviceSchema.index({ submittedBy: 1 });
serviceSchema.index({ createdAt: -1 });
serviceSchema.index({ priceBasedOnServiceType: 1 }); // Add index for price-based filtering

// Compound indexes for common queries
serviceSchema.index({ categoryId: 1, status: 1, isPopular: -1 });
serviceSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
serviceSchema.index({ priceBasedOnServiceType: 1, status: 1, isDeleted: 1 }); // Price-based compound index

// Pre-save middleware to generate slug if not provided
serviceSchema.pre("save", function (next) {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }
  next();
});

// Pre-save middleware to clear pricing fields when priceBasedOnServiceType is true
serviceSchema.pre("save", function (next) {
  if (this.priceBasedOnServiceType === true) {
    // Clear all pricing fields when price is based on service type
    this.basePrice = undefined;
    this.priceRange = undefined;
    this.priceDescription = undefined;
  }
  next();
});

// Pre-save middleware to set approval/rejection timestamps
serviceSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (
      this.status === ServiceStatus.APPROVED &&
      this.approvedBy &&
      !this.approvedAt
    ) {
      this.approvedAt = new Date();
    }
    if (
      this.status === ServiceStatus.REJECTED &&
      this.rejectedBy &&
      !this.rejectedAt
    ) {
      this.rejectedAt = new Date();
    }
  }
  next();
});

// Virtual for category details
serviceSchema.virtual("category", {
  ref: "Category",
  localField: "categoryId",
  foreignField: "_id",
  justOne: true,
});

// Static methods - return Query objects so they can be chained
serviceSchema.statics.findActive = function () {
  return this.find({
    status: ServiceStatus.APPROVED,
    isDeleted: false,
  });
};

serviceSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({
    slug,
    status: ServiceStatus.APPROVED,
    isDeleted: false,
  }).populate("category", "name slug");
};

serviceSchema.statics.findByCategory = function (categoryId: Types.ObjectId) {
  return this.find({
    categoryId,
    status: ServiceStatus.APPROVED,
    isDeleted: false,
  }).populate("category", "name slug");
};

serviceSchema.statics.findPopular = function () {
  return this.find({
    isPopular: true,
    status: ServiceStatus.APPROVED,
    isDeleted: false,
  }).populate("category", "name slug");
};

serviceSchema.statics.findPendingApproval = function () {
  return this.find({
    status: ServiceStatus.PENDING_APPROVAL,
    isDeleted: false,
  }).populate("category", "name slug");
};

// Instance methods
serviceSchema.methods.softDelete = function (deletedBy?: Types.ObjectId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  return this.save();
};

serviceSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

serviceSchema.methods.approve = function (approvedBy: Types.ObjectId) {
  this.status = ServiceStatus.APPROVED;
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.rejectedBy = undefined;
  this.rejectedAt = undefined;
  this.rejectionReason = undefined;
  return this.save();
};

serviceSchema.methods.reject = function (
  rejectedBy: Types.ObjectId,
  reason?: string
) {
  this.status = ServiceStatus.REJECTED;
  this.rejectedBy = rejectedBy;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  this.approvedBy = undefined;
  this.approvedAt = undefined;
  return this.save();
};

serviceSchema.methods.markPopular = function () {
  this.isPopular = true;
  return this.save();
};

serviceSchema.methods.unmarkPopular = function () {
  this.isPopular = false;
  return this.save();
};

// Ensure virtuals are included in JSON output
serviceSchema.set("toJSON", { virtuals: true });
serviceSchema.set("toObject", { virtuals: true });

export const ServiceModel = model<Service, IServiceModel>(
  "Service",
  serviceSchema
);