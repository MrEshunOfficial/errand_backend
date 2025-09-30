import express, { RequestHandler } from "express";
import { authenticateToken, optionalAuth, requireAdmin } from "../middleware/auth.middleware";
import { ServiceController } from "../controllers/service.controller";

const router = express.Router();
const serviceController = new ServiceController();

router.get(
  "/my-services",
  authenticateToken,
  serviceController.getUserServices.bind(serviceController) as RequestHandler
);

router.post(
  "/",
  authenticateToken,
  serviceController.createService.bind(serviceController) as RequestHandler
);

router.put(
  "/:id",
  authenticateToken,
  serviceController.updateService.bind(serviceController) as RequestHandler
);

router.delete(
  "/:id",
  authenticateToken,
  serviceController.deleteService.bind(serviceController) as RequestHandler
);

router.patch(
  "/:id/restore",
  authenticateToken,
  requireAdmin,
  serviceController.restoreService.bind(serviceController) as RequestHandler
);

router.patch(
  "/:id/toggle-popular",
  authenticateToken,
  requireAdmin,
  serviceController.togglePopular.bind(serviceController) as RequestHandler
);

router.patch(
  "/:id/approve",
  authenticateToken,
  requireAdmin,
  serviceController.approveService.bind(serviceController) as RequestHandler
);

router.patch(
  "/:id/reject",
  authenticateToken,
  requireAdmin,
  serviceController.rejectService.bind(serviceController) as RequestHandler
);

router.get("/", optionalAuth, serviceController.getAllServices.bind(serviceController) as RequestHandler);

router.get("/popular", serviceController.getPopularServices.bind(serviceController) as RequestHandler);

router.get("/with-pricing", serviceController.getServicesWithPricing.bind(serviceController) as RequestHandler);

router.get(
  "/pending",
  authenticateToken,
  requireAdmin,
  serviceController.getPendingServices.bind(serviceController) as RequestHandler
);

router.get(
  "/category/:categoryId",
  serviceController.getServicesByCategory.bind(serviceController) as RequestHandler
);

router.get("/slug/:slug", serviceController.getServiceBySlug.bind(serviceController) as RequestHandler);

router.get("/:id", serviceController.getServiceById.bind(serviceController) as RequestHandler);

router.post(
  "/:id/providers",
  authenticateToken,
  requireAdmin,
  serviceController.addProviderToService.bind(serviceController) as RequestHandler
);

router.delete(
  "/:id/providers",
  authenticateToken,
  requireAdmin,
  serviceController.removeProviderFromService.bind(serviceController) as RequestHandler
);

export default router;