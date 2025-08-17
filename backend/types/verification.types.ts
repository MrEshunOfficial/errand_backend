// types/verification.types.ts
import { Types } from "mongoose";
import { BaseEntity, VerificationStatus } from "./base.types";

export interface UserVerification extends BaseEntity {
  userId: Types.ObjectId;
  overallStatus: VerificationStatus;

  // Email verification (basic)
  emailVerified: boolean;
  emailVerifiedAt?: Date;

  // Document verification
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

  // Identity verification steps
  verificationSteps: {
    emailVerification: VerificationStatus;
    identityVerification: VerificationStatus;
    addressVerification: VerificationStatus;
    phoneVerification: VerificationStatus;
  };

  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationNotes?: string;
  nextReviewDate?: Date;
}

// Request/Response types for verification operations
export interface CreateVerificationRequestBody
  extends Omit<UserVerification, "_id" | "createdAt" | "updatedAt"> {}

export interface UpdateVerificationRequestBody
  extends Partial<
    Omit<UserVerification, "_id" | "createdAt" | "updatedAt" | "userId">
  > {}

export interface VerificationResponse {
  message: string;
  verification?: Partial<UserVerification>;
  error?: string;
}
