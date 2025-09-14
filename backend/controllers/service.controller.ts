// controllers/service.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { ServiceModel } from "../models/service.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import { ServiceStatus } from "../types";
export class ServiceController {
  private handleError(res: Response, error: unknown, message: string, statusCode = 500): void {
    console.error(`${message}:`, error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    if (error instanceof Error && error.name === "ValidationError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
      return;
    }
    res.status(statusCode).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  private validateObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  private getPaginationParams(query: any) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private buildPaginationResponse(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      currentPage: page,
      totalPages,
      totalItems: total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  private buildPriceFilter(minPrice?: string, maxPrice?: string) {
    if (!minPrice && !maxPrice) return null;

    const priceConditions: any[] = [];
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    if (min && max) {
      priceConditions.push(
        { basePrice: { $gte: min, $lte: max } },
        { $and: [{ "priceRange.min": { $lte: max } }, { "priceRange.max": { $gte: min } }] }
      );
    } else if (min) {
      priceConditions.push(
        { basePrice: { $gte: min } },
        { "priceRange.max": { $gte: min } }
      );
    } else if (max) {
      priceConditions.push(
        { basePrice: { $lte: max } },
        { "priceRange.min": { $lte: max } }
      );
    }

    return priceConditions.length > 0 ? { $or: priceConditions } : null;
  }

  private validatePricingData(serviceData: any): string | null {
    if (serviceData.priceBasedOnServiceType === false) {
      if (!serviceData.basePrice && !serviceData.priceRange) {
        return "When pricing is not based on service, either the base price or price range must be provided";
      }
      if (serviceData.basePrice && serviceData.priceRange) {
        return "Cannot have both base price and price range";
      }
      if (serviceData.priceRange) {
        const { min, max } = serviceData.priceRange;
        if (!min || !max || min >= max) {
          return "Invalid price range: min must be less than max";
        }
      }
    }
    return null;
  }

  private buildServiceFilter(query: any, baseFilter: any = {}, isAdmin: boolean = false) {
    // Only include isDeleted: false if user is not admin or admin explicitly wants non-deleted services
    const filter = { 
      ...baseFilter, 
      ...((!isAdmin || query.includeDeleted === "false") && { isDeleted: false })
    };
    
    const {
      category, status, isPopular, tags, minPrice, maxPrice, search,
      priceBasedOnServiceType
    } = query;

    if (category) filter.categoryId = category;
    if (status) filter.status = status;
    if (isPopular !== undefined) filter.isPopular = isPopular === "true";
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }
    if (priceBasedOnServiceType !== undefined) {
      filter.priceBasedOnServiceType = priceBasedOnServiceType === "true";
    }
    if (search) {
      filter.$text = { $search: search as string };
    }

    if (minPrice || maxPrice) {
      filter.priceBasedOnServiceType = false;
      const priceFilter = this.buildPriceFilter(minPrice, maxPrice);
      if (priceFilter) Object.assign(filter, priceFilter);
    }

    return filter;
  }

  private async paginatedQuery(
    query: any,
    filter: any,
    populate: string[] = ["category", "submittedBy"],
    additionalPopulate: string[] = []
  ) {
    const { page, limit, skip } = this.getPaginationParams(query);
    const { sortBy = "createdAt", sortOrder = "desc" } = query;
    
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    let queryBuilder = ServiceModel.find(filter);
    
    [...populate, ...additionalPopulate].forEach(field => {
      if (field === "category") queryBuilder = queryBuilder.populate("category", "name slug");
      else if (field === "submittedBy") queryBuilder = queryBuilder.populate("submittedBy", "name email");
      else if (field === "approvedBy") queryBuilder = queryBuilder.populate("approvedBy", "name email");
      else if (field === "rejectedBy") queryBuilder = queryBuilder.populate("rejectedBy", "name email");
      else if (field === "deletedBy") queryBuilder = queryBuilder.populate("deletedBy", "name email");
    });

    const [data, total] = await Promise.all([
      queryBuilder.sort(sortOptions).skip(skip).limit(limit).lean(),
      ServiceModel.countDocuments(filter)
    ]);

    return {
      data,
      pagination: this.buildPaginationResponse(page, limit, total),
      total
    };
  }

  async getAllServices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check if user is admin
      const isAdmin = req.user?.isAdmin || req.user?.isSuperAdmin || false;
      
      const filter = this.buildServiceFilter(req.query, {}, isAdmin);
      
      // Add additional populate fields for admins to see deletion info
      const additionalPopulate = isAdmin ? ["deletedBy"] : [];
      
      const result = await this.paginatedQuery(req.query, filter, ["category", "submittedBy"], additionalPopulate);
      
      // Add admin-specific metadata if user is admin
      const response: any = {
        success: true,
        ...result
      };

      if (isAdmin) {
        // Get deletion status counts for admin
        const deletionCounts = await ServiceModel.aggregate([
          { 
            $group: { 
              _id: "$isDeleted", 
              count: { $sum: 1 } 
            } 
          },
        ]);

        const deletionSummary = deletionCounts.reduce((acc, item) => {
          acc[item._id ? 'deleted' : 'active'] = item.count;
          return acc;
        }, {} as Record<string, number>);

        response.adminMetadata = {
          deletionCounts: deletionSummary,
          totalServices: deletionSummary.deleted + deletionSummary.active || 0,
          includesDeleted: req.query.includeDeleted !== "false"
        };
      }

      res.status(200).json(response);
    } catch (error) {
      this.handleError(res, error, "Error fetching services");
    }
  }

  async getUserServices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }

      const { includeDeleted = "false" } = req.query;
      const baseFilter = {
        submittedBy: new Types.ObjectId(req.user.id),
        isDeleted: includeDeleted === "true" ? undefined : false,
      };

      const filter = this.buildServiceFilter(req.query, baseFilter);
      const result = await this.paginatedQuery(req.query, filter, [], ["approvedBy", "rejectedBy"]);

      const statusCounts = await ServiceModel.aggregate([
        { $match: { submittedBy: new Types.ObjectId(req.user.id), ...(includeDeleted !== "true" && { isDeleted: false }) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const statusSummary = statusCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>);

      res.status(200).json({
        success: true,
        ...result,
        summary: {
          statusCounts: statusSummary,
          totalServices: result.total,
        },
      });
    } catch (error) {
      this.handleError(res, error, "Error fetching user services");
    }
  }

  async getServiceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      // Check if user is admin to allow viewing deleted services
      const isAdmin = (req as AuthenticatedRequest).user?.isAdmin || (req as AuthenticatedRequest).user?.isSuperAdmin || false;
      const filter: any = { _id: id };
      
      // Only add isDeleted filter if user is not admin
      if (!isAdmin) {
        filter.isDeleted = false;
      }

      const service = await ServiceModel.findOne(filter)
        .populate("category", "name slug description")
        .populate("submittedBy", "name email")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .populate("deletedBy", "name email");

      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      res.status(200).json({ success: true, data: service });
    } catch (error) {
      this.handleError(res, error, "Error fetching service");
    }
  }

  async getServiceBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const service = await ServiceModel.findBySlug(slug);

      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      res.status(200).json({ success: true, data: service });
    } catch (error) {
      this.handleError(res, error, "Error fetching service by slug");
    }
  }

  async createService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const serviceData = req.body;

      if (req.user) serviceData.submittedBy = req.user.id;

      if (!serviceData.title || !serviceData.description || !serviceData.categoryId) {
        res.status(400).json({
          success: false,
          message: "Title, description, and categoryId are required",
        });
        return;
      }

      const pricingError = this.validatePricingData(serviceData);
      if (pricingError) {
        res.status(400).json({ success: false, message: pricingError });
        return;
      }

      if (serviceData.priceBasedOnServiceType === true) {
        serviceData.basePrice = undefined;
        serviceData.priceRange = undefined;
        serviceData.priceDescription = undefined;
      }

      const service = new ServiceModel(serviceData);
      await service.save();
      await service.populate("category", "name slug");

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        data: service,
      });
    } catch (error) {
      this.handleError(res, error, "Error creating service");
    }
  }

  async updateService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      ["submittedBy", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt"]
        .forEach(field => delete updates[field]);

      if (updates.hasOwnProperty('priceBasedOnServiceType') && updates.priceBasedOnServiceType === false) {
        if (!updates.basePrice && !updates.priceRange) {
          const existingService = await ServiceModel.findOne({ _id: id, isDeleted: false });
          if (existingService && !existingService.basePrice && !existingService.priceRange) {
            res.status(400).json({
              success: false,
              message: "When setting priceBasedOnServiceType to false, either basePrice or priceRange must be provided",
            });
            return;
          }
        }

        const pricingError = this.validatePricingData(updates);
        if (pricingError) {
          res.status(400).json({ success: false, message: pricingError });
          return;
        }
      }

      const service = await ServiceModel.findOneAndUpdate(
        { _id: id, isDeleted: false },
        updates,
        { new: true, runValidators: true }
      ).populate("category", "name slug");

      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Service updated successfully",
        data: service,
      });
    } catch (error) {
      this.handleError(res, error, "Error updating service");
    }
  }

  async deleteService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });
      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      await service.softDelete(req.user?.id ? new Types.ObjectId(req.user.id) : undefined);
      res.status(200).json({ success: true, message: "Service deleted successfully" });
    } catch (error) {
      this.handleError(res, error, "Error deleting service");
    }
  }

  async restoreService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: true });
      if (!service) {
        res.status(404).json({ success: false, message: "Deleted service not found" });
        return;
      }

      await service.restore();
      res.status(200).json({ success: true, message: "Service restored successfully", data: service });
    } catch (error) {
      this.handleError(res, error, "Error restoring service");
    }
  }

  private async performServiceAction(
    req: AuthenticatedRequest,
    res: Response,
    action: 'approve' | 'reject',
    actionMessage: string
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id) || !req.user?.id) {
        res.status(400).json({
          success: false,
          message: !this.validateObjectId(id) ? "Invalid service ID" : "User authentication required",
        });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });
      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      if (action === 'approve') {
        await service.approve(new Types.ObjectId(req.user.id));
      } else {
        const { reason } = req.body;
        await service.reject(new Types.ObjectId(req.user.id), reason);
      }

      res.status(200).json({ success: true, message: actionMessage, data: service });
    } catch (error) {
      this.handleError(res, error, `Error ${action}ing service`);
    }
  }

  async approveService(req: AuthenticatedRequest, res: Response): Promise<void> {
    return this.performServiceAction(req, res, 'approve', 'Service approved successfully');
  }

  async rejectService(req: AuthenticatedRequest, res: Response): Promise<void> {
    return this.performServiceAction(req, res, 'reject', 'Service rejected successfully');
  }

  async getPopularServices(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const services = await ServiceModel.findPopular().limit(limit);
      res.status(200).json({ success: true, data: services });
    } catch (error) {
      this.handleError(res, error, "Error fetching popular services");
    }
  }

  async togglePopular(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!this.validateObjectId(id)) {
        res.status(400).json({ success: false, message: "Invalid service ID" });
        return;
      }

      const service = await ServiceModel.findOne({ _id: id, isDeleted: false });
      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      const wasPopular = service.isPopular;
      await (service.isPopular ? service.unmarkPopular() : service.markPopular());

      res.status(200).json({
        success: true,
        message: `Service ${wasPopular ? "unmarked as" : "marked as"} popular`,
        data: service,
      });
    } catch (error) {
      this.handleError(res, error, "Error toggling popular status");
    }
  }

  async getServicesByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const { page, limit, skip } = this.getPaginationParams(req.query);

      if (!this.validateObjectId(categoryId)) {
        res.status(400).json({ success: false, message: "Invalid category ID" });
        return;
      }

      const categoryObjectId = new Types.ObjectId(categoryId);
      const [services, total] = await Promise.all([
        ServiceModel.findByCategory(categoryObjectId).skip(skip).limit(limit),
        ServiceModel.countDocuments({
          categoryId: categoryObjectId,
          status: ServiceStatus.APPROVED,
          isDeleted: false,
        })
      ]);

      res.status(200).json({
        success: true,
        data: services,
        pagination: this.buildPaginationResponse(page, limit, total),
      });
    } catch (error) {
      this.handleError(res, error, "Error fetching services by category");
    }
  }

  async getPendingServices(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = this.getPaginationParams(req.query);
      
      const [services, total] = await Promise.all([
        ServiceModel.findPendingApproval()
          .populate("submittedBy", "name email")
          .skip(skip)
          .limit(limit),
        ServiceModel.countDocuments({ status: ServiceStatus.PENDING_APPROVAL, isDeleted: false })
      ]);

      res.status(200).json({
        success: true,
        data: services,
        pagination: this.buildPaginationResponse(page, limit, total),
      });
    } catch (error) {
      this.handleError(res, error, "Error fetching pending services");
    }
  }

  async getServicesWithPricing(req: Request, res: Response): Promise<void> {
    try {
      const baseFilter = {
        priceBasedOnServiceType: false,
        status: ServiceStatus.APPROVED,
        isDeleted: false,
      };
      
      const filter = this.buildServiceFilter(req.query, baseFilter);
      const result = await this.paginatedQuery(req.query, filter);

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      this.handleError(res, error, "Error fetching services with pricing");
    }
  }
}