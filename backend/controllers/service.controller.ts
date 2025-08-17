// controllers/service.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { ServiceModel } from "../models/service.model";
import { ServiceStatus } from "../types";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export class ServiceController {
  // Get all services with filtering and pagination
  static async getAllServices(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const {
        category,
        status,
        isPopular,
        tags,
        minPrice,
        maxPrice,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Build filter object
      const filter: any = { isDeleted: false };

      if (category) filter.categoryId = category;
      if (status) filter.status = status;
      if (isPopular !== undefined) filter.isPopular = isPopular === "true";
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        filter.tags = { $in: tagArray };
      }

      // Price filtering
      if (minPrice || maxPrice) {
        const priceFilter: any = {};
        if (minPrice) {
          priceFilter.$or = [
            { basePrice: { $gte: Number(minPrice) } },
            { "priceRange.min": { $gte: Number(minPrice) } },
          ];
        }
        if (maxPrice) {
          if (!priceFilter.$or) priceFilter.$or = [];
          priceFilter.$or.push(
            { basePrice: { $lte: Number(maxPrice) } },
            { "priceRange.max": { $lte: Number(maxPrice) } }
          );
        }
        Object.assign(filter, priceFilter);
      }

      // Text search
      if (search) {
        filter.$text = { $search: search as string };
      }

      // Sort options
      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;

      const services = await ServiceModel.find(filter)
        .populate("category", "name slug")
        .populate("submittedBy", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await ServiceModel.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: services,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching services",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get service by ID
  static async getServiceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      const service = await ServiceModel.findOne({
        _id: id,
        isDeleted: false,
      })
        .populate("category", "name slug description")
        .populate("submittedBy", "name email")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email");

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: service,
      });
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get service by slug
  static async getServiceBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const service = await ServiceModel.findBySlug(slug);

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: service,
      });
    } catch (error) {
      console.error("Error fetching service by slug:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Create new service
  static async createService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const serviceData = req.body;

      // Add submittedBy from authenticated user
      if (req.user) {
        serviceData.submittedBy = req.user.id;
      }

      // Validate required fields
      if (
        !serviceData.title ||
        !serviceData.description ||
        !serviceData.categoryId
      ) {
        res.status(400).json({
          success: false,
          message: "Title, description, and categoryId are required",
        });
        return;
      }

      const service = new ServiceModel(serviceData);
      await service.save();

      // Populate related fields for response
      await service.populate("category", "name slug");

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error creating service:", error);

      if (error instanceof Error && error.name === "ValidationError") {
        res.status(400).json({
          success: false,
          message: "Validation error",
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Error creating service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update service
  static async updateService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      // Remove fields that shouldn't be updated directly
      delete updates.submittedBy;
      delete updates.approvedBy;
      delete updates.approvedAt;
      delete updates.rejectedBy;
      delete updates.rejectedAt;

      const service = await ServiceModel.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { ...updates, lastModifiedBy: req.user?.id },
        { new: true, runValidators: true }
      ).populate("category", "name slug");

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service updated successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({
        success: false,
        message: "Error updating service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Soft delete service
  static async deleteService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      await service.softDelete(
        req.user?.id ? new Types.ObjectId(req.user.id) : undefined
      );

      res.status(200).json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Restore deleted service
  static async restoreService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: true });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Deleted service not found",
        });
        return;
      }

      await service.restore();

      res.status(200).json({
        success: true,
        message: "Service restored successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error restoring service:", error);
      res.status(500).json({
        success: false,
        message: "Error restoring service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Approve service
  static async approveService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User authentication required",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      await service.approve(new Types.ObjectId(req.user.id));

      res.status(200).json({
        success: true,
        message: "Service approved successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error approving service:", error);
      res.status(500).json({
        success: false,
        message: "Error approving service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Reject service
  static async rejectService(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "User authentication required",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      await service.reject(new Types.ObjectId(req.user.id), reason);

      res.status(200).json({
        success: true,
        message: "Service rejected successfully",
        data: service,
      });
    } catch (error) {
      console.error("Error rejecting service:", error);
      res.status(500).json({
        success: false,
        message: "Error rejecting service",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get popular services
  static async getPopularServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      // Execute the query with proper chaining
      const services = await ServiceModel.findPopular().limit(limit);

      res.status(200).json({
        success: true,
        data: services,
      });
    } catch (error) {
      console.error("Error fetching popular services:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching popular services",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Toggle popular status
  static async togglePopular(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid service ID",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });

      if (!service) {
        res.status(404).json({
          success: false,
          message: "Service not found",
        });
        return;
      }

      const wasPopular = service.isPopular;

      if (service.isPopular) {
        await service.unmarkPopular();
      } else {
        await service.markPopular();
      }

      res.status(200).json({
        success: true,
        message: `Service ${wasPopular ? "unmarked as" : "marked as"} popular`,
        data: service,
      });
    } catch (error) {
      console.error("Error toggling popular status:", error);
      res.status(500).json({
        success: false,
        message: "Error toggling popular status",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get services by category
  static async getServicesByCategory(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { categoryId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      if (!Types.ObjectId.isValid(categoryId)) {
        res.status(400).json({
          success: false,
          message: "Invalid category ID",
        });
        return;
      }

      // Execute the query with proper chaining
      const services = await ServiceModel.findByCategory(
        new Types.ObjectId(categoryId)
      )
        .skip(skip)
        .limit(limit);

      const total = await ServiceModel.countDocuments({
        categoryId: new Types.ObjectId(categoryId),
        status: ServiceStatus.APPROVED,
        isDeleted: false,
      });

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: services,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching services by category:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching services by category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Get pending services (for moderation)
  static async getPendingServices(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Execute the query with proper chaining
      const services = await ServiceModel.findPendingApproval()
        .populate("submittedBy", "name email")
        .skip(skip)
        .limit(limit);

      const total = await ServiceModel.countDocuments({
        status: ServiceStatus.PENDING_APPROVAL,
        isDeleted: false,
      });

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: services,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching pending services:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching pending services",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
