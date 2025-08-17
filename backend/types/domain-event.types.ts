// types/domain-event.types.ts
import { Types } from "mongoose";
import { BaseEntity } from "./base.types";

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

// Request/Response types for domain event operations
export interface CreateDomainEventRequestBody
  extends Omit<DomainEvent, "_id" | "createdAt" | "updatedAt"> {}

export interface DomainEventResponse {
  message: string;
  event?: Partial<DomainEvent>;
  error?: string;
}
