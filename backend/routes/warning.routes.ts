// routes/warning.routes.ts
import { Router } from "express";
import {
  // Core CRUD Operations
  createWarning,
  getWarning,
  updateWarning,
  deleteWarning,
  
  // Warning Operations
  acknowledgeWarning,
  resolveWarning,
  activateWarning,
  deactivateWarning,
  
  // Query Operations
  getUserWarnings,
  getProfileWarnings,
  getAllWarnings,
  getWarningsByCategory,
  getWarningsBySeverity,
  getPendingAcknowledgments,
  getExpiredWarnings,
  
  // Batch Operations
  bulkAcknowledgeWarnings,
  bulkResolveWarnings,
  expireOldWarnings,
  
  // Analytics and Reports
  getWarningAnalytics,
  getUserWarningsSummary,
  
  // Utility Endpoints
  getWarningCategories,
  getSeverityLevels,
  getWarningStatuses,
  
  // Cleanup and Maintenance
  cleanupExpiredWarnings,
  syncProfileWarningCounts,
} from "../controllers/warning.controller.js";

import {
  authenticateToken,
  requireVerification,
  requireAdmin,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

// ===== CORE CRUD OPERATIONS =====
// Create a new warning (Admin only)
router.post("/", authenticateToken, requireVerification, requireAdmin, createWarning);

// Get a specific warning by ID
router.get("/:warningId", authenticateToken, getWarning);

// Update a warning (Admin only)
router.patch("/:warningId", authenticateToken, requireVerification, requireAdmin, updateWarning);

// Delete a warning (Super Admin only)
router.delete("/:warningId", authenticateToken, requireVerification, requireSuperAdmin, deleteWarning);

// ===== WARNING OPERATIONS =====
// Acknowledge a warning
router.patch("/:warningId/acknowledge", authenticateToken, requireVerification, acknowledgeWarning);

// Resolve a warning (Admin only)
router.patch("/:warningId/resolve", authenticateToken, requireVerification, requireAdmin, resolveWarning);

// Activate a warning (Admin only)
router.patch("/:warningId/activate", authenticateToken, requireVerification, requireAdmin, activateWarning);

// Deactivate a warning (Admin only)
router.patch("/:warningId/deactivate", authenticateToken, requireVerification, requireAdmin, deactivateWarning);

// ===== QUERY OPERATIONS =====
// Get all warnings (Admin only)
router.get("/", authenticateToken, requireVerification, requireAdmin, getAllWarnings);

// Get warnings for a specific user
router.get("/user/:userId", authenticateToken, requireVerification, getUserWarnings);

// Get warnings for a specific profile
router.get("/profile/:profileId", authenticateToken, requireVerification, getProfileWarnings);

// Get warnings by category
router.get("/category/:category", authenticateToken, requireVerification, requireAdmin, getWarningsByCategory);

// Get warnings by severity level
router.get("/severity/:severity", authenticateToken, requireVerification, requireAdmin, getWarningsBySeverity);

// Get pending acknowledgments (Admin only)
router.get("/status/pending-acknowledgments", authenticateToken, requireVerification, requireAdmin, getPendingAcknowledgments);

// Get expired warnings (Admin only)
router.get("/status/expired", authenticateToken, requireVerification, requireAdmin, getExpiredWarnings);

// ===== BATCH OPERATIONS =====
// Bulk acknowledge warnings
router.patch("/bulk/acknowledge", authenticateToken, requireVerification, requireAdmin, bulkAcknowledgeWarnings);

// Bulk resolve warnings (Admin only)
router.patch("/bulk/resolve", authenticateToken, requireVerification, requireAdmin, bulkResolveWarnings);

// Expire old warnings (Super Admin only)
router.post("/maintenance/expire-old", authenticateToken, requireVerification, requireSuperAdmin, expireOldWarnings);

// ===== ANALYTICS AND REPORTS =====
// Get warning analytics (Admin only)
router.get("/analytics/overview", authenticateToken, requireVerification, requireAdmin, getWarningAnalytics);

// Get user warnings summary
router.get("/analytics/user/:userId/summary", authenticateToken, requireVerification, getUserWarningsSummary);

// ===== UTILITY ENDPOINTS =====
// Get available warning categories
router.get("/utils/categories", authenticateToken, getWarningCategories);

// Get available severity levels
router.get("/utils/severity-levels", authenticateToken, getSeverityLevels);

// Get available warning statuses
router.get("/utils/statuses", authenticateToken, getWarningStatuses);

// ===== CLEANUP AND MAINTENANCE =====
// Cleanup expired warnings (Super Admin only)
router.delete("/maintenance/cleanup-expired", authenticateToken, requireVerification, requireSuperAdmin, cleanupExpiredWarnings);

// Sync profile warning counts (Super Admin only)
router.post("/maintenance/sync-counts", authenticateToken, requireVerification, requireSuperAdmin, syncProfileWarningCounts);

export default router;