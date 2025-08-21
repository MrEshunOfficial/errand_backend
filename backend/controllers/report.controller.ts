// controllers/report.controller.ts
import { Response } from "express";
import { Types } from "mongoose";
import {
  ReportModel,
  UserReportModel,
  ReviewReportModel,
  ServiceReportModel,
} from "../models/report.model";

import { ReportType } from "../types/report.types";
import { UserRole } from "../types/base.types";
import { AuthenticatedRequest } from "../types";
import {
  handleError,
  validateObjectId,
} from "../utils/controller-utils/controller.utils";

export class ReportController {
  /**
   * Create a new report
   * POST /api/reports
   */
  async createReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { reportType, ...reportData } = req.body;

      // Validate required fields
      if (!reportType) {
        return res.status(400).json({
          success: false,
          message: "Report type is required",
          validTypes: ["user_report", "review_report", "service_report"],
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Validate report type
      const validTypes: ReportType[] = [
        "user_report",
        "review_report",
        "service_report",
      ];
      if (!validTypes.includes(reportType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
          validTypes,
        });
      }

      // Prepare base report data
      const baseData = {
        reporterId: new Types.ObjectId(req.userId),
        reporterType: req.user?.systemRole || UserRole,
        reportType,
        reason: reportData.reason,
        customReason: reportData.customReason,
        description: reportData.description,
        evidence: reportData.evidence || [],
        severity: reportData.severity || "moderate",
        // Priority and category to be auto-assigned by pre-save middleware
      };

      // Validate required base fields
      if (!baseData.reason || !baseData.description) {
        return res.status(400).json({
          success: false,
          message: "Reason and description are required",
        });
      }

      // Validate custom reason when reason is "other"
      if (baseData.reason === "other" && !baseData.customReason) {
        return res.status(400).json({
          success: false,
          message: "Custom reason is required when reason is 'other'",
        });
      }

      // Create type-specific report
      let report;
      switch (reportType) {
        case "user_report":
          report = await this.createUserReport(baseData, reportData);
          break;
        case "review_report":
          report = await this.createReviewReport(baseData, reportData);
          break;
        case "service_report":
          report = await this.createServiceReport(baseData, reportData);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Invalid report type",
          });
      }

      await report.save();

      // Populate reporter info for response
      await report.populate("reporterId", "fullName profilePicture");

      res.status(201).json({
        success: true,
        message: "Report created successfully",
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to create report");
    }
  }

  /**
   * Get reports with filtering and pagination
   * GET /api/reports
   */
  async getReports(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        reportType,
        status,
        priority,
        severity,
        reason,
        investigatorId,
        reportedUserId,
        reportedReviewId,
        reportedServiceId,
        reporterId,
        isEscalated,
        followUpRequired,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Build filter object
      const filter: any = { isDeleted: { $ne: true } };

      // Apply filters
      if (reportType) filter.reportType = reportType;
      if (status) {
        filter.status = Array.isArray(status) ? { $in: status } : status;
      }
      if (priority) {
        filter.priority = Array.isArray(priority)
          ? { $in: priority }
          : priority;
      }
      if (severity) {
        filter.severity = Array.isArray(severity)
          ? { $in: severity }
          : severity;
      }
      if (reason) {
        filter.reason = Array.isArray(reason) ? { $in: reason } : reason;
      }
      if (investigatorId) {
        if (!validateObjectId(investigatorId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid investigator ID format",
          });
        }
        filter.investigatorId = new Types.ObjectId(investigatorId as string);
      }
      if (reportedUserId) {
        if (!validateObjectId(reportedUserId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid reported user ID format",
          });
        }
        filter.reportedUserId = new Types.ObjectId(reportedUserId as string);
      }
      if (reportedReviewId) {
        if (!validateObjectId(reportedReviewId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid reported review ID format",
          });
        }
        filter.reportedReviewId = new Types.ObjectId(
          reportedReviewId as string
        );
      }
      if (reportedServiceId) {
        if (!validateObjectId(reportedServiceId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid reported service ID format",
          });
        }
        filter.reportedServiceId = new Types.ObjectId(
          reportedServiceId as string
        );
      }
      if (reporterId) {
        if (!validateObjectId(reporterId as string)) {
          return res.status(400).json({
            success: false,
            message: "Invalid reporter ID format",
          });
        }
        filter.reporterId = new Types.ObjectId(reporterId as string);
      }
      if (isEscalated !== undefined) {
        filter.isEscalated = isEscalated === "true";
      }
      if (followUpRequired !== undefined) {
        filter.followUpRequired = followUpRequired === "true";
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
      }

      // Pagination
      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string))); // Max 100 per page
      const skip = (pageNum - 1) * limitNum;

      // Sort configuration
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "priority",
        "severity",
        "status",
      ];
      const sortField = validSortFields.includes(sortBy as string)
        ? sortBy
        : "createdAt";
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      // Execute queries in parallel
      const [reports, total] = await Promise.all([
        ReportModel.find(filter)
          .populate("reporterId", "fullName profilePicture email")
          .populate("investigatorId", "fullName email")
          .populate("escalatedTo", "fullName email")
          .sort({ [sortField as string]: sortDirection })
          .limit(limitNum)
          .skip(skip)
          .exec(),
        ReportModel.countDocuments(filter),
      ]);

      res.json({
        success: true,
        reports,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1,
        },
        filters: {
          reportType,
          status,
          priority,
          severity,
          reason,
          investigatorId,
          isEscalated,
          followUpRequired,
        },
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to retrieve reports");
    }
  }

  /**
   * Get single report by ID
   * GET /api/reports/:id
   */
  async getReportById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      })
        .populate("reporterId", "fullName profilePicture email")
        .populate("investigatorId", "fullName email")
        .populate("escalatedTo", "fullName email")
        .populate(
          "relatedReports",
          "reportType reason status priority createdAt"
        )
        .populate("internalNotes.authorId", "fullName")
        .exec();

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      res.json({
        success: true,
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to retrieve report");
    }
  }

  /**
   * Assign investigator to report
   * PATCH /api/reports/:id/assign
   */
  async assignInvestigator(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { investigatorId } = req.body;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      if (!validateObjectId(investigatorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid investigator ID format",
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Use the model's built-in method
      await report.assignInvestigator(new Types.ObjectId(investigatorId));

      // Populate for response
      await report.populate("investigatorId", "fullName email");

      res.json({
        success: true,
        message: "Investigator assigned successfully",
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to assign investigator");
    }
  }

  /**
   * Add internal note to report
   * POST /api/reports/:id/notes
   */
  async addInternalNote(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        content,
        category = "investigation",
        isPrivate = false,
      } = req.body;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Note content is required",
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Use the model's built-in method
      await report.addInternalNote(
        new Types.ObjectId(req.userId),
        content.trim(),
        category,
        isPrivate
      );

      // Populate for response
      await report.populate("internalNotes.authorId", "fullName");

      res.json({
        success: true,
        message: "Internal note added successfully",
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to add internal note");
    }
  }

  /**
   * Escalate report
   * PATCH /api/reports/:id/escalate
   */
  async escalateReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { escalatedTo, reason } = req.body;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      if (!validateObjectId(escalatedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid escalated to ID format",
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Escalation reason is required",
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Use the model's built-in method
      await report.escalate(new Types.ObjectId(escalatedTo), reason.trim());

      // Populate for response
      await report.populate("escalatedTo", "fullName email");

      res.json({
        success: true,
        message: "Report escalated successfully",
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to escalate report");
    }
  }

  /**
   * Resolve report
   * PATCH /api/reports/:id/resolve
   */
  async resolveReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { resolutionType, resolutionSummary, actions } = req.body;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      if (!resolutionType || !resolutionSummary) {
        return res.status(400).json({
          success: false,
          message: "Resolution type and summary are required",
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const validResolutionTypes = [
        "no_action",
        "warning_issued",
        "account_suspended",
        "account_banned",
        "content_removed",
      ];

      if (!validResolutionTypes.includes(resolutionType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid resolution type",
          validTypes: validResolutionTypes,
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Prepare resolution data
      const resolutionData: any = {
        resolutionType,
        resolutionSummary: resolutionSummary.trim(),
      };

      // Process actions if provided
      if (actions && Array.isArray(actions)) {
        resolutionData.actions = actions.map((action: any) => ({
          ...action,
          executedBy: new Types.ObjectId(req.userId!),
          executedAt: new Date(),
        }));
      }

      // Use the model's built-in method
      await report.resolve(resolutionData);

      res.json({
        success: true,
        message: "Report resolved successfully",
        report: report.toObject(),
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to resolve report");
    }
  }

  /**
   * Get reports analytics
   * GET /api/reports/analytics
   */
  async getReportAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const { dateFrom, dateTo } = req.query;

      let dateRange;
      if (dateFrom && dateTo) {
        dateRange = {
          from: new Date(dateFrom as string),
          to: new Date(dateTo as string),
        };
      }

      const analytics = await ReportModel.getReportAnalytics(dateRange);

      // Get additional metrics
      const [unassignedReports, overdueReports] = await Promise.all([
        ReportModel.getUnassignedReports(),
        ReportModel.getOverdueReports(),
      ]);

      res.json({
        success: true,
        analytics: analytics[0] || {
          totalReports: 0,
          avgResolutionTime: 0,
          byStatus: {},
          byPriority: {},
          byReportType: {},
        },
        unassignedCount: unassignedReports.length,
        overdueCount: overdueReports.length,
        dateRange,
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to retrieve analytics");
    }
  }

  /**
   * Get unassigned reports
   * GET /api/reports/unassigned
   */
  async getUnassignedReports(req: AuthenticatedRequest, res: Response) {
    try {
      const { priority } = req.query;

      const reports = await ReportModel.getUnassignedReports(
        priority as string
      );

      res.json({
        success: true,
        reports,
        count: reports.length,
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to retrieve unassigned reports");
    }
  }

  /**
   * Get overdue reports
   * GET /api/reports/overdue
   */
  async getOverdueReports(req: AuthenticatedRequest, res: Response) {
    try {
      const reports = await ReportModel.getOverdueReports();

      res.json({
        success: true,
        reports,
        count: reports.length,
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to retrieve overdue reports");
    }
  }

  /**
   * Soft delete report
   * DELETE /api/reports/:id
   */
  async deleteReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid report ID format",
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const report = await ReportModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Soft delete
      report.isDeleted = true;
      report.deletedAt = new Date();
      report.deletedBy = new Types.ObjectId(req.userId);
      await report.save();

      res.json({
        success: true,
        message: "Report deleted successfully",
      });
    } catch (error: any) {
      return handleError(res, error, "Failed to delete report");
    }
  }

  // Private helper methods for creating specific report types
  private async createUserReport(baseData: any, reportData: any) {
    if (!reportData.reportedUserId) {
      throw new Error("Reported user ID is required for user reports");
    }

    if (!validateObjectId(reportData.reportedUserId)) {
      throw new Error("Invalid reported user ID format");
    }

    return new UserReportModel({
      ...baseData,
      reportedUserId: new Types.ObjectId(reportData.reportedUserId),
      reportedUserType: reportData.reportedUserType || UserRole.CUSTOMER,
      relatedServiceId: reportData.relatedServiceId
        ? new Types.ObjectId(reportData.relatedServiceId)
        : undefined,
      relatedProjectId: reportData.relatedProjectId
        ? new Types.ObjectId(reportData.relatedProjectId)
        : undefined,
      interactionContext: reportData.interactionContext,
      behaviorType: reportData.behaviorType,
      incidentDate: reportData.incidentDate
        ? new Date(reportData.incidentDate)
        : undefined,
      witnessIds: reportData.witnessIds
        ? reportData.witnessIds.map((id: string) => new Types.ObjectId(id))
        : [],
    });
  }

  private async createReviewReport(baseData: any, reportData: any) {
    if (!reportData.reportedReviewId) {
      throw new Error("Reported review ID is required for review reports");
    }

    if (!validateObjectId(reportData.reportedReviewId)) {
      throw new Error("Invalid reported review ID format");
    }

    if (!reportData.reviewIssue) {
      throw new Error("Review issue is required for review reports");
    }

    return new ReviewReportModel({
      ...baseData,
      reportedReviewId: new Types.ObjectId(reportData.reportedReviewId),
      reviewIssue: reportData.reviewIssue,
      isCompetitorReport: reportData.isCompetitorReport || false,
      hasConflictOfInterest: reportData.hasConflictOfInterest || false,
    });
  }

  private async createServiceReport(baseData: any, reportData: any) {
    if (!reportData.reportedServiceId) {
      throw new Error("Reported service ID is required for service reports");
    }

    if (!validateObjectId(reportData.reportedServiceId)) {
      throw new Error("Invalid reported service ID format");
    }

    if (!reportData.serviceIssue) {
      throw new Error("Service issue is required for service reports");
    }

    return new ServiceReportModel({
      ...baseData,
      reportedServiceId: new Types.ObjectId(reportData.reportedServiceId),
      serviceIssue: reportData.serviceIssue,
      customersAffected: reportData.customersAffected,
      financialImpact: reportData.financialImpact,
    });
  }
}
