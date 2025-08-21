// routes/report.routes.ts
import { Router } from "express";
import { ReportController } from "../controllers/report.controller";
import {
  authenticateToken,
  requireVerification,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = Router();
const reportController = new ReportController();

// Apply authentication middleware to all report routes
router.use(authenticateToken);
router.use(requireVerification);

/**
 * @route   POST /api/reports
 * @desc    Create a new report
 * @access  Private (authenticated users only)
 */
router.post("/", reportController.createReport.bind(reportController));

/**
 * @route   GET /api/reports
 * @desc    Get reports with filtering and pagination
 * @access  Private (admin only)
 * @query   reportType, status, priority, severity, reason, investigatorId,
 *          reportedUserId, reportedReviewId, reportedServiceId, reporterId,
 *          isEscalated, followUpRequired, dateFrom, dateTo, page, limit,
 *          sortBy, sortOrder
 */
router.get(
  "/",
  requireAdmin,
  reportController.getReports.bind(reportController)
);

/**
 * @route   GET /api/reports/analytics
 * @desc    Get reports analytics and metrics
 * @access  Private (admin only)
 * @query   dateFrom, dateTo
 */
router.get(
  "/analytics",
  requireAdmin,
  reportController.getReportAnalytics.bind(reportController)
);

/**
 * @route   GET /api/reports/unassigned
 * @desc    Get unassigned reports
 * @access  Private (admin only)
 * @query   priority (optional filter)
 */
router.get(
  "/unassigned",
  requireAdmin,
  reportController.getUnassignedReports.bind(reportController)
);

/**
 * @route   GET /api/reports/overdue
 * @desc    Get overdue reports
 * @access  Private (admin only)
 */
router.get(
  "/overdue",
  requireAdmin,
  reportController.getOverdueReports.bind(reportController)
);

/**
 * @route   GET /api/reports/:id
 * @desc    Get single report by ID
 * @access  Private (admin only)
 */
router.get(
  "/:id",
  requireAdmin,
  reportController.getReportById.bind(reportController)
);

/**
 * @route   PATCH /api/reports/:id/assign
 * @desc    Assign investigator to report
 * @access  Private (admin only)
 * @body    { investigatorId: string }
 */
router.patch(
  "/:id/assign",
  requireAdmin,
  reportController.assignInvestigator.bind(reportController)
);

/**
 * @route   POST /api/reports/:id/notes
 * @desc    Add internal note to report
 * @access  Private (admin only)
 * @body    { content: string, category?: string, isPrivate?: boolean }
 */
router.post(
  "/:id/notes",
  requireAdmin,
  reportController.addInternalNote.bind(reportController)
);

/**
 * @route   PATCH /api/reports/:id/escalate
 * @desc    Escalate report to higher authority
 * @access  Private (admin only)
 * @body    { escalatedTo: string, reason: string }
 */
router.patch(
  "/:id/escalate",
  requireAdmin,
  reportController.escalateReport.bind(reportController)
);

/**
 * @route   PATCH /api/reports/:id/resolve
 * @desc    Resolve report with resolution details
 * @access  Private (admin only)
 * @body    { resolutionType: string, resolutionSummary: string, actions?: Array }
 */
router.patch(
  "/:id/resolve",
  requireAdmin,
  reportController.resolveReport.bind(reportController)
);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Soft delete report
 * @access  Private (admin only)
 */
router.delete(
  "/:id",
  requireAdmin,
  reportController.deleteReport.bind(reportController)
);

export default router;
