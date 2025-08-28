// controllers/idDetails.controller.ts
import { Request, Response } from "express";
import { Profile } from "../models/profile.model.js";
import { User } from "../models/user.model.js";
import { AuthenticatedRequest, IUser } from "../types/user.types.js";
import { IdDetails, FileReference, idType } from "../types/base.types.js";
import { IUserProfile } from "../types/profile.types.js";

// ===================================================================
// TYPES AND INTERFACES
// ===================================================================

interface IdDetailsResponse {
  message: string;
  user?: Partial<IUser>;
  profile?: Partial<IUserProfile>;
  idDetails?: IdDetails;
  hasIdDetails?: boolean;
  validation?: ValidationResult;
  error?: string;
}

interface UpdateIdDetailsRequestBody {
  idDetails: Partial<IdDetails>;
}

interface ValidationResult {
  hasIdDetails: boolean;
  isComplete: boolean;
  missing: string[];
  errors: string[];
}

interface AuditLog {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  field?: keyof IdDetails;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ===================================================================
// VALIDATION RULES - FIXED TO USE ENUM VALUES AS KEYS
// ===================================================================

const ID_FORMATS: Record<string, RegExp> = {
  [idType.NATIONAL_ID]: /^GHA-\d{9}-\d$/,
  [idType.PASSPORT]: /^G\d{7}$/,
  [idType.VOTERS_ID]: /^\d{10}$/,
  [idType.DRIVERS_LICENSE]: /^[A-Z]{2}\d{7}$/,
  [idType.NHIS]: /^\d{10}$/,
  [idType.OTHER]: /.+/ // Generic validation for other types
};

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  [idType.NATIONAL_ID]: ['image/jpeg', 'image/png', 'application/pdf'],
  [idType.PASSPORT]: ['image/jpeg', 'image/png'],
  [idType.VOTERS_ID]: ['image/jpeg', 'image/png', 'application/pdf'],
  [idType.DRIVERS_LICENSE]: ['image/jpeg', 'image/png'],
  [idType.NHIS]: ['image/jpeg', 'image/png', 'application/pdf'],
  [idType.OTHER]: ['image/jpeg', 'image/png', 'application/pdf', 'image/webp', 'image/tiff']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ID_NUMBER_LENGTH = 50;

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

const asyncHandler = (fn: Function) => (req: Request, res: Response) => 
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error("ID Details Controller error:", error);
    res.status(error?.name === "ValidationError" ? 400 : 500).json({
      message: error?.name === "ValidationError" ? "Validation error" : "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });

const validateAuth = (req: AuthenticatedRequest, res: Response): string | null => {
  if (!req.userId) {
    res.status(401).json({ message: "User ID not found in request" });
    return null;
  }
  return req.userId;
};

const createResponse = (
  user: IUser | null, 
  profile: any, 
  message: string, 
  additionalData: any = {}
): IdDetailsResponse => ({
  message,
  user: user ? {
    _id: user._id,
    email: user.email,
    name: user.name,
    displayName: user.displayName
  } : undefined,
  profile: profile ? {
    _id: profile._id,
    userId: profile.userId,
    idDetails: profile.idDetails,
    completeness: profile.completeness,
    lastModified: profile.lastModified
  } : undefined,
  ...additionalData,
});

const findUserAndProfile = async (userId: string) => Promise.all([
  User.findById(userId).lean() as Promise<IUser | null>,
  Profile.findOne({ userId }).lean() as Promise<IUserProfile | null>,
]);

// ===================================================================
// VALIDATION FUNCTIONS - FIXED
// ===================================================================

const validateIdNumber = (idTypeValue: string, idNumber: string): string[] => {
  const errors: string[] = [];
  
  if (!idNumber?.trim()) {
    errors.push("ID number is required");
    return errors;
  }
  
  if (idNumber.trim().length > MAX_ID_NUMBER_LENGTH) {
    errors.push(`ID number cannot exceed ${MAX_ID_NUMBER_LENGTH} characters`);
  }
  
  // Check if the idType exists in our formats
  const format = ID_FORMATS[idTypeValue];
  if (!format) {
    errors.push(`Unsupported ID type: ${idTypeValue}`);
    return errors;
  }
  
  if (!format.test(idNumber.trim())) {
    errors.push(`Invalid ${idTypeValue} number format`);
  }
  
  return errors;
};

const validateIdFile = (idTypeValue: string, idFile: FileReference): string[] => {
  const errors: string[] = [];
  
  if (!idFile?.url?.trim()) errors.push("ID file URL is required");
  if (!idFile?.fileName?.trim()) errors.push("ID file name is required");
  
  if (idFile?.fileSize && idFile.fileSize > MAX_FILE_SIZE) {
    errors.push(`ID file size cannot exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  
  const allowedTypes = ALLOWED_FILE_TYPES[idTypeValue];
  if (idFile?.mimeType && allowedTypes && !allowedTypes.includes(idFile.mimeType)) {
    errors.push(`Invalid file format for ${idTypeValue}. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  return errors;
};

const validateIdDetails = (idDetails: Partial<IdDetails>): ValidationResult => {
  const result: ValidationResult = {
    hasIdDetails: !!idDetails,
    isComplete: false,
    missing: [],
    errors: []
  };
  
  if (!idDetails) {
    result.missing = ['idType', 'idNumber', 'idFile'];
    return result;
  }
  
  // Check required fields
  if (!idDetails.idType) result.missing.push('idType');
  if (!idDetails.idNumber) result.missing.push('idNumber');
  if (!idDetails.idFile) result.missing.push('idFile');
  
  // Validate enum - check if the value exists in the idType enum
  if (idDetails.idType && !Object.values(idType).includes(idDetails.idType as idType)) {
    result.errors.push('Invalid ID type');
  }
  
  // Cross-validate type with number and file
  if (idDetails.idType && idDetails.idNumber) {
    result.errors.push(...validateIdNumber(idDetails.idType, idDetails.idNumber));
  }
  
  if (idDetails.idType && idDetails.idFile) {
    result.errors.push(...validateIdFile(idDetails.idType, idDetails.idFile));
  }
  
  result.isComplete = result.missing.length === 0 && result.errors.length === 0;
  return result;
};

// ===================================================================
// AUDIT LOGGING
// ===================================================================

const logAuditEvent = async (
  req: AuthenticatedRequest,
  action: AuditLog['action'],
  field?: keyof IdDetails,
  oldValue?: any,
  newValue?: any
): Promise<void> => {
  try {
    const auditLog: AuditLog = {
      userId: req.userId!,
      action,
      field,
      oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
      newValue: newValue ? JSON.stringify(newValue) : undefined,
      timestamp: new Date(),
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    // TODO: Save to audit log collection/service
    console.log('ID Details Audit:', auditLog);
    
    // Example: await AuditLog.create(auditLog);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// ===================================================================
// CONTROLLER FUNCTIONS
// ===================================================================

/**
 * Update ID details (supports full or partial updates)
 * @route PUT /api/id-details
 */
export const updateIdDetails = asyncHandler(
  async (req: Request<{}, IdDetailsResponse, UpdateIdDetailsRequestBody> & AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { idDetails: newIdDetails } = req.body;
    if (!newIdDetails) {
      return res.status(400).json({ 
        message: "ID details are required", 
        error: "Missing idDetails in request body" 
      });
    }

    const [user, profile] = await findUserAndProfile(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentIdDetails = profile?.idDetails;
    const mergedIdDetails = { ...currentIdDetails, ...newIdDetails };

    // Validate the merged result
    const validation = validateIdDetails(mergedIdDetails);
    if (!validation.isComplete) {
      return res.status(400).json({
        message: "Validation failed",
        error: [...validation.missing.map(m => `Missing: ${m}`), ...validation.errors].join(', '),
        validation
      });
    }

    // Prepare final data
    const finalIdDetails: IdDetails = {
      idType: mergedIdDetails.idType!,
      idNumber: mergedIdDetails.idNumber!.trim(),
      idFile: {
        ...mergedIdDetails.idFile!,
        uploadedAt: mergedIdDetails.idFile!.uploadedAt || new Date()
      }
    };

    // Update profile
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      { $set: { idDetails: finalIdDetails, lastModified: new Date() } },
      { new: true, runValidators: true, upsert: true, lean: true }
    );

    // Log audit event
    await logAuditEvent(req, currentIdDetails ? 'UPDATE' : 'CREATE', undefined, currentIdDetails, finalIdDetails);

    res.status(200).json(createResponse(user, updatedProfile, "ID details updated successfully", { idDetails: finalIdDetails }));
  }
);

/**
 * Update specific ID field
 * @route PUT /api/id-details/:field
 */
export const updateIdField = asyncHandler(
  async (req: Request<{ field: keyof IdDetails }, IdDetailsResponse, { value: any }> & AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { field } = req.params;
    const { value } = req.body;
    
    const allowedFields: (keyof IdDetails)[] = ['idType', 'idNumber', 'idFile'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        message: `Invalid field. Allowed fields: ${allowedFields.join(', ')}`
      });
    }

    const [user, profile] = await findUserAndProfile(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!profile?.idDetails) {
      return res.status(404).json({ message: "Please create complete ID details first" });
    }

    const oldValue = profile.idDetails[field];
    const updatedIdDetails = { ...profile.idDetails, [field]: value };

    // Validate the updated details
    const validation = validateIdDetails(updatedIdDetails);
    if (!validation.isComplete) {
      return res.status(400).json({
        message: "Validation failed",
        error: validation.errors.join(', ')
      });
    }

    // Update profile
    const result = await Profile.findOneAndUpdate(
      { userId },
      { $set: { [`idDetails.${field}`]: value, lastModified: new Date() } },
      { new: true, runValidators: true, lean: true }
    );

    // Log audit event
    await logAuditEvent(req, 'UPDATE', field, oldValue, value);

    res.status(200).json(createResponse(user, result, `ID ${field} updated successfully`));
  }
);

/**
 * Get ID details
 * @route GET /api/id-details
 */
export const getIdDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const profile = await Profile.findOne({ userId }).lean() as IUserProfile | null;
    
    // Log audit event
    await logAuditEvent(req, 'VIEW');

    if (!profile?.idDetails) {
      return res.status(200).json({
        message: "No ID details found",
        hasIdDetails: false
      });
    }

    res.status(200).json({
      message: "ID details retrieved successfully",
      idDetails: profile.idDetails,
      hasIdDetails: true
    });
  }
);

/**
 * Remove ID details
 * @route DELETE /api/id-details
 */
export const removeIdDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const [user, profile] = await findUserAndProfile(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldIdDetails = profile?.idDetails;

    const updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      { $unset: { idDetails: 1 }, $set: { lastModified: new Date() } },
      { new: true, lean: true }
    );

    // Log audit event
    await logAuditEvent(req, 'DELETE', undefined, oldIdDetails, null);

    res.status(200).json(createResponse(user, updatedProfile, "ID details removed successfully"));
  }
);

/**
 * Validate ID details
 * @route GET /api/id-details/validate
 */
export const validateIdDetailsEndpoint = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const profile = await Profile.findOne({ userId }).lean() as IUserProfile | null;
    const validation = validateIdDetails(profile?.idDetails ?? {});

    res.status(200).json({
      message: "ID details validation completed",
      validation,
      hasIdDetails: validation.hasIdDetails
    });
  }
);

/**
 * Get ID details summary (without sensitive data)
 * @route GET /api/id-details/summary
 */
export const getIdDetailsSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const profile = await Profile.findOne({ userId }).lean() as IUserProfile | null;

    if (!profile?.idDetails) {
      return res.status(200).json({
        message: "No ID details found",
        hasIdDetails: false
      });
    }

    const summary = {
      idType: profile.idDetails.idType,
      hasIdNumber: !!profile.idDetails.idNumber,
      hasIdFile: !!profile.idDetails.idFile,
      fileType: profile.idDetails.idFile?.mimeType,
      uploadedAt: profile.idDetails.idFile?.uploadedAt,
    };

    res.status(200).json({
      message: "ID details summary retrieved successfully",
      idDetails: summary as any,
      hasIdDetails: true
    });
  }
);