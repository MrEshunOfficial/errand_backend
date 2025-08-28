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
  idDetails: IdDetails;
}

interface UpdateIdTypeRequestBody {
  idType: idType;
}

interface UpdateIdNumberRequestBody {
  idNumber: string;
}

interface UpdateIdFileRequestBody {
  idFile: FileReference;
}

interface ValidationResult {
  hasIdDetails: boolean;
  isComplete: boolean;
  missing: string[];
  errors: string[];
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

const createCleanUserResponse = (user: IUser): Partial<IUser> => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  systemAdminName: user.systemAdminName,
  systemRole: user.systemRole,
  provider: user.provider,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  isVerified: user.isVerified,
  isAdmin: user.isAdmin,
  isSuperAdmin: user.isSuperAdmin,
  updatedAt: user.updatedAt,
  status: user.status,
  displayName: user.displayName,
});

const createCleanProfileResponse = (
  profile: any
): Partial<IUserProfile> | null => {
  if (!profile) return null;
  const profileObj = profile.toObject ? profile.toObject() : profile;
  return {
    _id: profileObj._id,
    userId: profileObj.userId,
    role: profileObj.role,
    bio: profileObj.bio,
    location: profileObj.location,
    preferences: profileObj.preferences,
    socialMediaHandles: profileObj.socialMediaHandles,
    contactDetails: profileObj.contactDetails,
    idDetails: profileObj.idDetails,
    profilePicture: profileObj.profilePicture,
    verificationStatus: profileObj.verificationStatus,
    moderationStatus: profileObj.moderationStatus,
    warningsCount: profileObj.warningsCount,
    completeness: profileObj.completeness,
    isActiveInMarketplace: profileObj.isActiveInMarketplace,
    createdAt: profileObj.createdAt,
    updatedAt: profileObj.updatedAt,
    lastModified: profileObj.lastModified,
    isDeleted: profileObj.isDeleted,
    deletedAt: profileObj.deletedAt,
    deletedBy: profileObj.deletedBy,
  };
};

const asyncHandler = (fn: Function) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error("ID Details Controller error:", error);
    const isValidationError = error?.name === "ValidationError";
    res.status(isValidationError ? 400 : 500).json({
      message: isValidationError ? "Validation error" : "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });
};

const validateAuth = (
  req: AuthenticatedRequest,
  res: Response
): string | null => {
  if (!req.userId) {
    res.status(401).json({ message: "User ID not found in request" });
    return null;
  }
  return req.userId;
};

const createSuccessResponse = (
  user: IUser | null,
  profile: any,
  message: string,
  additionalData: any = {}
): IdDetailsResponse => ({
  message,
  user: user ? createCleanUserResponse(user) : undefined,
  profile: createCleanProfileResponse(profile),
  ...additionalData,
});

const findUserAndProfile = async (userId: string) => {
  return Promise.all([
    User.findById(userId).lean() as Promise<IUser | null>,
    Profile.findOne({ userId }).lean() as Promise<IUserProfile | null>,
  ]);
};

const validateIdFileStructure = (idFile: FileReference): string[] => {
  const errors: string[] = [];

  if (!idFile.url || !idFile.url.trim()) {
    errors.push("ID file URL is required");
  }

  if (!idFile.fileName || !idFile.fileName.trim()) {
    errors.push("ID file name is required");
  }

  // File size validation (10MB limit)
  const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
  if (idFile.fileSize && idFile.fileSize > maxFileSize) {
    errors.push("ID file size cannot exceed 10MB");
  }

  // MIME type validation
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "image/tiff",
  ];
  if (idFile.mimeType && !allowedMimeTypes.includes(idFile.mimeType)) {
    errors.push(
      "Invalid file format. Only JPEG, PNG, WebP, PDF, and TIFF files are allowed"
    );
  }

  return errors;
};

// ===================================================================
// CONTROLLER FUNCTIONS
// ===================================================================

/**
 * Update complete ID details (type, number, and file)
 * @route PUT /api/id-details
 */
export const updateIdDetails = asyncHandler(
  async (
    req: Request<{}, IdDetailsResponse, UpdateIdDetailsRequestBody> &
      AuthenticatedRequest,
    res: Response<IdDetailsResponse>
  ) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { idDetails } = req.body;

    if (!idDetails) {
      return res.status(400).json({
        message: "ID details are required",
        error: "Missing idDetails in request body",
      });
    }

    // Validate required fields
    if (!idDetails.idType || !idDetails.idNumber || !idDetails.idFile) {
      return res.status(400).json({
        message: "ID type, ID number, and ID file are all required",
        error: "Incomplete idDetails object",
      });
    }

    // Validate ID type
    if (!Object.values(idType).includes(idDetails.idType)) {
      return res.status(400).json({
        message: `Invalid ID type. Must be one of: ${Object.values(idType).join(
          ", "
        )}`,
        error: "Invalid idType value",
      });
    }

    // Validate ID number
    if (!idDetails.idNumber.trim() || idDetails.idNumber.trim().length > 50) {
      return res.status(400).json({
        message: "ID number must be provided and cannot exceed 50 characters",
        error: "Invalid idNumber",
      });
    }

    // Validate ID file structure
    const fileValidationErrors = validateIdFileStructure(idDetails.idFile);
    if (fileValidationErrors.length > 0) {
      return res.status(400).json({
        message: "ID file validation failed",
        error: fileValidationErrors.join(", "),
      });
    }

    // Set upload timestamp if not provided
    const idDetailsData: IdDetails = {
      ...idDetails,
      idNumber: idDetails.idNumber.trim(),
      idFile: {
        ...idDetails.idFile,
        uploadedAt: idDetails.idFile.uploadedAt || new Date(),
      },
    };

    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            idDetails: idDetailsData,
            lastModified: new Date(),
          },
        },
        { new: true, runValidators: true, upsert: true, lean: true }
      ),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: "User does not exist",
      });
    }

    res
      .status(200)
      .json(
        createSuccessResponse(
          user,
          profile,
          "ID details updated successfully",
          { idDetails: idDetailsData }
        )
      );
  }
);

/**
 * Update only the ID type
 * @route PUT /api/id-details/type
 */
export const updateIdType = asyncHandler(
  async (
    req: Request<{}, IdDetailsResponse, UpdateIdTypeRequestBody> &
      AuthenticatedRequest,
    res: Response<IdDetailsResponse>
  ) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { idType: newIdType } = req.body;

    if (!newIdType || !Object.values(idType).includes(newIdType)) {
      return res.status(400).json({
        message: `Invalid ID type. Must be one of: ${Object.values(idType).join(
          ", "
        )}`,
        error: "Invalid idType value",
      });
    }

    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            "idDetails.idType": newIdType,
            lastModified: new Date(),
          },
        },
        { new: true, runValidators: true, lean: true }
      ),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: "User does not exist",
      });
    }

    if (!profile?.idDetails) {
      return res.status(404).json({
        message: "Profile not found or ID details not initialized",
        error: "Please create complete ID details first",
      });
    }

    res
      .status(200)
      .json(
        createSuccessResponse(user, profile, "ID type updated successfully")
      );
  }
);

/**
 * Update only the ID number
 * @route PUT /api/id-details/number
 */
export const updateIdNumber = asyncHandler(
  async (
    req: Request<{}, IdDetailsResponse, UpdateIdNumberRequestBody> &
      AuthenticatedRequest,
    res: Response<IdDetailsResponse>
  ) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { idNumber } = req.body;

    if (!idNumber || !idNumber.trim()) {
      return res.status(400).json({
        message: "ID number is required and cannot be empty",
        error: "Missing or empty idNumber",
      });
    }

    if (idNumber.trim().length > 50) {
      return res.status(400).json({
        message: "ID number cannot exceed 50 characters",
        error: "idNumber too long",
      });
    }

    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            "idDetails.idNumber": idNumber.trim(),
            lastModified: new Date(),
          },
        },
        { new: true, runValidators: true, lean: true }
      ),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: "User does not exist",
      });
    }

    if (!profile?.idDetails) {
      return res.status(404).json({
        message: "Profile not found or ID details not initialized",
        error: "Please create complete ID details first",
      });
    }

    res
      .status(200)
      .json(
        createSuccessResponse(user, profile, "ID number updated successfully")
      );
  }
);

/**
 * Update only the ID file
 * @route PUT /api/id-details/file
 */
export const updateIdFile = asyncHandler(
  async (
    req: Request<{}, IdDetailsResponse, UpdateIdFileRequestBody> &
      AuthenticatedRequest,
    res: Response<IdDetailsResponse>
  ) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const { idFile } = req.body;

    if (!idFile) {
      return res.status(400).json({
        message: "ID file data is required",
        error: "Missing idFile in request body",
      });
    }

    // Validate ID file structure
    const fileValidationErrors = validateIdFileStructure(idFile);
    if (fileValidationErrors.length > 0) {
      return res.status(400).json({
        message: "ID file validation failed",
        error: fileValidationErrors.join(", "),
      });
    }

    // Set upload timestamp if not provided
    const idFileData: FileReference = {
      ...idFile,
      uploadedAt: idFile.uploadedAt || new Date(),
    };

    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            "idDetails.idFile": idFileData,
            lastModified: new Date(),
          },
        },
        { new: true, runValidators: true, lean: true }
      ),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: "User does not exist",
      });
    }

    if (!profile?.idDetails) {
      return res.status(404).json({
        message: "Profile not found or ID details not initialized",
        error: "Please create complete ID details first",
      });
    }

    res.status(200).json(
      createSuccessResponse(user, profile, "ID file updated successfully", {
        idFile: idFileData,
      })
    );
  }
);

/**
 * Get current ID details
 * @route GET /api/id-details
 */
export const getIdDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const profile = (await Profile.findOne({
      userId,
    }).lean()) as IUserProfile | null;

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
        hasIdDetails: false,
        error: "Profile does not exist",
      });
    }

    if (!profile.idDetails) {
      return res.status(200).json({
        message: "No ID details found",
        hasIdDetails: false,
      });
    }

    res.status(200).json({
      message: "ID details retrieved successfully",
      idDetails: profile.idDetails,
      hasIdDetails: true,
    });
  }
);

/**
 * Remove ID details (soft removal by setting to undefined)
 * @route DELETE /api/id-details
 */
export const removeIdDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const [user, profile] = await Promise.all([
      User.findById(userId).lean() as Promise<IUser | null>,
      Profile.findOneAndUpdate(
        { userId },
        {
          $unset: { idDetails: 1 },
          $set: { lastModified: new Date() },
        },
        { new: true, lean: true }
      ),
    ]);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        error: "User does not exist",
      });
    }

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
        error: "Profile does not exist",
      });
    }

    res
      .status(200)
      .json(
        createSuccessResponse(user, profile, "ID details removed successfully")
      );
  }
);

/**
 * Validate ID details completeness and correctness
 * @route GET /api/id-details/validate
 */
export const validateIdDetails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response<IdDetailsResponse>) => {
    const userId = validateAuth(req, res);
    if (!userId) return;

    const profile = (await Profile.findOne({
      userId,
    }).lean()) as IUserProfile | null;

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
        error: "Profile does not exist",
      });
    }

    const validation: ValidationResult = {
      hasIdDetails: !!profile.idDetails,
      isComplete: false,
      missing: [],
      errors: [],
    };

    if (!profile.idDetails) {
      validation.missing = ["idType", "idNumber", "idFile"];
    } else {
      const { idType, idNumber, idFile } = profile.idDetails;

      // Check for missing fields
      if (!idType) validation.missing.push("idType");
      if (!idNumber) validation.missing.push("idNumber");
      if (!idFile) {
        validation.missing.push("idFile");
      } else {
        // Validate file structure
        const fileErrors = validateIdFileStructure(idFile);
        validation.errors.push(...fileErrors);
      }

      // Validate ID type enum
      if (idType && !Object.values(idType).includes(idType)) {
        validation.errors.push("Invalid ID type");
      }

      // Validate ID number
      if (idNumber && (!idNumber.trim() || idNumber.trim().length > 50)) {
        validation.errors.push("Invalid ID number format or length");
      }

      validation.isComplete =
        validation.missing.length === 0 && validation.errors.length === 0;
    }

    res.status(200).json({
      message: "ID details validation completed",
      validation,
      hasIdDetails: validation.hasIdDetails,
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

    const profile = (await Profile.findOne({
      userId,
    }).lean()) as IUserProfile | null;

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
        hasIdDetails: false,
        error: "Profile does not exist",
      });
    }

    if (!profile.idDetails) {
      return res.status(200).json({
        message: "No ID details found",
        hasIdDetails: false,
      });
    }

    // Return summary without sensitive information
    const summary = {
      idType: profile.idDetails.idType,
      hasIdNumber: !!profile.idDetails.idNumber,
      hasIdFile: !!profile.idDetails.idFile,
      fileType: profile.idDetails.idFile?.mimeType,
      uploadedAt: profile.idDetails.idFile?.uploadedAt,
    };

    res.status(200).json({
      message: "ID details summary retrieved successfully",
      idDetails: summary as any, // Type assertion for response compatibility
      hasIdDetails: true,
    });
  }
);
