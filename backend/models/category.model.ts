// models/category.model.ts - Updated with admin service support
import { Schema, model, Model, Types } from "mongoose";
import { ModerationStatus } from "../types/base.types";
import { Category } from "../types";
import { ServiceStatus } from "../types/base.types";

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

export interface ICategoryModel extends Model<Category> {
  findActive(): any;
  findBySlug(slug: string): any;
  findParentCategories(): any;
  findSubcategories(parentId: Types.ObjectId): any;
  findWithServices(options?: {
    limit?: number;
    popularOnly?: boolean;
    isAdmin?: boolean;
  }): Promise<any[]>;
  findWithServicesAggregation(options?: {
    limit?: number;
    skip?: number;
    servicesLimit?: number;
    popularOnly?: boolean;
    includeSubcategories?: boolean;
    isAdmin?: boolean;
  }): Promise<{ categories: any[]; total: number }>;
}

const categorySchema = new Schema<Category>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    image: fileReferenceSchema,
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    parentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.PENDING,
    },
    moderationNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    // Soft delete fields
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for better performance
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1, isDeleted: 1 });
categorySchema.index({ parentCategoryId: 1 });
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ moderationStatus: 1 });
categorySchema.index({ tags: 1 });

// Helper function to generate slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

// Helper function to ensure unique slug
async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: Types.ObjectId
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query: any = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await CategoryModel.findOne(query);
    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Pre-save middleware to generate/update slug
categorySchema.pre<Category>("save", async function (next) {
  try {
    if (this.isModified("name") || !this.slug) {
      const baseSlug = generateSlug(this.name);
      this.slug = await ensureUniqueSlug(baseSlug, this._id);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Virtual for subcategories (keep this one as it's simpler)
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategoryId",
  match: { isActive: true, isDeleted: false },
});

// UPDATED: Virtual for services count with admin support
categorySchema.virtual("servicesCount", {
  ref: "Service",
  localField: "_id",
  foreignField: "categoryId",
  count: true,
  match: { isDeleted: { $ne: true } },
  // Note: can't dynamically filter by status in virtuals based on user role
  // this will be handled in the controller methods instead
});

// UPDATED: Virtual for approved services (for public users)
categorySchema.virtual("services", {
  ref: "Service",
  localField: "_id",
  foreignField: "categoryId",
  match: {
    status: ServiceStatus.APPROVED,
    isDeleted: { $ne: true },
  },
  options: {
    sort: { createdAt: -1 },
    limit: 10,
  },
});

// UPDATED: Virtual for all services (for admin users)
categorySchema.virtual("allServices", {
  ref: "Service",
  localField: "_id",
  foreignField: "categoryId",
  match: { isDeleted: { $ne: true } },
  options: {
    sort: { createdAt: -1 },
    limit: 10,
  },
});

// Virtual for popular services
categorySchema.virtual("popularServices", {
  ref: "Service",
  localField: "_id",
  foreignField: "categoryId",
  match: {
    status: ServiceStatus.APPROVED,
    isPopular: true,
    isDeleted: { $ne: true },
  },
  options: {
    sort: { createdAt: -1 },
    limit: 5,
  },
});

// Static methods
categorySchema.statics.findActive = function () {
  return this.find({ isActive: true, isDeleted: false });
};

categorySchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug, isActive: true, isDeleted: false });
};

categorySchema.statics.findParentCategories = function () {
  return this.find({
    parentCategoryId: null,
    isActive: true,
    isDeleted: false,
  }).sort({ displayOrder: 1 });
};

categorySchema.statics.findSubcategories = function (parentId: Types.ObjectId) {
  return this.find({
    parentCategoryId: parentId,
    isActive: true,
    isDeleted: false,
  }).sort({ displayOrder: 1 });
};

// UPDATED: Aggregation method with admin support
categorySchema.statics.findWithServicesAggregation = async function (
  options = {}
) {
  const {
    limit = 20,
    skip = 0,
    servicesLimit = 10,
    popularOnly = false,
    includeSubcategories = false,
    isAdmin = false,
  } = options;

  const pipeline: any[] = [
    // Match active categories
    {
      $match: {
        isActive: true,
        isDeleted: false,
      },
    },
    // Lookup services with role-based filtering
    {
      $lookup: {
        from: "services",
        let: { categoryId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$categoryId", "$categoryId"] },
                  // Admin sees all services, users see only approved
                  ...(isAdmin
                    ? []
                    : [{ $eq: ["$status", ServiceStatus.APPROVED] }]),
                  { $ne: ["$isDeleted", true] },
                  ...(popularOnly ? [{ $eq: ["$isPopular", true] }] : []),
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: servicesLimit },
        ],
        as: "services",
      },
    },
    // Add services count with role-based filtering
    {
      $lookup: {
        from: "services",
        let: { categoryId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$categoryId", "$categoryId"] },
                  // Admin sees count of all services, users see only approved
                  ...(isAdmin
                    ? []
                    : [{ $eq: ["$status", ServiceStatus.APPROVED] }]),
                  { $ne: ["$isDeleted", true] },
                ],
              },
            },
          },
          { $count: "count" },
        ],
        as: "servicesCountArray",
      },
    },
    // Extract count from array
    {
      $addFields: {
        servicesCount: {
          $ifNull: [{ $arrayElemAt: ["$servicesCountArray.count", 0] }, 0],
        },
      },
    },
    // Remove the temporary array
    {
      $unset: "servicesCountArray",
    },
    // Sort categories
    { $sort: { displayOrder: 1 } },
  ];

  // Add subcategories lookup if requested
  if (includeSubcategories) {
    pipeline.push({
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "parentCategoryId",
        pipeline: [
          {
            $match: {
              isActive: true,
              isDeleted: false,
            },
          },
          { $sort: { displayOrder: 1 } },
        ],
        as: "subcategories",
      },
    });
  }

  // Get total count
  const totalPipeline = [...pipeline.slice(0, 1), { $count: "total" }];
  const [totalResult] = await this.aggregate(totalPipeline);
  const total = totalResult?.total || 0;

  // Add pagination
  if (skip > 0) pipeline.push({ $skip: skip });
  if (limit > 0) pipeline.push({ $limit: limit });

  const categories = await this.aggregate(pipeline);

  return { categories, total };
};

// UPDATED: Simple method with admin support
categorySchema.statics.findWithServices = async function (options = {}) {
  const { limit = 10, popularOnly = false, isAdmin = false } = options;

  // Import ServiceModel - adjust path as needed
  const { ServiceModel } = await import("./service.model");

  const categories = await this.find({ isActive: true, isDeleted: false })
    .sort({ displayOrder: 1 })
    .lean(); // Use lean for better performance

  // Manually attach services to each category
  for (const category of categories) {
    const serviceQuery: any = {
      categoryId: category._id,
      isDeleted: { $ne: true },
    };

    // Role-based filtering
    if (!isAdmin) {
      serviceQuery.status = ServiceStatus.APPROVED;
    }

    if (popularOnly) {
      serviceQuery.isPopular = true;
    }

    const [services, servicesCount] = await Promise.all([
      ServiceModel.find(serviceQuery)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      ServiceModel.countDocuments({
        categoryId: category._id,
        // Admin sees count of all services, users see only approved
        ...(isAdmin ? {} : { status: ServiceStatus.APPROVED }),
        isDeleted: { $ne: true },
      }),
    ]);

    // Attach services data
    (category as any).services = services;
    (category as any).servicesCount = servicesCount;
  }

  return categories;
};

// Instance methods
categorySchema.methods.softDelete = function (deletedBy?: Types.ObjectId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  return this.save();
};

categorySchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

// Keep JSON virtuals enabled for subcategories virtual
categorySchema.set("toJSON", { virtuals: true });
categorySchema.set("toObject", { virtuals: true });

export const CategoryModel = model<Category, ICategoryModel>(
  "Category",
  categorySchema
);
