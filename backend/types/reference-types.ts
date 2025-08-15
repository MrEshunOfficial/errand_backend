import { Types } from "mongoose";

export interface BaseEntity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeletable {
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface GhanaAddress {
  ghanaPostGPS: string;
  region: string;
  city: string;
  district: string;
  locality?: string;
  nearbyLandmark?: string;
  traditionalAddress?: string;
}

export interface ContactInfo {
  primaryPhone: string;
  secondaryPhone?: string;
  email: string;
}

export interface ProviderContactInfo extends ContactInfo {
  emergencyContact: string;
  businessPhone?: string;
}

export interface FileReference {
  url: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: Date;
}

export interface IdVerification {
  idType: string;
  idNumber: string;
  idDocument: FileReference;
}

export interface SocialMediaHandle {
  platform: string;
  username: string;
  url?: string;
}

export enum AuthProvider {
  CREDENTIALS = "credentials",
  GOOGLE = "google",
  APPLE = "apple",
}

export enum SystemRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  BLOCKED = "blocked",
  INACTIVE = "inactive",
}

export enum MarketplaceRole {
  CLIENT = "client",
  PROVIDER = "provider",
}

export enum VerificationStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under-review",
  VERIFIED = "verified",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}

export enum ProviderOperationalStatus {
  PROBATIONARY = "probationary",
  ACTIVE = "active",
  RESTRICTED = "restricted",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

export enum RequestStatus {
  DRAFT = "draft",
  PENDING = "pending",
  PROVIDER_ASSIGNED = "provider-assigned",
  ACCEPTED = "accepted",
  MATERIALS_SOURCING = "materials-sourcing",
  EN_ROUTE = "en-route",
  ON_SITE = "on-site",
  IN_PROGRESS = "in-progress",
  WORK_COMPLETED = "work-completed",
  AWAITING_CONFIRMATION = "awaiting-confirmation",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
  REFUNDED = "refunded",
}

export enum ServiceStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending-approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

export enum ModerationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  HIDDEN = "hidden",
  FLAGGED = "flagged",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface CoreIdentity extends BaseEntity, SoftDeletable {
  email: string;
  emailVerified: boolean;

  password?: string;
  authProvider: AuthProvider;
  providerId?: string;

  systemRole: SystemRole;
  status: UserStatus;

  displayName: string;
  profileImage?: FileReference;

  lastLoginAt?: Date;
  loginCount: number;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;

  statusChangedBy?: Types.ObjectId;
  statusChangedAt?: Date;
  statusReason?: string;
}

export interface DomainProfile {
  identityId: Types.ObjectId;
  domain: "service_marketplace" | "other_feature";
  profileId: Types.ObjectId;
  isActive: boolean;
}

export interface ServiceUser extends BaseEntity, SoftDeletable {
  identityId: Types.ObjectId;
  serviceUserId: string;
  role: MarketplaceRole;

  fullName: string;
  contactInfo: ContactInfo;
  address: GhanaAddress;
  idVerification: IdVerification;

  profilePicture?: FileReference;
  socialMediaHandles?: SocialMediaHandle[];

  verificationStatus: VerificationStatus;
  isActiveInMarketplace: boolean;

  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };

  moderationStatus: ModerationStatus;
  lastModeratedBy?: Types.ObjectId;
  lastModeratedAt?: Date;
  moderationNotes?: string;
  warningsCount: number;
}

export interface ClientProfile extends BaseEntity, SoftDeletable {
  serviceUserId: Types.ObjectId;

  preferredServices?: Types.ObjectId[];
  preferredProviders?: Types.ObjectId[];

  defaultAddress?: GhanaAddress;
  paymentPreferences?: string[];

  riskLevel: RiskLevel;
  trustScore: number;
}

export interface ProviderProfile extends BaseEntity, SoftDeletable {
  serviceUserId: Types.ObjectId;

  providerContactInfo: ProviderContactInfo;

  operationalStatus: ProviderOperationalStatus;
  serviceOfferings: Types.ObjectId[];
  workingHours: Record<
    string,
    {
      start: string;
      end: string;
      isAvailable: boolean;
    }
  >;
  serviceRadius: number;
  isAvailableForWork: boolean;

  businessName?: string;
  businessRegistration?: {
    registrationNumber: string;
    registrationDocument: FileReference;
  };

  insurance?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    document: FileReference;
  };

  safetyMeasures: {
    requiresDeposit: boolean;
    depositAmount?: number;
    hasInsurance: boolean;
    insuranceProvider?: string;
    insuranceExpiryDate?: Date;
    emergencyContactVerified: boolean;
  };

  performanceMetrics: {
    completionRate: number;
    averageRating: number;
    totalJobs: number;
    responseTimeMinutes: number;
    averageResponseTime: number;
    cancellationRate: number;
    disputeRate: number;
    clientRetentionRate: number;
  };

  riskLevel: RiskLevel;
  lastRiskAssessmentDate?: Date;
  riskAssessedBy?: Types.ObjectId;
  penaltiesCount: number;
  lastPenaltyDate?: Date;
}

export interface ServiceUserVerification extends BaseEntity {
  serviceUserId: Types.ObjectId;
  overallStatus: VerificationStatus;

  documents: Array<{
    _id: Types.ObjectId;
    documentType: string;
    documentUrl: string;
    fileName: string;
    uploadedAt: Date;
    verifiedAt?: Date;
    verifiedBy?: Types.ObjectId;
    status: VerificationStatus;
    rejectionReason?: string;
  }>;

  witnessDetails: Array<{
    fullName: string;
    phone: string;
    idType: string;
    idNumber: string;
    relationship: string;
    verificationStatus: VerificationStatus;
    verifiedAt?: Date;
    verifiedBy?: Types.ObjectId;
  }>;

  verificationSteps: {
    identityVerification: VerificationStatus;
    addressVerification: VerificationStatus;
    skillVerification: VerificationStatus;
    backgroundCheck: VerificationStatus;
    witnessVerification: VerificationStatus;
  };

  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationNotes?: string;
  nextReviewDate?: Date;

  probationaryPeriod?: {
    startDate: Date;
    endDate: Date;
    maxJobsAllowed: number;
    maxJobValue: number;
    currentJobCount: number;
    requiresClientConfirmation: boolean;
    supervisionRequired: boolean;
  };
}

export interface Category extends BaseEntity, SoftDeletable {
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
}

export interface Service extends BaseEntity, SoftDeletable {
  title: string;
  description: string;
  categoryId: Types.ObjectId;

  images: FileReference[];

  isPopular: boolean;
  status: ServiceStatus;
  tags: string[];

  estimatedDuration?: number;
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

export interface ServiceRequest extends BaseEntity, SoftDeletable {
  requestNumber: string;

  clientId: Types.ObjectId;
  providerId?: Types.ObjectId;
  serviceId: Types.ObjectId;

  status: RequestStatus;
  scheduledDate?: Date;

  serviceAddress: GhanaAddress;

  pricing: {
    estimatedPrice?: number;
    quotedPrice?: number;
    finalPrice?: number;
    currency: string;
    priceBreakdown?: Array<{
      description: string;
      amount: number;
    }>;
  };

  timeline: {
    createdAt: Date;
    assignedAt?: Date;
    acceptedAt?: Date;
    startedAt?: Date;
    arrivedOnSiteAt?: Date;
    workCompletedAt?: Date;
    clientConfirmedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
  };

  clientNotes?: string;
  providerNotes?: string;

  cancellation?: {
    reason: string;
    cancelledBy: Types.ObjectId;
    cancelledAt: Date;
    refundAmount?: number;
    refundProcessedBy?: Types.ObjectId;
    refundProcessedAt?: Date;
  };

  dispute?: {
    status: "open" | "investigating" | "resolved" | "escalated";
    raisedBy: Types.ObjectId;
    raisedAt: Date;
    reason: string;
    evidence?: FileReference[];
    assignedAdmin?: Types.ObjectId;
    resolutionNotes?: string;
    resolvedBy?: Types.ObjectId;
    resolvedAt?: Date;
    resolution?: string;
  };

  safetyFlags: {
    requiresClientConfirmation: boolean;
    requiresDeposit: boolean;
    depositPaid: boolean;
    depositAmount?: number;
    hasInsurance: boolean;
    emergencyContactNotified: boolean;
    flaggedForReview: boolean;
    flagReason?: string;
  };

  progressUpdates: Array<{
    timestamp: Date;
    status: RequestStatus;
    message: string;
    images?: FileReference[];
    updatedBy: Types.ObjectId;
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;

  adminInterventions: Array<{
    actionType: string;
    performedBy: Types.ObjectId;
    performedAt: Date;
    reason: string;
    details?: string;
    previousStatus?: RequestStatus;
    newStatus?: RequestStatus;
  }>;

  metadata?: Record<string, unknown>;
}

export interface Review extends BaseEntity, SoftDeletable {
  requestId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  revieweeId: Types.ObjectId;
  serviceId: Types.ObjectId;

  rating: number;
  title?: string;
  comment?: string;
  images?: FileReference[];

  isVerifiedPurchase: boolean;
  helpfulVotes: number;
  reportCount: number;

  moderationStatus: ModerationStatus;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  moderationReason?: string;
  isHidden: boolean;

  response?: {
    comment: string;
    respondedAt: Date;
    respondedBy: Types.ObjectId;
  };
}

export interface UserRatingStats extends BaseEntity {
  userId: Types.ObjectId;
  userType: "client" | "provider";
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  lastUpdatedAt: Date;
}

export interface ProviderRiskAssessment extends BaseEntity {
  providerId: Types.ObjectId;
  riskLevel: RiskLevel;

  riskFactors: {
    newProvider: boolean;
    lowCompletionRate: boolean;
    highCancellationRate: boolean;
    recentComplaints: number;
    verificationGaps: string[];
    negativeReviews: number;
  };

  mitigationMeasures: {
    requiresDeposit: boolean;
    limitedJobValue: boolean;
    maxJobValue?: number;
    requiresSupervision: boolean;
    frequentCheckins: boolean;
    clientConfirmationRequired: boolean;
  };

  assessedBy: Types.ObjectId;
  nextAssessmentDate: Date;
  notes?: string;
}

export interface SafetyIncident extends BaseEntity {
  incidentType:
    | "property_damage"
    | "personal_injury"
    | "theft"
    | "harassment"
    | "fraud"
    | "other";
  severity: "low" | "medium" | "high" | "critical";

  requestId?: Types.ObjectId;
  reporterId: Types.ObjectId;
  involvedParties: Types.ObjectId[];

  description: string;
  evidence?: FileReference[];
  location?: GhanaAddress;

  status: "reported" | "investigating" | "resolved" | "escalated";
  assignedAdmin?: Types.ObjectId;

  resolution?: {
    outcome: string;
    actionsTaken: string[];
    penaltiesApplied?: Array<{
      userId: Types.ObjectId;
      penalty: string;
      amount?: number;
    }>;
    resolvedBy: Types.ObjectId;
    resolvedAt: Date;
  };

  followUpRequired: boolean;
  followUpDate?: Date;
}

export interface UserWarning extends BaseEntity {
  userId: Types.ObjectId;
  issuedBy: Types.ObjectId;
  warningType:
    | "policy_violation"
    | "poor_performance"
    | "safety_concern"
    | "misconduct";
  severity: "minor" | "major" | "severe";

  reason: string;
  details: string;
  evidence?: FileReference[];

  relatedIncidentId?: Types.ObjectId;
  relatedRequestId?: Types.ObjectId;

  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;

  expiresAt?: Date;
  isActive: boolean;
}

export interface UserWithServiceProfile {
  identity: CoreIdentity;
  serviceProfile?: ServiceUser;
  providerProfile?: ProviderProfile;
  clientProfile?: ClientProfile;
  domainProfiles: DomainProfile[];
  riskAssessment?: ProviderRiskAssessment;
  activeWarnings: UserWarning[];
}

export interface ServiceRequestWithDetails extends ServiceRequest {
  client: Pick<ServiceUser, "_id" | "fullName" | "contactInfo">;
  provider?: Pick<ServiceUser, "_id" | "fullName" | "contactInfo">;
  service: Pick<Service, "_id" | "title" | "categoryId" | "status"> & {
    category: Pick<Category, "_id" | "name">;
  };
  reviews?: Review[];
  incidents?: SafetyIncident[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
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

export interface ProviderFilters {
  serviceIds?: Types.ObjectId[];
  verificationStatus?: VerificationStatus[];
  operationalStatus?: ProviderOperationalStatus[];
  isAvailable?: boolean;
  location?: {
    ghanaPostGPS?: string;
    region?: string;
    city?: string;
    district?: string;
    radius?: number;
  };
  minRating?: number;
  riskLevel?: RiskLevel[];
  acceptsProbationary?: boolean;
  hasActiveWarnings?: boolean;
}

export interface DomainEvent extends BaseEntity {
  eventType: string;
  aggregateType: string;
  aggregateId: Types.ObjectId;
  version: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  causedBy?: Types.ObjectId;
  adminActionType?: string;
  performedBy?: Types.ObjectId;
}
