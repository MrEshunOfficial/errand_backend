// controllers/service.controller.ts - Updated with provider population
import { Request, Response } from "express";
import { Types } from "mongoose";
import { ServiceModel } from "../models/service.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import { ServiceStatus } from "../types/base.types";
import { ProviderProfileModel } from "../models/providerProfile.model";

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
      priceBasedOnServiceType, providerId
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
    if (providerId) {
      if (this.validateObjectId(providerId)) {
        filter.providers = new Types.ObjectId(providerId);
      } else {
        // For now, ignore invalid providerId; could throw error if needed
      }
    }

    if (minPrice || maxPrice) {
      filter.priceBasedOnServiceType = false;
      const priceFilter = this.buildPriceFilter(minPrice, maxPrice);
      if (priceFilter) Object.assign(filter, priceFilter);
    }

    return filter;
  }

  private sortProviders(providers: any[], providerSort?: string): any[] {
    if (!providerSort || !providers || providers.length === 0) return providers;

    const [sortField = "businessName", sortDir = "asc"] = providerSort.split(" ");
    const dir = sortDir.toLowerCase() === "desc" ? -1 : 1;

    return providers.sort((a: any, b: any) => {
      let va = this.getProviderSortValue(a, sortField);
      let vb = this.getProviderSortValue(b, sortField);

      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
  }

  private getProviderSortValue(provider: any, field: string): any {
    if (field === "rating") {
      return provider.performanceMetrics?.averageRating || 0;
    }
    if (field === "businessName") {
      return provider.businessName?.toLowerCase() || "";
    }
    if (field === "reviewCount") {
      return provider.performanceMetrics?.reviewCount || 0;
    }
    // Add more fields as needed
    return 0;
  }

  // NEW: Method to populate service providers dynamically
  private async populateServiceProviders(services: any[]): Promise<any[]> {
    if (!services || services.length === 0) return services;

    const serviceIds = services.map(service => service._id);
    
    // Find all provider profiles that offer any of these services
    const providerProfiles = await ProviderProfileModel.find({
      serviceOfferings: { $in: serviceIds },
      isDeleted: { $ne: true }
    })
    .select("_id profileId businessName providerContactInfo performanceMetrics operationalStatus serviceOfferings")
    .populate("profileId", "fullName email profilePicture")
    .lean();

    // Group providers by service
    const serviceProvidersMap: { [serviceId: string]: any[] } = {};
    
    providerProfiles.forEach(provider => {
      provider.serviceOfferings?.forEach((serviceId: any) => {
        const serviceIdStr = serviceId.toString();
        if (!serviceProvidersMap[serviceIdStr]) {
          serviceProvidersMap[serviceIdStr] = [];
        }
        serviceProvidersMap[serviceIdStr].push(provider);
      });
    });

    // Update services with their providers
    return services.map(service => {
      const serviceIdStr = service._id.toString();
      const providers = serviceProvidersMap[serviceIdStr] || [];
      
      return {
        ...service,
        providers,
        providerCount: providers.length
      };
    });
  }

  // NEW: Method to update service provider counts in database
  private async updateServiceProviderCounts(serviceIds?: Types.ObjectId[]): Promise<void> {
    try {
      let servicesToUpdate = serviceIds;
      
      if (!servicesToUpdate) {
        // Get all service IDs if none provided
        const allServices = await ServiceModel.find({ isDeleted: false }).select('_id').lean();
        servicesToUpdate = allServices.map(s => s._id);
      }

      for (const serviceId of servicesToUpdate) {
        // Count providers offering this service
        const providerCount = await ProviderProfileModel.countDocuments({
          serviceOfferings: serviceId,
          isDeleted: { $ne: true }
        });

        // Get provider IDs
        const providers = await ProviderProfileModel.find({
          serviceOfferings: serviceId,
          isDeleted: { $ne: true }
        }).select('_id').lean();

        const providerIds = providers.map(p => p._id);

        // Update the service
        await ServiceModel.findByIdAndUpdate(serviceId, {
          providers: providerIds,
          providerCount
        });
      }
    } catch (error) {
      console.error('Error updating service provider counts:', error);
    }
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
    
    const allPopulate = [...populate, ...additionalPopulate];
    allPopulate.forEach(field => {
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

    // Always populate providers dynamically
    let servicesWithProviders = await this.populateServiceProviders(data);

    // Sort providers if requested
    if (query.includeProviders !== "false" && query.providerSort) {
      servicesWithProviders.forEach((service: any) => {
        if (service.providers) {
          service.providers = this.sortProviders(service.providers, query.providerSort as string);
        }
      });
    }

    // Filter out providers if not requested
    if (query.includeProviders === "false") {
      servicesWithProviders = servicesWithProviders.map(service => {
        const { providers, ...serviceWithoutProviders } = service;
        return serviceWithoutProviders;
      });
    }

    return {
      data: servicesWithProviders,
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

      // Determine populate fields
      let populateFields = ["category", "submittedBy"];
      
      const result = await this.paginatedQuery(req.query, filter, populateFields, additionalPopulate);
      
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

      let query = ServiceModel.findOne(filter)
        .populate("category", "name slug description")
        .populate("submittedBy", "name email")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .populate("deletedBy", "name email");

      const service: any = await query.lean();

      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      // Populate providers dynamically
      const [serviceWithProviders] = await this.populateServiceProviders([service]);

      // Sort providers if requested
      if (req.query.includeProviders !== "false" && req.query.providerSort && serviceWithProviders.providers) {
        serviceWithProviders.providers = this.sortProviders(serviceWithProviders.providers, req.query.providerSort as string);
      }

      // Remove providers if not requested
      if (req.query.includeProviders === "false") {
        delete serviceWithProviders.providers;
      }

      res.status(200).json({ success: true, data: serviceWithProviders });
    } catch (error) {
      this.handleError(res, error, "Error fetching service");
    }
  }

  async getServiceBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      // Check if user is admin to allow viewing deleted services
      const isAdmin = (req as AuthenticatedRequest).user?.isAdmin || (req as AuthenticatedRequest).user?.isSuperAdmin || false;
      
      // Build filter similar to getServiceById
      const filter: any = { slug };
      if (!isAdmin) {
        filter.isDeleted = false;
      }

      let query = ServiceModel.findOne(filter)
        .populate("category", "name slug description")
        .populate("submittedBy", "name email")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .populate("deletedBy", "name email");

      const service: any = await query.lean();

      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      // Populate providers dynamically
      const [serviceWithProviders] = await this.populateServiceProviders([service]);

      // Sort providers if requested
      if (req.query.includeProviders !== "false" && req.query.providerSort && serviceWithProviders.providers) {
        serviceWithProviders.providers = this.sortProviders(serviceWithProviders.providers, req.query.providerSort as string);
      }

      // Remove providers if not requested
      if (req.query.includeProviders === "false") {
        delete serviceWithProviders.providers;
      }

      res.status(200).json({ success: true, data: serviceWithProviders });
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

      // Ensure providers starts empty
      serviceData.providers = [];

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

      ["submittedBy", "approvedBy", "approvedAt", "rejectedBy", "rejectedAt", "providers", "providerCount"]
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
      let query = ServiceModel.findPopular();

      let services: any[] = await query.limit(limit).lean();

      // Populate providers dynamically
      services = await this.populateServiceProviders(services);

      // Sort providers if requested
      if (req.query.includeProviders !== "false" && req.query.providerSort) {
        services.forEach(service => {
          if (service.providers) {
            service.providers = this.sortProviders(service.providers, req.query.providerSort as string);
          }
        });
      }

      // Remove providers if not requested
      if (req.query.includeProviders === "false") {
        services = services.map(service => {
          const { providers, ...serviceWithoutProviders } = service;
          return serviceWithoutProviders;
        });
      }

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
      
      let query = ServiceModel.findByCategory(categoryObjectId);

      const [services, total] = await Promise.all([
        query.skip(skip).limit(limit).lean(),
        ServiceModel.countDocuments({
          categoryId: categoryObjectId,
          status: ServiceStatus.APPROVED,
          isDeleted: false,
        })
      ]);

      // Populate providers dynamically
      let data: any[] = await this.populateServiceProviders(services);

      // Sort providers if requested
      if (req.query.includeProviders !== "false" && req.query.providerSort) {
        data.forEach(service => {
          if (service.providers) {
            service.providers = this.sortProviders(service.providers, req.query.providerSort as string);
          }
        });
      }

      // Remove providers if not requested
      if (req.query.includeProviders === "false") {
        data = data.map(service => {
          const { providers, ...serviceWithoutProviders } = service;
          return serviceWithoutProviders;
        });
      }

      res.status(200).json({
        success: true,
        data,
        pagination: this.buildPaginationResponse(page, limit, total),
      });
    } catch (error) {
      this.handleError(res, error, "Error fetching services by category");
    }
  }

  async getPendingServices(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, skip } = this.getPaginationParams(req.query);
      
      let query = ServiceModel.findPendingApproval()
        .populate("submittedBy", "name email");

      const [services, total] = await Promise.all([
        query.skip(skip).limit(limit).lean(),
        ServiceModel.countDocuments({ status: ServiceStatus.PENDING_APPROVAL, isDeleted: false })
      ]);

      // Populate providers dynamically
      let data: any[] = await this.populateServiceProviders(services);

      // Sort providers if requested
      if (req.query.includeProviders !== "false" && req.query.providerSort) {
        data.forEach(service => {
          if (service.providers) {
            service.providers = this.sortProviders(service.providers, req.query.providerSort as string);
          }
        });
      }

      // Remove providers if not requested
      if (req.query.includeProviders === "false") {
        data = data.map(service => {
          const { providers, ...serviceWithoutProviders } = service;
          return serviceWithoutProviders;
        });
      }

      res.status(200).json({
        success: true,
        data,
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

      // Determine populate fields
      let populateFields = ["category", "submittedBy"];

      const result = await this.paginatedQuery(req.query, filter, populateFields);

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      this.handleError(res, error, "Error fetching services with pricing");
    }
  }

  // Updated method: Add provider to service
  async addProviderToService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: serviceId } = req.params;
      const { providerId } = req.body;

      if (!this.validateObjectId(serviceId) || !this.validateObjectId(providerId)) {
        res.status(400).json({ success: false, message: "Invalid service or provider ID" });
        return;
      }

      const service = await ServiceModel.findOne({ _id: serviceId, isDeleted: false });
      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      // Check if provider exists
      const provider = await ProviderProfileModel.findById(providerId);
      if (!provider) {
        res.status(404).json({ success: false, message: "Provider not found" });
        return;
      }

      const providerObjectId = new Types.ObjectId(providerId);
      
      // Add service to provider's serviceOfferings if not already there
      if (!provider.serviceOfferings?.includes(new Types.ObjectId(serviceId))) {
        await provider.addServiceOffering(new Types.ObjectId(serviceId));
      }

      // Update service provider counts
      await this.updateServiceProviderCounts([new Types.ObjectId(serviceId)]);

      // Get updated service with providers
      const updatedService = await ServiceModel.findById(serviceId);

      res.status(200).json({
        success: true,
        message: "Provider added to service successfully",
        data: updatedService,
      });
    } catch (error) {
      this.handleError(res, error, "Error adding provider to service");
    }
  }

  // Updated method: Remove provider from service
  async removeProviderFromService(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id: serviceId } = req.params;
      const { providerId } = req.body;

      if (!this.validateObjectId(serviceId) || !this.validateObjectId(providerId)) {
        res.status(400).json({ success: false, message: "Invalid service or provider ID" });
        return;
      }

      const service = await ServiceModel.findOne({ _id: serviceId, isDeleted: false });
      if (!service) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }

      // Check if provider exists
      const provider = await ProviderProfileModel.findById(providerId);
      if (!provider) {
        res.status(404).json({ success: false, message: "Provider not found" });
        return;
      }

      // Remove service from provider's serviceOfferings
      await provider.removeServiceOffering(new Types.ObjectId(serviceId));

      // Update service provider counts
      await this.updateServiceProviderCounts([new Types.ObjectId(serviceId)]);

      // Get updated service
      const updatedService = await ServiceModel.findById(serviceId);

      res.status(200).json({
        success: true,
        message: "Provider removed from service successfully",
        data: updatedService,
      });
    } catch (error) {
      this.handleError(res, error, "Error removing provider from service");
    }
  }

  // NEW: Utility method to sync all service provider counts
  async syncServiceProviderCounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await this.updateServiceProviderCounts();
      
      res.status(200).json({
        success: true,
        message: "Service provider counts synchronized successfully"
      });
    } catch (error) {
      this.handleError(res, error, "Error synchronizing service provider counts");
    }
  }

  // NEW: Get services by provider
  async getServicesByProvider(req: Request, res: Response): Promise<void> {
    try {
      const { providerId } = req.params;

      if (!this.validateObjectId(providerId)) {
        res.status(400).json({ success: false, message: "Invalid provider ID" });
        return;
      }

      // Find provider
      const provider = await ProviderProfileModel.findById(providerId);
      if (!provider) {
        res.status(404).json({ success: false, message: "Provider not found" });
        return;
      }

      // Get services offered by this provider
      const filter = {
        _id: { $in: provider.serviceOfferings },
        status: ServiceStatus.APPROVED,
        isDeleted: false
      };

      const result = await this.paginatedQuery(req.query, filter, ["category"]);

      res.status(200).json({
        success: true,
        ...result,
        provider: {
          _id: provider._id,
          businessName: provider.businessName,
          performanceMetrics: provider.performanceMetrics
        }
      });
    } catch (error) {
      this.handleError(res, error, "Error fetching services by provider");
    }
  }

}