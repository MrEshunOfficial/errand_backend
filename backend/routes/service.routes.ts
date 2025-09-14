// routes/service.routes.ts
import express, { RequestHandler } from "express";
import { authenticateToken, optionalAuth, requireAdmin } from "../middleware/auth.middleware";
import { ServiceController } from "../controllers/service.controller";
import { FileUploadController } from "../controllers/filupload.controller";

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
// Body can include images: [{ url, fileName, mimeType, fileSize, uploadedAt }]
router.post(
  "/",
  authenticateToken,
  serviceController.createService.bind(serviceController) as RequestHandler
);

// Update service (users can update their own services)
// Body can include images to update service images
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
// SERVICE FILE MANAGEMENT ROUTES - Authentication required
// ===================================================================

// Add/Update images to existing service
// POST /services/:serviceId/images
// Body: { file: { url, fileName, mimeType, fileSize, uploadedAt } }
router.post("/:serviceId/images", authenticateToken, async (req, res) => {
  // Map serviceId to entityId for FileUploadController
  (req.params as any).entityType = "service";
  (req.params as any).entityId = req.params.serviceId;
  await FileUploadController.uploadFile(req, res);
});

// Get service images
// GET /services/:serviceId/images
router.get("/:serviceId/images", async (req, res) => {
  // Map serviceId to entityId for FileUploadController
  (req.params as any).entityType = "service";
  (req.params as any).entityId = req.params.serviceId;
  await FileUploadController.getFile(req, res);
});

// Delete all images from service
// DELETE /services/:serviceId/images
router.delete("/:serviceId/images", authenticateToken, async (req, res) => {
  // Map serviceId to entityId for FileUploadController
  (req.params as any).entityType = "service";
  (req.params as any).entityId = req.params.serviceId;
  await FileUploadController.deleteFile(req, res);
});

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

// Batch file operations for multiple services (admin only)
// POST /services/batch/images/:operation
// operation: 'get' | 'delete'
// Body: { entities: [{ entityType: 'service', entityId: 'serviceId1' }, ...] }
router.post(
  "/batch/images/:operation",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    await FileUploadController.batchFileOperation(req, res);
  }
);

// ===================================================================
// PUBLIC SERVICE ROUTES - No authentication required
// ===================================================================

// Get all services with filtering and pagination
<<<<<<< HEAD
router.get("/", optionalAuth, serviceController.getAllServices.bind(serviceController) as RequestHandler);
=======
router.get(
  "/",
  serviceController.getAllServices.bind(serviceController) as RequestHandler
);
>>>>>>> 28baaed94d025492a96317bbd0af68691587028f

// Get popular services
router.get(
  "/popular",
  serviceController.getPopularServices.bind(serviceController) as RequestHandler
);

// Get services with explicit pricing only (priceBasedOnServiceType: false)
router.get(
  "/with-pricing",
  serviceController.getServicesWithPricing.bind(
    serviceController
  ) as RequestHandler
);

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
  serviceController.getServicesByCategory.bind(
    serviceController
  ) as RequestHandler
);

// Get service by slug (for SEO-friendly URLs)
router.get(
  "/slug/:slug",
  serviceController.getServiceBySlug.bind(serviceController) as RequestHandler
);

// Get service by ID
router.get(
  "/:id",
  serviceController.getServiceById.bind(serviceController) as RequestHandler
);

export default router;
