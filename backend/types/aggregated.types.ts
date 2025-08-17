// types/aggregated.types.ts
import {
  IUser,
  IUserProfile,
  ClientProfile,
  ProviderProfile,
  UserVerification,
  DomainProfile,
  UserWarning,
  UserRole,
  SystemRole,
  UserStatus,
  VerificationStatus,
  ModerationStatus,
  AuthProvider,
  Service,
  ServiceWithCategory,
  Category,
  ServiceStatus,
} from "./index";

// Combined user with profile for convenience
export interface UserWithProfile {
  user: IUser;
  profile?: IUserProfile;
  verification?: UserVerification;
  domainProfiles?: DomainProfile[];
  activeWarnings?: UserWarning[];
  clientProfile?: ClientProfile;
  providerProfile?: ProviderProfile;
}

// Pagination support
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
}

// User filters for search/admin
export interface UserFilters {
  role?: UserRole[];
  systemRole?: SystemRole[];
  status?: UserStatus[];
  verificationStatus?: VerificationStatus[];
  moderationStatus?: ModerationStatus[];
  provider?: AuthProvider[];
  search?: string;
  location?: {
    region?: string;
    city?: string;
    district?: string;
  };
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  hasActiveWarnings?: boolean;
}

// Common query parameters
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

// Common response structure
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

// Combined user with profile for convenience
export interface UserWithProfile {
  user: IUser;
  profile?: IUserProfile;
  verification?: UserVerification;
  domainProfiles?: DomainProfile[];
  activeWarnings?: UserWarning[];
  clientProfile?: ClientProfile;
  providerProfile?: ProviderProfile;
}

// Service with additional aggregated data
export interface ServiceWithDetails extends ServiceWithCategory {
  totalBookings?: number;
  averageRating?: number;
  reviewCount?: number;
  isBookmarked?: boolean;
  availableProviders?: number;
}

// Category with service count
export interface CategoryWithStats extends Category {
  serviceCount: number;
  activeServiceCount: number;
  popularServices?: Service[];
}

// Pagination support
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
}

// User filters for search/admin
export interface UserFilters {
  role?: UserRole[];
  systemRole?: SystemRole[];
  status?: UserStatus[];
  verificationStatus?: VerificationStatus[];
  moderationStatus?: ModerationStatus[];
  provider?: AuthProvider[];
  search?: string;
  location?: {
    region?: string;
    city?: string;
    district?: string;
  };
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  hasActiveWarnings?: boolean;
}

// Category filters
export interface CategoryFilters {
  isActive?: boolean;
  moderationStatus?: ModerationStatus[];
  parentCategoryId?: string;
  search?: string;
  hasServices?: boolean;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

// Combined filters for service marketplace
export interface ServiceMarketplaceFilters {
  services?: {
    categoryId?: string;
    status?: ServiceStatus[];
    popular?: boolean;
    search?: string;
    priceRange?: {
      min?: number;
      max?: number;
    };
    rating?: number;
  };
  categories?: CategoryFilters;
  location?: {
    ghanaPostGPS?: string;
    region?: string;
    city?: string;
    district?: string;
    radius?: number;
  };
}

// Common query parameters
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
}

// Enhanced query parameters for services
export interface ServiceQueryParams extends QueryParams {
  categoryId?: string;
  status?: ServiceStatus;
  popular?: boolean;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  radius?: number;
}

// Common response structure
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

// Dashboard stats for admin
export interface ServiceMarketplaceDashboard {
  totalServices: number;
  activeServices: number;
  totalCategories: number;
  activeCategories: number;
  totalBookings: number;
  recentServices: Service[];
  popularCategories: CategoryWithStats[];
  servicesByStatus: Record<ServiceStatus, number>;
  moderationQueue: {
    services: number;
    categories: number;
  };
}
