import { Types } from "mongoose";
import { Request, Response } from "express";
import { SystemRole } from "../../types/base.types";
// Extended request interface to include authenticated user
export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// Utility function for error handling
export const handleError = (
  res: Response,
  error: any,
  message: string = "Internal server error"
) => {
  console.error(error);
  return res.status(500).json({
    success: false,
    message,
    error: error.message || error,
  });
};

// Utility function for validation
export const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

// Helper function to check if email is super admin
export const isSuperAdminEmail = (email: string): boolean => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) {
    return false;
  }
  return email.toLowerCase() === superAdminEmail.toLowerCase();
};

// Helper function to apply super admin properties
export const applySuperAdminProperties = (userDoc: any) => {
  userDoc.systemRole = SystemRole.SUPER_ADMIN;
  userDoc.systemAdminName = process.env.SUPER_ADMIN_NAME;
  userDoc.isSuperAdmin = true;
  userDoc.isAdmin = true;
  userDoc.isVerified = true;
  return userDoc;
};