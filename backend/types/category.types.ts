// types/category.types.ts
import { Types } from "mongoose";
import { BaseEntity, SoftDeletable, FileReference } from "./base.types";
import { ModerationStatus } from "./base.types";

export interface Category extends BaseEntity, SoftDeletable {
  isModified(arg0: string): unknown;
  name: string;
  description?: string;
  image?: FileReference;
  tags: string[];
  isActive: boolean;
  displayOrder: number;
  parentCategoryId?: Types.ObjectId;

  slug: string;
  metaDescription?: string;

  createdBy?: Types.ObjectId;
  lastModifiedBy?: Types.ObjectId;
  moderationStatus: ModerationStatus;

  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;

  // Instance methods
  softDelete(deletedBy?: Types.ObjectId): Promise<Category>;
  restore(): Promise<Category>;
}
