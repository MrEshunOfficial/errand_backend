// types/service-request.types.ts
import { Types } from "mongoose";
import {
  BaseEntity,
  SoftDeletable,
  RequestStatus,
  UserLocation,
  FileReference,
  ServiceUser,
} from "./base.types";
import { Category } from "./category.types";
import { Service } from "./service.types";
import { SafetyIncident } from "./safety.types";
import { Review } from "./review.types";

export interface ServiceRequest extends BaseEntity, SoftDeletable {
  requestNumber: string;

  clientId: Types.ObjectId;
  providerId?: Types.ObjectId;
  serviceId: Types.ObjectId;

  status: RequestStatus;
  scheduledDate?: Date;

  serviceAddress: UserLocation;

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

export interface ServiceRequestWithDetails extends ServiceRequest {
  client: Pick<ServiceUser, "_id" | "fullName" | "contactInfo">;
  provider?: Pick<ServiceUser, "_id" | "fullName" | "contactInfo">;
  service: Pick<Service, "_id" | "title" | "categoryId" | "status"> & {
    category: Pick<Category, "_id" | "name">;
  };
  reviews?: Review[];
  incidents?: SafetyIncident[];
}
