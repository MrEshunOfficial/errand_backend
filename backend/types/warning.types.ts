// types/warning.types.ts
import { Types } from "mongoose";
import { BaseEntity, FileReference } from "./base.types";

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

  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;

  expiresAt?: Date;
  isActive: boolean;
}

// Request/Response types for warning operations
export interface CreateWarningRequestBody
  extends Omit<UserWarning, "_id" | "createdAt" | "updatedAt"> {}

export interface UpdateWarningRequestBody
  extends Partial<
    Omit<UserWarning, "_id" | "createdAt" | "updatedAt" | "userId">
  > {}

export interface WarningResponse {
  message: string;
  warning?: Partial<UserWarning>;
  error?: string;
}
