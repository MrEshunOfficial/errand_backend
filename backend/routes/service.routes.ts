// routes/service.routes.ts
import express from "express";
import { authenticateToken } from "../middleware/auth.middleware";
import { ServiceController } from "../controllers/service.controller";

const router = express.Router();

// ===================================================================
// PUBLIC SERVICE ROUTES - No authentication required
// ===================================================================

// Get all services with filtering and pagination
router.get("/", ServiceController.getAllServices);

// Get popular services
router.get("/popular", ServiceController.getPopularServices);

// Get services by category
router.get("/category/:categoryId", ServiceController.getServicesByCategory);

// Get service by slug (for SEO-friendly URLs)
router.get("/slug/:slug", ServiceController.getServiceBySlug);

// Get service by ID
router.get("/:id", ServiceController.getServiceById);

// ===================================================================
// PROTECTED SERVICE ROUTES - Authentication required
// ===================================================================

// Create new service
router.post("/", authenticateToken, ServiceController.createService as any);

// Update service
router.put("/:id", authenticateToken, ServiceController.updateService as any);

// Soft delete service
router.delete(
  "/:id",
  authenticateToken,
  ServiceController.deleteService as any
);

// Restore deleted service
router.patch(
  "/:id/restore",
  authenticateToken,
  ServiceController.restoreService as any
);

// Toggle popular status
router.patch(
  "/:id/toggle-popular",
  authenticateToken,
  ServiceController.togglePopular as any
);

// ===================================================================
// ADMIN/MODERATION SERVICE ROUTES - Authentication required
// ===================================================================

// Get pending services (for moderation)
router.get("/pending", authenticateToken, ServiceController.getPendingServices);

// Approve service
router.patch(
  "/:id/approve",
  authenticateToken,
  ServiceController.approveService as any
);

// Reject service
router.patch(
  "/:id/reject",
  authenticateToken,
  ServiceController.rejectService as any
);

export default router;
