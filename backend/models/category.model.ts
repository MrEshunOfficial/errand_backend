// models/Category.ts - Fixed version
import { Schema, model, Model, Document, Types } from "mongoose";
import { ModerationStatus } from "../types/base.types";
import { Category } from "../types";

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

// Virtual for subcategories
categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategoryId",
});

// Virtual for services count
categorySchema.virtual("servicesCount", {
  ref: "Service",
  localField: "_id",
  foreignField: "categoryId",
  count: true,
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

// Ensure virtuals are included in JSON output
categorySchema.set("toJSON", { virtuals: true });
categorySchema.set("toObject", { virtuals: true });

export const CategoryModel = model<Category, ICategoryModel>(
  "Category",
  categorySchema
);
