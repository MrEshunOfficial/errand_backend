// types/safety.types.ts
import { Types } from "mongoose";
import { BaseEntity, FileReference, UserLocation } from "./base.types";

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
  location?: UserLocation;

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
