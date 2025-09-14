// routes/service.routes.ts
import express, { RequestHandler } from "express";
import { authenticateToken, optionalAuth, requireAdmin } from "../middleware/auth.middleware";
import { ServiceController } from "../controllers/service.controller";

const router = express.Router();
const serviceController = new ServiceController();

// ===================================================================
// AUTHENTICATED SERVICE ROUTES - Authentication required
// ===================================================================

// Get services created by the current authenticated user
router.get(
  "/my-services",
  authenticateToken,
  serviceController.getUserServices.bind(serviceController) as RequestHandler
);

// Create new service (authenticated users can create services)
router.post(
  "/",
  authenticateToken,
  serviceController.createService.bind(serviceController) as RequestHandler
);

// Update service (users can update their own services)
router.put(
  "/:id",
  authenticateToken,
  serviceController.updateService.bind(serviceController) as RequestHandler
);

// Soft delete service (users can delete their own services)
router.delete(
  "/:id",
  authenticateToken,
  serviceController.deleteService.bind(serviceController) as RequestHandler
);

// ===================================================================
// ADMIN SERVICE ROUTES - Admin authentication required
// ===================================================================

// Restore deleted service (admin only)
router.patch(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  serviceController.restoreService.bind(serviceController) as RequestHandler
);

// Toggle popular status (admin only)
router.patch(
  "/:id/toggle-popular",
  authenticateToken,
  requireAdmin,
  serviceController.togglePopular.bind(serviceController) as RequestHandler
);

// Approve service (admin only)
router.patch(
  "/:id/approve",
  authenticateToken,
  requireAdmin,
  serviceController.approveService.bind(serviceController) as RequestHandler
);

// Reject service (admin only)
router.patch(
  "/:id/reject",
  authenticateToken,
  requireAdmin,
  serviceController.rejectService.bind(serviceController) as RequestHandler
);

// ===================================================================
// PUBLIC SERVICE ROUTES - No authentication required
// ===================================================================

// Get all services with filtering and pagination
router.get("/", optionalAuth, serviceController.getAllServices.bind(serviceController) as RequestHandler);

// Get popular services
router.get("/popular", serviceController.getPopularServices.bind(serviceController) as RequestHandler);

// Get services with explicit pricing only (priceBasedOnServiceType: false)
router.get("/with-pricing", serviceController.getServicesWithPricing.bind(serviceController) as RequestHandler);

// Get pending services (admin only - for moderation)
router.get(
  "/pending",
  authenticateToken,
  requireAdmin,
  serviceController.getPendingServices.bind(serviceController) as RequestHandler
);

// Get services by category (parameterized route)
router.get(
  "/category/:categoryId",
  serviceController.getServicesByCategory.bind(serviceController) as RequestHandler
);

// Get service by slug (for SEO-friendly URLs)
router.get("/slug/:slug", serviceController.getServiceBySlug.bind(serviceController) as RequestHandler);

// Get service by ID
router.get("/:id", serviceController.getServiceById.bind(serviceController) as RequestHandler);

export default router;