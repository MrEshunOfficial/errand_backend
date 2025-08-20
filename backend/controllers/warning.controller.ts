// controllers/warning.controller.ts
import { Request, Response } from "express";
import mongoose, { PipelineStage } from "mongoose";
import { Profile } from "../models/profile.model.js";
import { User } from "../models/user.model.js";
import { RiskLevel } from "../types/base.types.js";
import { AuthenticatedRequest } from "../types/user.types.js";
import { WarningStatus, WarningStatusType, Warning, SeverityLevel, WarningCategory } from "../models/warning.models.js";
import { WarningResponse, UserWarning, CreateWarningRequestBody, UpdateWarningRequestBody } from "../types/warning.types.js";

// ===== UTILITY FUNCTIONS =====

const asyncHandler = (fn: Function) => (req: Request, res: Response, next?: any) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("Warning Controller Error:", error);
    const statusCode = error.name === "ValidationError" || error.name === "CastError" ? 400 : 500;
    res.status(statusCode).json({
      message: error.name === "ValidationError" ? "Validation error" : "Internal server error",
      error: error.message || "Unknown error",
    });
  });
};

const validateAuth = (req: AuthenticatedRequest, res: Response): string | null => {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  return req.userId;
};

const mapWarning = (warning: any) => ({
  _id: warning._id,
  userId: warning.userId,
  profileId: warning.profileId,
  issuedBy: warning.issuedBy,
  category: warning.category,
  severity: warning.severity,
  status: warning.status,
  reason: warning.reason,
  details: warning.details,
  evidence: warning.evidence,
  issuedAt: warning.issuedAt,
  expiresAt: warning.expiresAt,
  isActive: warning.isActive,
  acknowledgedBy: warning.acknowledgedBy,
  acknowledgedAt: warning.acknowledgedAt,
  resolvedBy: warning.resolvedBy,
  resolvedAt: warning.resolvedAt,
  notes: warning.notes,
  createdAt: warning.createdAt,
  updatedAt: warning.updatedAt,
  isAcknowledged: warning.isAcknowledged,
  isResolved: warning.isResolved,
  daysUntilExpiry: warning.daysUntilExpiry,
});

const createWarningResponse = (warning: any, message: string): WarningResponse => ({
  message,
  warning: warning ? mapWarning(warning) : undefined,
});

interface WarningListItem extends Partial<UserWarning> {
  user?: {
    _id: any;
    name: any;
    email: any;
    avatar: any;
  };
  issuer?: {
    _id: any;
    name: any;
    email: any;
  };
}

const mapWarningForList = (warning: any): WarningListItem => ({
  ...mapWarning(warning),
  user: warning.userId?.name ? {
    _id: warning.userId._id,
    name: warning.userId.name,
    email: warning.userId.email,
    avatar: warning.userId.avatar,
  } : undefined,
  issuer: warning.issuedBy?.name ? {
    _id: warning.issuedBy._id,
    name: warning.issuedBy.name,
    email: warning.issuedBy.email,
  } : undefined,
});

interface WarningListResponse {
  message: string;
  warnings: WarningListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    active: number;
    resolved: number;
    expired: number;
    acknowledged: number;
    unacknowledged: number;
  };
}

const createPaginatedResponse = (
  warnings: any[], 
  total: number, 
  page: number, 
  limit: number, 
  message: string,
  includeSummary = false
): WarningListResponse => {
  const response: WarningListResponse = {
    message,
    warnings: warnings.map(mapWarningForList),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  if (includeSummary) {
    response.summary = {
      active: warnings.filter(w => w.status === WarningStatus.ACTIVE).length,
      resolved: warnings.filter(w => w.status === WarningStatus.RESOLVED).length,
      expired: warnings.filter(w => w.status === WarningStatus.EXPIRED).length,
      acknowledged: warnings.filter(w => w.isAcknowledged).length,
      unacknowledged: warnings.filter(w => !w.isAcknowledged).length,
    };
  }

  return response;
};

const buildQuery = (queryParams: any, baseQuery: any = {}) => {
  const { status, severity, category, isActive } = queryParams;
  const query = { ...baseQuery };
  
  if (status && Object.values(WarningStatus).includes(status)) query.status = status;
  if (severity && Object.values(SeverityLevel).includes(severity)) query.severity = severity;
  if (category && Object.values(WarningCategory).includes(category)) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  
  return query;
};

const getPagination = (req: Request) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ===== CORE CRUD OPERATIONS =====

export const createWarning = asyncHandler(async (
  req: Request<{}, WarningResponse, CreateWarningRequestBody> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  const issuedBy = validateAuth(req, res);
  if (!issuedBy) return;

  const { userId, profileId, category, severity, reason, details, ...rest } = req.body;
  
  // Validate required fields
  const requiredFields = { userId, profileId, category, severity, reason, details };
  const missingFields = Object.entries(requiredFields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }

  // Verify user, profile exist and profile belongs to user
  const [user, profile] = await Promise.all([
    User.findById(userId),
    Profile.findById(profileId),
  ]);

  if (!user) return res.status(404).json({ message: "User not found" });
  if (!profile) return res.status(404).json({ message: "Profile not found" });
  if (profile.userId.toString() !== userId.toString()) {
    return res.status(400).json({ message: "Profile does not belong to the specified user" });
  }

  // Create warning and update profile count
  const [warning] = await Promise.all([
    Warning.create({ ...req.body, issuedBy, issuedAt: new Date() }),
    Profile.findByIdAndUpdate(profileId, { 
      $inc: { warningsCount: 1 },
      $set: { lastModified: new Date() }
    })
  ]);

  res.status(201).json(createWarningResponse(warning, "Warning created successfully"));
});

export const getWarning = asyncHandler(async (
  req: Request<{ warningId: string }>,
  res: Response<WarningResponse>
) => {
  const warning = await Warning.findById(req.params.warningId)
    .populate('userId', 'name email avatar displayName')
    .populate('issuedBy', 'name email')
    .populate('acknowledgedBy', 'name email')
    .populate('resolvedBy', 'name email');

  if (!warning) return res.status(404).json({ message: "Warning not found" });
  res.status(200).json(createWarningResponse(warning, "Warning retrieved successfully"));
});

export const updateWarning = asyncHandler(async (
  req: Request<{ warningId: string }, WarningResponse, UpdateWarningRequestBody> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  const updatedBy = validateAuth(req, res);
  if (!updatedBy) return;

  const allowedUpdates = [
    "category",
    "severity",
    "reason",
    "details",
    "evidence",
    "notes",
    "expiresAt",
  ] as const;

  const updates = req.body;
  const invalidUpdates = Object.keys(updates).filter(
    (key) => !allowedUpdates.includes(key as typeof allowedUpdates[number])
  );

  if (invalidUpdates.length > 0) {
    return res.status(400).json({
      message: `Invalid updates: ${invalidUpdates.join(", ")}. Allowed: ${allowedUpdates.join(", ")}`,
    });
  }

  const warning = await Warning.findById(req.params.warningId);
  if (!warning) {
    return res.status(404).json({ message: "Warning not found" });
  }

  const nonUpdatableStatuses: Set<WarningStatusType> = new Set([
  WarningStatus.RESOLVED,
  WarningStatus.EXPIRED,
]);

if (nonUpdatableStatuses.has(warning.status)) {
  return res.status(400).json({
    message: `Cannot update ${warning.status.toLowerCase()} warnings`,
  });
}


  Object.assign(warning, updates);
  const updatedWarning = await warning.save();

  res
    .status(200)
    .json(createWarningResponse(updatedWarning, "Warning updated successfully"));
});



export const deleteWarning = asyncHandler(async (
  req: Request<{ warningId: string }> & AuthenticatedRequest,
  res: Response
) => {
  const deletedBy = validateAuth(req, res);
  if (!deletedBy) return;

  const warning = await Warning.findById(req.params.warningId);
  if (!warning) return res.status(404).json({ message: "Warning not found" });

  await Promise.all([
    Profile.findByIdAndUpdate(warning.profileId, { 
      $inc: { warningsCount: -1 },
      $set: { lastModified: new Date() }
    }),
    Warning.findByIdAndDelete(req.params.warningId)
  ]);

  res.status(200).json({ message: "Warning deleted successfully" });
});

// ===== WARNING OPERATIONS =====

const performWarningAction = async (
  warningId: string, 
  action: 'acknowledge' | 'resolve' | 'activate' | 'deactivate',
  userId?: string,
  notes?: string
) => {
  const warning = await Warning.findById(warningId);
  if (!warning) throw new Error("Warning not found");

  switch (action) {
    case 'acknowledge':
      if (warning.isAcknowledged) throw new Error("Warning already acknowledged");
      return await warning.acknowledge(userId!);
    case 'resolve':
      if (warning.isResolved) throw new Error("Warning already resolved");
      return await warning.resolve(userId!, notes);
    case 'activate':
      if (warning.isActive) throw new Error("Warning is already active");
      return await warning.activate();
    case 'deactivate':
      if (!warning.isActive) throw new Error("Warning is already inactive");
      return await warning.deactivate();
    default:
      throw new Error("Invalid action");
  }
};

export const acknowledgeWarning = asyncHandler(async (
  req: Request<{ warningId: string }> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  const acknowledgedBy = validateAuth(req, res);
  if (!acknowledgedBy) return;

  const warning = await performWarningAction(req.params.warningId, 'acknowledge', acknowledgedBy);
  res.status(200).json(createWarningResponse(warning, "Warning acknowledged successfully"));
});

export const resolveWarning = asyncHandler(async (
  req: Request<{ warningId: string }, WarningResponse, { notes?: string }> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  const resolvedBy = validateAuth(req, res);
  if (!resolvedBy) return;

  const warning = await performWarningAction(req.params.warningId, 'resolve', resolvedBy, req.body.notes);
  res.status(200).json(createWarningResponse(warning, "Warning resolved successfully"));
});

export const activateWarning = asyncHandler(async (
  req: Request<{ warningId: string }> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  validateAuth(req, res);
  const warning = await performWarningAction(req.params.warningId, 'activate');
  res.status(200).json(createWarningResponse(warning, "Warning activated successfully"));
});

export const deactivateWarning = asyncHandler(async (
  req: Request<{ warningId: string }> & AuthenticatedRequest,
  res: Response<WarningResponse>
) => {
  validateAuth(req, res);
  const warning = await performWarningAction(req.params.warningId, 'deactivate');
  res.status(200).json(createWarningResponse(warning, "Warning deactivated successfully"));
});

// ===== QUERY OPERATIONS =====

const getWarningsWithPagination = async (baseQuery: any, req: Request, message: string, includeSummary = false): Promise<WarningListResponse> => {
  const { page, limit, skip } = getPagination(req);
  const query = buildQuery(req.query, baseQuery);

  const [warnings, total] = await Promise.all([
    Warning.find(query)
      .populate('userId', 'name email avatar displayName')
      .populate('issuedBy', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('resolvedBy', 'name email')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(limit),
    Warning.countDocuments(query)
  ]);

  return createPaginatedResponse(warnings, total, page, limit, message, includeSummary);
};

export const getUserWarnings = asyncHandler(async (
  req: Request<{ userId: string }>,
  res: Response<WarningListResponse>
) => {
  const result = await getWarningsWithPagination(
    { userId: req.params.userId },
    req,
    "User warnings retrieved successfully",
    true
  );
  res.status(200).json(result);
});

export const getProfileWarnings = asyncHandler(async (
  req: Request<{ profileId: string }>,
  res: Response<WarningListResponse>
) => {
  const result = await getWarningsWithPagination(
    { profileId: req.params.profileId },
    req,
    "Profile warnings retrieved successfully",
    true
  );
  res.status(200).json(result);
});

export const getAllWarnings = asyncHandler(async (
  req: Request, 
  res: Response<WarningListResponse>
) => {
  const result = await getWarningsWithPagination(
    {},
    req,
    "All warnings retrieved successfully",
    true
  );
  res.status(200).json(result);
});

export const getWarningsByCategory = asyncHandler(async (
  req: Request<{ category: string }>,
  res: Response<WarningListResponse>
) => {
  const { category } = req.params;
  if (!Object.values(WarningCategory).includes(category as any)) {
    return res.status(400).json({
      message: `Invalid category. Must be one of: ${Object.values(WarningCategory).join(', ')}`,
    } as any);
  }

  const result = await getWarningsWithPagination(
    { category, isActive: true },
    req,
    `Warnings in category '${category}' retrieved successfully`
  );
  res.status(200).json(result);
});

export const getWarningsBySeverity = asyncHandler(async (
  req: Request<{ severity: string }>,
  res: Response<WarningListResponse>
) => {
  const { severity } = req.params;
  if (!Object.values(SeverityLevel).includes(severity as any)) {
    return res.status(400).json({
      message: `Invalid severity. Must be one of: ${Object.values(SeverityLevel).join(', ')}`,
    } as any);
  }

  const result = await getWarningsWithPagination(
    { severity, isActive: true },
    req,
    `Warnings with severity '${severity}' retrieved successfully`
  );
  res.status(200).json(result);
});

export const getPendingAcknowledgments = asyncHandler(async (
  req: Request, 
  res: Response<WarningListResponse>
) => {
  const result = await getWarningsWithPagination(
    {
      isActive: true,
      status: WarningStatus.ACTIVE,
      acknowledgedBy: { $exists: false }
    },
    req,
    "Pending acknowledgments retrieved successfully"
  );
  res.status(200).json(result);
});

export const getExpiredWarnings = asyncHandler(async (
  req: Request, 
  res: Response<WarningListResponse>
) => {
  const { page, limit, skip } = getPagination(req);
  const query = {
    $or: [
      { expiresAt: { $lte: new Date() } },
      { status: WarningStatus.EXPIRED }
    ]
  };

  const [warnings, total] = await Promise.all([
    Warning.find(query)
      .populate('userId', 'name email avatar displayName')
      .populate('issuedBy', 'name email')
      .sort({ expiresAt: 1 })
      .skip(skip)
      .limit(limit),
    Warning.countDocuments(query)
  ]);

  res.status(200).json(createPaginatedResponse(warnings, total, page, limit, "Expired warnings retrieved successfully"));
});

// ===== BATCH OPERATIONS =====

export const bulkAcknowledgeWarnings = asyncHandler(async (
  req: Request<{}, any, { warningIds: string[] }> & AuthenticatedRequest,
  res: Response
) => {
  const { warningIds } = req.body;
  const acknowledgedBy = validateAuth(req, res);
  if (!acknowledgedBy) return;

  if (!Array.isArray(warningIds) || warningIds.length === 0) {
    return res.status(400).json({ message: "warningIds array is required and cannot be empty" });
  }

  const result = await Warning.updateMany(
    {
      _id: { $in: warningIds },
      acknowledgedBy: { $exists: false },
      isActive: true,
      status: WarningStatus.ACTIVE
    },
    {
      $set: {
        acknowledgedBy,
        acknowledgedAt: new Date()
      }
    }
  );

  res.status(200).json({
    message: `${result.modifiedCount} warnings acknowledged successfully`,
    acknowledged: result.modifiedCount,
    total: warningIds.length
  });
});

export const bulkResolveWarnings = asyncHandler(async (
  req: Request<{}, any, { warningIds: string[]; notes?: string }> & AuthenticatedRequest,
  res: Response
) => {
  const { warningIds, notes } = req.body;
  const resolvedBy = validateAuth(req, res);
  if (!resolvedBy) return;

  if (!Array.isArray(warningIds) || warningIds.length === 0) {
    return res.status(400).json({ message: "warningIds array is required and cannot be empty" });
  }

  const updateData = {
    status: WarningStatus.RESOLVED,
    resolvedBy,
    resolvedAt: new Date(),
    isActive: false,
    ...(notes && { notes })
  };

  const result = await Warning.updateMany(
    {
      _id: { $in: warningIds },
      status: { $ne: WarningStatus.RESOLVED }
    },
    { $set: updateData }
  );

  res.status(200).json({
    message: `${result.modifiedCount} warnings resolved successfully`,
    resolved: result.modifiedCount,
    total: warningIds.length
  });
});

export const expireOldWarnings = asyncHandler(async (req: Request, res: Response) => {
  const result = await Warning.expireOldWarnings();
  res.status(200).json({
    message: `${result.modifiedCount} warnings expired successfully`,
    expired: result.modifiedCount
  });
});

// ===== ANALYTICS AND REPORTS =====

export const getWarningAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const aggregateByField = (field: string): PipelineStage[] => [
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 as 1 | -1 } }
  ];

  const [
    totalWarnings,
    activeWarnings,
    resolvedWarnings,
    expiredWarnings,
    categoryStats,
    severityStats,
    acknowledgedStats,
    recentWarnings,
    topIssuerStats,
    riskAnalysis
  ] = await Promise.all([
    Warning.countDocuments({}),
    Warning.countDocuments({ status: WarningStatus.ACTIVE, isActive: true }),
    Warning.countDocuments({ status: WarningStatus.RESOLVED }),
    Warning.countDocuments({ status: WarningStatus.EXPIRED }),
    Warning.aggregate<{ _id: string; count: number }>(aggregateByField("category")),
    Warning.aggregate<{ _id: string; count: number }>(aggregateByField("severity")),
    Warning.aggregate([
      {
        $group: {
          _id: null,
          acknowledged: { $sum: { $cond: [{ $ne: ["$acknowledgedBy", null] }, 1, 0] } },
          unacknowledged: { $sum: { $cond: [{ $eq: ["$acknowledgedBy", null] }, 1, 0] } }
        }
      }
    ]),
    Warning.countDocuments({
      issuedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),
    Warning.aggregate([
      { $group: { _id: "$issuedBy", count: { $sum: 1 } } },
      { $sort: { count: -1 as 1 | -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "issuer"
        }
      },
      { $unwind: "$issuer" },
      {
        $project: {
          count: 1,
          name: "$issuer.name",
          email: "$issuer.email"
        }
      }
    ]),
    Warning.aggregate([
      {
        $group: {
          _id: "$severity",
          avgDaysToResolve: {
            $avg: {
              $divide: [
                { $subtract: ["$resolvedAt", "$issuedAt"] },
                86400000
              ]
            }
          },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const statsToObject = (stats: { _id: string; count: number }[]) =>
    stats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {} as Record<string, number>);

  res.status(200).json({
    message: "Warning analytics retrieved successfully",
    data: {
      overview: {
        total: totalWarnings,
        active: activeWarnings,
        resolved: resolvedWarnings,
        expired: expiredWarnings,
        recentWarnings
      },
      categoryDistribution: statsToObject(categoryStats),
      severityDistribution: statsToObject(severityStats),
      acknowledgmentStatus: acknowledgedStats[0] || { acknowledged: 0, unacknowledged: 0 },
      topIssuers: topIssuerStats,
      resolutionAnalysis: riskAnalysis
    }
  });
});


export const getUserWarningsSummary = asyncHandler(async (
  req: Request<{ userId: string }>,
  res: Response
) => {
  const { userId } = req.params;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const aggregateUserStats = (field: string) => [
    { $match: { userId: userObjectId } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } }
  ];

  const [
    totalWarnings,
    activeWarnings,
    resolvedWarnings,
    categoryBreakdown,
    severityBreakdown,
    recentWarnings,
    userProfile
  ] = await Promise.all([
    Warning.countDocuments({ userId }),
    Warning.countDocuments({ userId, status: WarningStatus.ACTIVE, isActive: true }),
    Warning.countDocuments({ userId, status: WarningStatus.RESOLVED }),
    Warning.aggregate(aggregateUserStats('category')),
    Warning.aggregate(aggregateUserStats('severity')),
    Warning.find({ userId })
      .sort({ issuedAt: -1 })
      .limit(5)
      .select('category severity reason issuedAt status'),
    Profile.findOne({ userId }).select('warningsCount')
  ]);

  const riskLevel = calculateUserRiskLevel(activeWarnings, severityBreakdown);
  const statsToObject = (stats: any[]) => 
    stats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {});

  res.status(200).json({
    message: "User warnings summary retrieved successfully",
    userId,
    data: {
      counts: {
        total: totalWarnings,
        active: activeWarnings,
        resolved: resolvedWarnings,
        profileCount: userProfile?.warningsCount || 0
      },
      categoryBreakdown: statsToObject(categoryBreakdown),
      severityBreakdown: statsToObject(severityBreakdown),
      riskLevel,
      recentWarnings
    }
  });
});

// ===== HELPER FUNCTIONS =====

function calculateUserRiskLevel(activeWarnings: number, severityBreakdown: any[]): RiskLevel {
  if (activeWarnings === 0) return RiskLevel.LOW;
  
  const severeCount = severityBreakdown.find(s => s._id === SeverityLevel.SEVERE)?.count || 0;
  const majorCount = severityBreakdown.find(s => s._id === SeverityLevel.MAJOR)?.count || 0;
  
  if (severeCount >= 2 || activeWarnings >= 10) return RiskLevel.CRITICAL;
  if (severeCount >= 1 || majorCount >= 3 || activeWarnings >= 5) return RiskLevel.HIGH;
  if (majorCount >= 1 || activeWarnings >= 3) return RiskLevel.MEDIUM;
  
  return RiskLevel.LOW;
}

// ===== UTILITY ENDPOINTS =====

const createUtilityResponse = (data: any, message: string) => ({ message, ...data });

export const getWarningCategories = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(createUtilityResponse(
    { categories: Object.values(WarningCategory) },
    "Warning categories retrieved successfully"
  ));
});

export const getSeverityLevels = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(createUtilityResponse(
    { severityLevels: Object.values(SeverityLevel) },
    "Severity levels retrieved successfully"
  ));
});

export const getWarningStatuses = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(createUtilityResponse(
    { statuses: Object.values(WarningStatus) },
    "Warning statuses retrieved successfully"
  ));
});

// ===== CLEANUP AND MAINTENANCE =====

export const cleanupExpiredWarnings = asyncHandler(async (req: Request, res: Response) => {
  const daysOld = parseInt(req.query.daysOld as string) || 365;
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const result = await Warning.deleteMany({
    status: WarningStatus.EXPIRED,
    expiresAt: { $lte: cutoffDate }
  });

  res.status(200).json({
    message: `Cleanup completed. ${result.deletedCount} expired warnings removed`,
    deleted: result.deletedCount,
    cutoffDate
  });
});

export const syncProfileWarningCounts = asyncHandler(async (req: Request, res: Response) => {
  const profiles = await Profile.find({});
  let updated = 0;

  const updatePromises = profiles.map(async (profile) => {
    const actualCount = await Warning.countDocuments({ 
      profileId: profile._id, 
      isActive: true 
    });
    
    if (actualCount !== profile.warningsCount) {
      await Profile.findByIdAndUpdate(profile._id, {
        warningsCount: actualCount,
        lastModified: new Date()
      });
      return true;
    }
    return false;
  });

  const results = await Promise.all(updatePromises);
  updated = results.filter(Boolean).length;

  res.status(200).json({
    message: `Warning count synchronization completed. ${updated} profiles updated`,
    totalProfiles: profiles.length,
    updatedProfiles: updated
  });
});