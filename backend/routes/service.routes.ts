// routes/service.routes.ts
import express from "express";
import { 
  authenticateToken, 
  requireAdmin 
} from "../middleware/auth.middleware";
import { ServiceController } from "../controllers/service.controller";

const router = express.Router();


// ===================================================================
// AUTHENTICATED SERVICE ROUTES - Authentication required
// ===================================================================

// Get services created by the current authenticated user
router.get("/my-services", authenticateToken, ServiceController.getUserServices);

// Create new service (authenticated users can create services)
router.post(
  "/", 
  authenticateToken, 
  ServiceController.createService as any
);

// Update service (users can update their own services)
router.put(
  "/:id", 
  authenticateToken, 
  ServiceController.updateService as any
);

// Soft delete service (users can delete their own services)
router.delete(
  "/:id",
  authenticateToken,
  ServiceController.deleteService as any
);

// ===================================================================
// ADMIN SERVICE ROUTES - Admin authentication required
// ===================================================================

// Restore deleted service (admin only)
router.patch(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  ServiceController.restoreService as any
);

// Toggle popular status (admin only)
router.patch(
  ":id/toggle-popular",
  authenticateToken,
  requireAdmin,
  ServiceController.togglePopular as any
);

// Approve service (admin only)
router.patch(
  "/:id/approve",
  authenticateToken,
  requireAdmin,
  ServiceController.approveService as any
);

// Reject service (admin only)
router.patch(
  "/:id/reject",
  authenticateToken,
  requireAdmin,
  ServiceController.rejectService as any
);


// ===================================================================
// PUBLIC SERVICE ROUTES - No authentication required
// ===================================================================

// Get all services with filtering and pagination
router.get("/", ServiceController.getAllServices);

// IMPORTANT: Specific routes MUST come before parameterized routes
// Get popular services
router.get("/popular", ServiceController.getPopularServices);

// Get services with explicit pricing only (priceBasedOnServiceType: false)
router.get("/with-pricing", ServiceController.getServicesWithPricing);

// Get pending services (admin only - for moderation)
router.get(
  "/pending", 
  authenticateToken, 
  requireAdmin,
  ServiceController.getPendingServices
);


// Get services by category (parameterized route)
router.get("/category/:categoryId", ServiceController.getServicesByCategory);

// Get service by slug (for SEO-friendly URLs) - should come before /:id
router.get("/slug/:slug", ServiceController.getServiceBySlug);

// Get service by ID - THIS MUST BE LAST among GET routes to avoid conflicts
router.get("/:id", ServiceController.getServiceById);

export default router;