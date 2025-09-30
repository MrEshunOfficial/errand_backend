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
import { ProviderProfile } from "./provider-profile.types";  // Added import for ProviderProfile

export interface Service extends BaseEntity, SoftDeletable {
  title: string;
  description: string;
  priceDescription?: string;
  priceBasedOnServiceType: boolean;
  categoryId: Types.ObjectId;
  images: FileReference[];
  providerCount?: number;
  providers?: Types.ObjectId[];
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
  // Added provider-specific filters
  providerId?: Types.ObjectId;
  providerLocation?: {
    ghanaPostGPS?: string;
    region?: string;
    city?: string;
    radius?: number;
  };
  providerRating?: number;
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
  //provider-related query params
  includeProviders?: boolean;
  providerSort?: string;
}

//Populated interface for providers
export type ProviderSummary = Pick<ProviderProfile, "_id" | "businessName" | "providerContactInfo" | "performanceMetrics"> & {
  serviceCount?: number;
};

export interface ServiceWithProviders extends Omit<Service, 'providers'> {
  providers: ProviderSummary[];
}

// Added: Fully populated version combining category and providers
export interface ServiceWithDetails extends Omit<ServiceWithCategory, 'providers'> {
  providers: ProviderSummary[];
}