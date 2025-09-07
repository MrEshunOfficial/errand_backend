// types/service.types.ts
import { Types } from "mongoose";
import {
  BaseEntity,
  SoftDeletable,
  FileReference,
  ServiceStatus,
} from "./base.types";
import { ModerationStatus } from "./base.types";
import { Category } from "./category.types";

export interface Service extends BaseEntity, SoftDeletable {
  title: string;
  description: string;
  priceDescription?: string;
  priceBasedOnServiceType: boolean;
  categoryId: Types.ObjectId;
  images: FileReference[];

  isPopular: boolean;
  status: ServiceStatus;
  tags: string[];

  basePrice?: number;
  priceRange?: {
    min: number;
    max: number;
    currency: string;
  };

  slug: string;
  metaDescription?: string;

  submittedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  moderationNotes?: string;
}

export interface ServiceFilters {
  categoryId?: Types.ObjectId;
  status?: ServiceStatus[];
  popular?: boolean;
  search?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  location?: {
    ghanaPostGPS?: string;
    region?: string;
    city?: string;
    radius?: number;
  };
  rating?: number;
  moderationStatus?: ModerationStatus[];
}

// Service with populated category details
export interface ServiceWithCategory extends Service {
  category: Pick<Category, "_id" | "name">;
}

// Common query parameters for services
export interface ServiceQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  categoryId?: string;
  status?: ServiceStatus;
  popular?: boolean;
}

