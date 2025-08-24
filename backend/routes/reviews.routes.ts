// routes/review.routes.ts
import express from "express";
import { ReviewController } from "../controllers/reviews.controller";
import {
  authenticateToken,
  requireVerification,
} from "../middleware/auth.middleware";

const router = express.Router();

// =============================================================================
// PUBLIC ROUTES (No authentication required)
// =============================================================================

// Get all reviews with filtering/pagination
router.get("/", ReviewController.getReviews);

// Get provider statistics - specific route before any parameterized routes
router.get("/provider-stats/:providerId", ReviewController.getProviderStats);

// Get service statistics - specific route before any parameterized routes
router.get("/service-stats/:serviceId", ReviewController.getServiceStats);

// =============================================================================
// AUTHENTICATION REQUIRED (Apply middleware)
// =============================================================================
router.use(authenticateToken);

// =============================================================================
// AUTHENTICATED ROUTES (Specific routes FIRST, then parameterized)
// =============================================================================

// User's own reviews - CRITICAL: Must come before /:id route
router.get("/me", ReviewController.getMyReviews);

// User's received reviews - CRITICAL: Must come before /:id route
router.get("/received", ReviewController.getReceivedReviews);

// Single review by ID - MUST come AFTER all specific routes
router.get("/:id", ReviewController.getReviewById);

// =============================================================================
// VERIFICATION REQUIRED (Apply additional middleware for sensitive operations)
// =============================================================================
router.use(requireVerification);

// =============================================================================
// VERIFIED USER ROUTES (Create/Update/Delete operations)
// =============================================================================

// Create new review
router.post("/", ReviewController.createReview);

// Update review (only by owner) - specific action before ID-based routes
router.put("/:id", ReviewController.updateReview);

// Delete review (only by owner) - specific action before ID-based routes
router.delete("/:id", ReviewController.deleteReview);

// =============================================================================
// REVIEW INTERACTION ROUTES (All require verification)
// =============================================================================

// Add response to review - specific action route
router.post("/:id/response", ReviewController.addResponse);

// Toggle helpful status - specific action route
router.put("/:id/helpful", ReviewController.toggleHelpful);

// Report review - specific action route
router.post("/:id/report", ReviewController.reportReview);

// Admin routes (require admin access)
// Note: Admin routes are commented out since the controller methods aren't implemented yet
// Uncomment and implement these methods in the controller as needed

/*
router.use(requireAdmin);

// Admin review management
router.get("/admin/pending", ReviewController.getPendingReviews);
router.get("/admin/flagged", ReviewController.getFlaggedReviews);
router.get("/admin/all", ReviewController.getAllReviews); // Includes unmoderated

// Admin moderation actions
router.put("/admin/:id/approve", ReviewController.approveReview);
router.put("/admin/:id/reject", ReviewController.rejectReview);
router.put("/admin/:id/flag", ReviewController.flagReview);
router.put("/admin/:id/hide", ReviewController.hideReview);

// Admin force delete (hard delete)
router.delete("/admin/:id/force", ReviewController.forceDeleteReview);

// Admin response moderation
router.put("/admin/response/:responseId/approve", ReviewController.approveResponse);
router.put("/admin/response/:responseId/reject", ReviewController.rejectResponse);

// Admin analytics
router.get("/admin/analytics", ReviewController.getReviewAnalytics);
router.get("/admin/analytics/trends", ReviewController.getReviewTrends);
*/

export default router;
