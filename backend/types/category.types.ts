// types/category.types.ts
import { Types } from "mongoose";
import { BaseEntity, SoftDeletable, FileReference } from "./base.types";
import { ModerationStatus } from "./base.types";
import { Service } from "./service.types";

export interface Category extends BaseEntity, SoftDeletable {
  isModified(arg0: string): unknown;
  name: string;
  description?: string;
  image?: FileReference;
  tags: string[];
  isActive: boolean;
  displayOrder: number;
  parentCategoryId?: Types.ObjectId;
  moderatedBy?: Types.ObjectId;

  slug: string;
  metaDescription?: string;

  createdBy?: Types.ObjectId;
  lastModifiedBy?: Types.ObjectId;
  moderationStatus: ModerationStatus;
  moderationNotes?: string;

  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;

  // Instance methods
  softDelete(deletedBy?: Types.ObjectId): Promise<Category>;
  restore(): Promise<Category>;
}

// In your types/index.ts or types/category.types.ts
export interface CategoryWithServices extends Category {
  services?: Service[];
  servicesCount?: number;
  popularServices?: Service[];
  subcategories?: CategoryWithServices[];
}