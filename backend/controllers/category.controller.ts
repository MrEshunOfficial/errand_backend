import { Request, Response } from "express";
import { Types } from "mongoose";
import { CategoryModel } from "../models/category.model";
import { AuthenticatedRequest } from "../utils/controller-utils/controller.utils";
import {
  CategoryWithServices,
  ModerationStatus,
  ServiceStatus,
  SystemRole,
} from "../types";
import { ServiceModel } from "../models/service.model";

export class CategoryController {
  // ==================== HELPER METHODS ====================

  private static handleError(
    res: Response,
    error: unknown,
    message: string,
    statusCode = 500
  ): void {
    console.error(`${message}:`, error);

    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(400).json({
        success: false,
        message: message.includes("create")
          ? "Category with this name already exists"
          : "A category with this name already exists",
      });
      return;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  private static validateObjectId(id: string, fieldName = "ID"): boolean {
    return Types.ObjectId.isValid(id);
  }

  private static sendNotFoundResponse(
    res: Response,
    message = "Category not found"
  ): void {
    res.status(404).json({ success: false, message });
  }

  private static sendBadRequestResponse(res: Response, message: string): void {
    res.status(400).json({ success: false, message });
  }

  private static sendSuccessResponse(
    res: Response,
    data?: any,
    message?: string
  ): void {
    const response: any = { success: true };
    if (data) response.data = data;
    if (message) response.message = message;
    res.status(200).json(response);
  }

  private static getPaginationParams(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private static buildPaginationResponse(
    page: number,
    limit: number,
    total: number
  ) {
    return {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  private static buildCategoryQuery(
    query: any,
    includeInactive = false,
    req?: Request,
    includeDeleted = false
  ): any {
    const filter: any = {};
    if (!includeDeleted) {
      filter.isDeleted = false;
    } else if (req && !CategoryController.isAdminUser(req)) {
      filter.isDeleted = false;
    }

    if (!includeInactive) filter.isActive = true;

    const { search, parentId } = query;

    if (search) filter.$text = { $search: search as string };

    if (parentId && parentId !== "null") {
      if (!CategoryController.validateObjectId(parentId as string)) {
        throw new Error("Invalid parent category ID");
      }
      filter.parentCategoryId = new Types.ObjectId(parentId as string);
    } else if (parentId === null || parentId === "null") {
      filter.parentCategoryId = null;
    }

    return filter;
  }

  private static buildSortOptions(
    sortBy = "displayOrder",
    sortOrder = "asc"
  ): any {
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;
    return sort;
  }

  private static async findCategoryById(
    id: string,
    includeDeleted = false
  ): Promise<any> {
    if (!CategoryController.validateObjectId(id)) return null;

    const filter: any = { _id: id };
    if (!includeDeleted) filter.isDeleted = { $ne: true };

    return await CategoryModel.findOne(filter);
  }

  private static async validateParentCategory(
    parentCategoryId: string,
    currentId?: string
  ): Promise<string | null> {
    if (
      !parentCategoryId ||
      !CategoryController.validateObjectId(parentCategoryId)
    ) {
      return "Invalid parent category ID";
    }

    if (currentId && parentCategoryId === currentId) {
      return "Category cannot be its own parent";
    }

    const parentCategory = await CategoryModel.findById(parentCategoryId);
    if (!parentCategory || parentCategory.isDeleted) {
      return "Parent category not found";
    }

    return null;
  }

  private static getUserId(
    req: AuthenticatedRequest
  ): Types.ObjectId | undefined {
    return req.user?.id ? new Types.ObjectId(req.user.id) : undefined;
  }

  private static isAdminUser(req: Request): boolean {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return false;
    }

    return user?.isAdmin === true || user?.isSuperAdmin === true;
  }

  private static buildServiceQuery(
    categoryId: Types.ObjectId,
    req: Request,
    popularOnly = false
  ): any {
    const baseQuery = {
      categoryId,
      isDeleted: { $ne: true },
    };

    if (CategoryController.isAdminUser(req)) {
      return popularOnly ? { ...baseQuery, isPopular: true } : baseQuery;
    } else {
      return popularOnly
        ? { ...baseQuery, status: ServiceStatus.APPROVED, isPopular: true }
        : { ...baseQuery, status: ServiceStatus.APPROVED };
    }
  }

  private static buildServiceCountQuery(
    categoryId: Types.ObjectId,
    req: Request
  ): any {
    const baseQuery = {
      categoryId,
      isDeleted: { $ne: true },
    };

    if (CategoryController.isAdminUser(req)) {
      return baseQuery;
    } else {
      return { ...baseQuery, status: ServiceStatus.APPROVED };
    }
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Get categories with services - role-based service filtering
   */
  static async getCategoriesWithServices(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        servicesLimit = 10,
        popularOnly = false,
        includeSubcategories = false,
        includeUserData = false,
        includeInactive = false,
      } = req.query;

      const { page, limit, skip } = CategoryController.getPaginationParams(
        req.query
      );
      const includeDeleted = CategoryController.isAdminUser(req);
      const query = CategoryController.buildCategoryQuery(
        req.query,
        includeInactive === "true",
        req,
        includeDeleted
      );
      const sort = CategoryController.buildSortOptions(
        req.query.sortBy as string,
        req.query.sortOrder as string
      );

      const [categories, total] = await Promise.all([
        CategoryModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
        CategoryModel.countDocuments(query),
      ]);

      const categoriesWithServices: CategoryWithServices[] = [];

      for (const category of categories) {
        const serviceQuery = CategoryController.buildServiceQuery(
          category._id,
          req,
          popularOnly === "true"
        );
        const serviceCountQuery = CategoryController.buildServiceCountQuery(
          category._id,
          req
        );

        const [services, servicesCount] = await Promise.all([
          ServiceModel.find(serviceQuery)
            .limit(Number(servicesLimit))
            .sort({ createdAt: -1 })
            .lean(),
          ServiceModel.countDocuments(serviceCountQuery),
        ]);

        const categoryWithServices: CategoryWithServices = {
          ...category,
          services,
          servicesCount,
        };

        if (includeSubcategories === "true") {
          const subcategories = await CategoryModel.find({
            parentCategoryId: category._id,
            isActive: true,
            isDeleted: false,
          })
            .sort({ displayOrder: 1 })
            .lean();

          const subcategoriesWithServices = await Promise.all(
            subcategories.map(async (subcat) => {
              const subcatServiceCountQuery =
                CategoryController.buildServiceCountQuery(subcat._id, req);
              const subcatServicesCount = await ServiceModel.countDocuments(
                subcatServiceCountQuery
              );

              return {
                ...subcat,
                servicesCount: subcatServicesCount,
              };
            })
          );

          categoryWithServices.subcategories = subcategoriesWithServices;
        }

        categoriesWithServices.push(categoryWithServices);
      }

      if (includeUserData === "true") {
        await CategoryModel.populate(categoriesWithServices, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, {
        categories: categoriesWithServices,
        pagination: CategoryController.buildPaginationResponse(
          page,
          limit,
          total
        ),
      });
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch categories with services"
      );
    }
  }

  /**
   * Get categories - with optional services
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const includeSubcategories = req.query.includeSubcategories === "true";
      const includeUserData = req.query.includeUserData === "true";
      const includeInactive = req.query.includeInactive === "true";
      const includeServices = req.query.includeServices === "true";

      if (includeServices) {
        return CategoryController.getCategoriesWithServices(req, res);
      }

      const { page, limit, skip } = CategoryController.getPaginationParams(
        req.query
      );
      const includeDeleted = CategoryController.isAdminUser(req);
      const query = CategoryController.buildCategoryQuery(
        req.query,
        includeInactive,
        req,
        includeDeleted
      );
      const sort = CategoryController.buildSortOptions(
        req.query.sortBy as string,
        req.query.sortOrder as string
      );

      let categoryQuery = CategoryModel.find(query);

      if (includeSubcategories) {
        categoryQuery = categoryQuery.populate("subcategories");
      }

      if (includeUserData) {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const [categories, total] = await Promise.all([
        categoryQuery.sort(sort).skip(skip).limit(limit).lean(),
        CategoryModel.countDocuments(query),
      ]);

      const categoriesWithCounts: CategoryWithServices[] = await Promise.all(
        categories.map(async (category): Promise<CategoryWithServices> => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            category._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...category,
            services: [],
            servicesCount,
          };
        })
      );

      CategoryController.sendSuccessResponse(res, {
        categories: categoriesWithCounts,
        pagination: CategoryController.buildPaginationResponse(
          page,
          limit,
          total
        ),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid parent")) {
        CategoryController.sendBadRequestResponse(res, error.message);
        return;
      }
      CategoryController.handleError(res, error, "Failed to fetch categories");
    }
  }

  /**
   * Get deleted categories - admin only
   */
  static async getDeletedCategories(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!CategoryController.isAdminUser(req)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Only admin users can access deleted categories"
        );
        return;
      }

      const { page, limit, skip } = CategoryController.getPaginationParams(
        req.query
      );
      const { includeUserData = false, includeSubcategories = false } =
        req.query;

      const query = {
        isDeleted: true,
      };

      const sort = CategoryController.buildSortOptions(
        req.query.sortBy as string,
        req.query.sortOrder as string
      );

      let categoryQuery = CategoryModel.find(query);

      if (includeSubcategories) {
        categoryQuery = categoryQuery.populate("subcategories");
      }

      // Always populate deletedBy for deleted categories
      categoryQuery = categoryQuery.populate(
        "deletedBy",
        "name email displayName"
      );

      if (includeUserData === "true") {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const [categories, total] = await Promise.all([
        categoryQuery.sort(sort).skip(skip).limit(limit).lean(),
        CategoryModel.countDocuments(query),
      ]);

      const categoriesWithCounts: CategoryWithServices[] = await Promise.all(
        categories.map(async (category): Promise<CategoryWithServices> => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            category._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...category,
            services: [],
            servicesCount,
          };
        })
      );

      CategoryController.sendSuccessResponse(
        res,
        {
          categories: categoriesWithCounts,
          pagination: CategoryController.buildPaginationResponse(
            page,
            limit,
            total
          ),
        },
        "Deleted categories fetched successfully"
      );
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch deleted categories"
      );
    }
  }

  /**
   * Get deleted category by ID - admin only
   */
  static async getDeletedCategoryById(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!CategoryController.isAdminUser(req)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Only admin users can access deleted categories"
        );
        return;
      }

      const { id } = req.params;
      const {
        includeSubcategories = false,
        includeUserData = false,
        includeServices = false,
        servicesLimit = 10,
        popularOnly = false,
      } = req.query;

      if (!CategoryController.validateObjectId(id)) {
        CategoryController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      const query = { _id: id, isDeleted: true };

      let categoryQuery = CategoryModel.findOne(query);

      // Always populate deletedBy for deleted categories
      categoryQuery = categoryQuery.populate(
        "deletedBy",
        "name email displayName"
      );

      if (includeUserData === "true") {
        categoryQuery = categoryQuery
          .populate("createdBy", "name email displayName")
          .populate("lastModifiedBy", "name email displayName");
      }

      const category = await categoryQuery.lean();

      if (!category) {
        CategoryController.sendNotFoundResponse(
          res,
          "Deleted category not found"
        );
        return;
      }

      const categoryData: any = { ...category };

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      categoryData.servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      if (includeServices === "true") {
        const serviceQuery = CategoryController.buildServiceQuery(
          category._id,
          req,
          popularOnly === "true"
        );

        categoryData.services = await ServiceModel.find(serviceQuery)
          .limit(Number(servicesLimit))
          .sort({ createdAt: -1 })
          .lean();
      }

      if (includeSubcategories === "true") {
        const subcategories = await CategoryModel.find({
          parentCategoryId: category._id,
          isActive: true,
          isDeleted: false,
        })
          .sort({ displayOrder: 1 })
          .lean();

        const subcategoriesWithServices = await Promise.all(
          subcategories.map(async (subcat) => {
            const subcatData: any = { ...subcat };

            const subcatServiceCountQuery =
              CategoryController.buildServiceCountQuery(subcat._id, req);
            subcatData.servicesCount = await ServiceModel.countDocuments(
              subcatServiceCountQuery
            );

            if (includeServices === "true") {
              const subcatServiceQuery = CategoryController.buildServiceQuery(
                subcat._id,
                req,
                popularOnly === "true"
              );

              subcatData.services = await ServiceModel.find(subcatServiceQuery)
                .limit(Number(servicesLimit))
                .sort({ createdAt: -1 })
                .lean();
            }

            return subcatData;
          })
        );

        categoryData.subcategories = subcategoriesWithServices;
      }

      CategoryController.sendSuccessResponse(
        res,
        { category: categoryData },
        "Deleted category fetched successfully"
      );
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch deleted category"
      );
    }
  }

  /**
   * Get parent categories (categories with no parent)
   */
  static async getParentCategories(req: Request, res: Response): Promise<void> {
    try {
      const {
        includeSubcategories = false,
        includeServicesCount = false,
        includeUserData = false,
        includeInactive = false,
        includeServices = false,
        servicesLimit = 5,
        popularOnly = false,
      } = req.query;

      const baseQuery = {
        parentCategoryId: null,
        isDeleted: false,
        ...(includeInactive !== "true" && { isActive: true }),
      };

      const categories = await CategoryModel.find(baseQuery)
        .sort({ displayOrder: 1 })
        .lean();

      const categoriesWithData = await Promise.all(
        categories.map(async (category) => {
          const categoryData: any = { ...category };

          if (includeServicesCount === "true") {
            const serviceCountQuery = CategoryController.buildServiceCountQuery(
              category._id,
              req
            );
            categoryData.servicesCount = await ServiceModel.countDocuments(
              serviceCountQuery
            );
          }

          if (includeServices === "true") {
            const serviceQuery = CategoryController.buildServiceQuery(
              category._id,
              req,
              popularOnly === "true"
            );

            categoryData.services = await ServiceModel.find(serviceQuery)
              .limit(Number(servicesLimit))
              .sort({ createdAt: -1 })
              .lean();
          }

          if (includeSubcategories === "true") {
            const subcategories = await CategoryModel.find({
              parentCategoryId: category._id,
              isDeleted: false,
              ...(includeInactive !== "true" && { isActive: true }),
            })
              .sort({ displayOrder: 1 })
              .lean();

            const subcategoriesWithServices = await Promise.all(
              subcategories.map(async (subcat) => {
                const subcatData: any = { ...subcat };

                if (includeServices === "true") {
                  const subcatServiceQuery =
                    CategoryController.buildServiceQuery(
                      subcat._id,
                      req,
                      popularOnly === "true"
                    );

                  subcatData.services = await ServiceModel.find(
                    subcatServiceQuery
                  )
                    .limit(Number(servicesLimit))
                    .sort({ createdAt: -1 })
                    .lean();
                }

                if (includeServicesCount === "true") {
                  const subcatServiceCountQuery =
                    CategoryController.buildServiceCountQuery(subcat._id, req);
                  subcatData.servicesCount = await ServiceModel.countDocuments(
                    subcatServiceCountQuery
                  );
                }

                return subcatData;
              })
            );

            categoryData.subcategories = subcategoriesWithServices;
          }

          return categoryData;
        })
      );

      if (includeUserData === "true") {
        await CategoryModel.populate(categoriesWithData, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, {
        categories: categoriesWithData,
      });
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch parent categories"
      );
    }
  }

  /**
   * Get subcategories for a specific parent category
   */
  static async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;
      const { includeUserData = false } = req.query;

      if (!CategoryController.validateObjectId(parentId)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Invalid parent category ID"
        );
        return;
      }

      const subcategories = await CategoryModel.find({
        parentCategoryId: new Types.ObjectId(parentId),
        isActive: true,
        isDeleted: false,
      })
        .sort({ displayOrder: 1 })
        .lean();

      const subcategoriesWithCounts = await Promise.all(
        subcategories.map(async (subcat) => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            subcat._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...subcat,
            servicesCount,
          };
        })
      );

      if (includeUserData === "true") {
        await CategoryModel.populate(subcategoriesWithCounts, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, {
        subcategories: subcategoriesWithCounts,
      });
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch subcategories"
      );
    }
  }

  /**
   * Get category by ID or slug - shared logic
   */
  private static async getCategoryByIdentifier(
    req: Request,
    res: Response,
    identifier: string,
    isSlug = false
  ): Promise<void> {
    try {
      const {
        includeSubcategories = false,
        includeUserData = false,
        includeServices = false,
        servicesLimit = 10,
        popularOnly = false,
      } = req.query;

      if (!isSlug && !CategoryController.validateObjectId(identifier)) {
        CategoryController.sendBadRequestResponse(res, "Invalid category ID");
        return;
      }

      const query = isSlug
        ? { slug: identifier, isDeleted: false }
        : { _id: identifier, isDeleted: false };

      const category = await CategoryModel.findOne(query).lean();

      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      const categoryData: any = { ...category };

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      categoryData.servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      if (includeServices === "true") {
        const serviceQuery = CategoryController.buildServiceQuery(
          category._id,
          req,
          popularOnly === "true"
        );

        categoryData.services = await ServiceModel.find(serviceQuery)
          .limit(Number(servicesLimit))
          .sort({ createdAt: -1 })
          .lean();
      }

      if (includeSubcategories === "true") {
        const subcategories = await CategoryModel.find({
          parentCategoryId: category._id,
          isActive: true,
          isDeleted: false,
        })
          .sort({ displayOrder: 1 })
          .lean();

        const subcategoriesWithServices = await Promise.all(
          subcategories.map(async (subcat) => {
            const subcatData: any = { ...subcat };

            const subcatServiceCountQuery =
              CategoryController.buildServiceCountQuery(subcat._id, req);
            subcatData.servicesCount = await ServiceModel.countDocuments(
              subcatServiceCountQuery
            );

            if (includeServices === "true") {
              const subcatServiceQuery = CategoryController.buildServiceQuery(
                subcat._id,
                req,
                popularOnly === "true"
              );

              subcatData.services = await ServiceModel.find(subcatServiceQuery)
                .limit(Number(servicesLimit))
                .sort({ createdAt: -1 })
                .lean();
            }

            return subcatData;
          })
        );

        categoryData.subcategories = subcategoriesWithServices;
      }

      if (!isSlug || includeUserData === "true") {
        await CategoryModel.populate(categoryData, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, { category: categoryData });
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        `Failed to fetch category${isSlug ? " by slug" : ""}`
      );
    }
  }

  /**
   * Get category by slug
   */
  static async getCategoryBySlug(req: Request, res: Response): Promise<void> {
    return CategoryController.getCategoryByIdentifier(
      req,
      res,
      req.params.slug,
      true
    );
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(req: Request, res: Response): Promise<void> {
    return CategoryController.getCategoryByIdentifier(
      req,
      res,
      req.params.id,
      false
    );
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Create a new category
   */
  static async createCategory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const {
        name,
        description,
        image,
        tags,
        parentCategoryId,
        displayOrder,
        metaDescription,
      } = req.body;

      if (parentCategoryId) {
        const validationError = await CategoryController.validateParentCategory(
          parentCategoryId
        );
        if (validationError) {
          CategoryController.sendBadRequestResponse(res, validationError);
          return;
        }
      }

      const userId = CategoryController.getUserId(req);
      const categoryData = {
        name,
        description,
        image,
        tags,
        metaDescription,
        parentCategoryId: parentCategoryId
          ? new Types.ObjectId(parentCategoryId)
          : null,
        displayOrder: displayOrder || 0,
        createdBy: userId,
        lastModifiedBy: userId,
        moderationStatus: ModerationStatus.PENDING,
      };

      const category = new CategoryModel(categoryData);
      await category.save();

      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      const servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      const categoryWithCount = {
        ...category.toObject(),
        servicesCount,
      };

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category: categoryWithCount },
      });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to create category");
    }
  }

  /**
   * Update an existing category
   */
  static async updateCategory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      if (updateData.parentCategoryId) {
        const validationError = await CategoryController.validateParentCategory(
          updateData.parentCategoryId,
          id
        );
        if (validationError) {
          CategoryController.sendBadRequestResponse(res, validationError);
          return;
        }
        updateData.parentCategoryId = new Types.ObjectId(
          updateData.parentCategoryId
        );
      }

      updateData.lastModifiedBy = CategoryController.getUserId(req);

      const updatedCategory = await CategoryModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        updatedCategory!._id,
        req
      );
      const servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      const categoryWithData = {
        ...updatedCategory,
        servicesCount,
      };

      await CategoryModel.populate(categoryWithData, [
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      CategoryController.sendSuccessResponse(
        res,
        { category: categoryWithData },
        "Category updated successfully"
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to update category");
    }
  }

  /**
   * Soft delete a category
   */
  static async deleteCategory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      const subcategoriesCount = await CategoryModel.countDocuments({
        parentCategoryId: id,
        isDeleted: false,
      });

      if (subcategoriesCount > 0) {
        CategoryController.sendBadRequestResponse(
          res,
          "Cannot delete category with active subcategories"
        );
        return;
      }

      await category.softDelete(CategoryController.getUserId(req));
      CategoryController.sendSuccessResponse(
        res,
        null,
        "Category deleted successfully"
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to delete category");
    }
  }

  /**
   * Restore a soft-deleted category
   */
  static async restoreCategory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id, true);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      if (!category.isDeleted) {
        CategoryController.sendBadRequestResponse(
          res,
          "Category is not deleted"
        );
        return;
      }

      await category.restore();
      category.lastModifiedBy = CategoryController.getUserId(req);
      await category.save();

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      const servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      const categoryWithCount = {
        ...category.toObject(),
        servicesCount,
      };

      CategoryController.sendSuccessResponse(
        res,
        { category: categoryWithCount },
        "Category restored successfully"
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to restore category");
    }
  }

  /**
   * Toggle category active status
   */
  static async toggleCategoryStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      category.isActive = !category.isActive;
      category.lastModifiedBy = CategoryController.getUserId(req);
      await category.save();

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      const servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      const categoryWithCount = {
        ...category.toObject(),
        servicesCount,
      };

      CategoryController.sendSuccessResponse(
        res,
        { category: categoryWithCount },
        `Category ${
          category.isActive ? "activated" : "deactivated"
        } successfully`
      );
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to toggle category status"
      );
    }
  }

  /**
   * Update display order for multiple categories
   */
  static async updateDisplayOrder(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { categories } = req.body;

      if (!Array.isArray(categories)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Categories should be an array"
        );
        return;
      }

      const userId = CategoryController.getUserId(req);
      const updatePromises = categories.map(({ id, displayOrder }) => {
        if (!CategoryController.validateObjectId(id)) {
          throw new Error(`Invalid category ID: ${id}`);
        }
        return CategoryModel.findByIdAndUpdate(
          id,
          {
            displayOrder,
            lastModifiedBy: userId,
          },
          { new: true }
        );
      });

      const updatedCategories = await Promise.all(updatePromises);

      const populatedCategories = await Promise.all(
        updatedCategories.map((category) =>
          category?.populate([
            { path: "createdBy", select: "name email displayName" },
            { path: "lastModifiedBy", select: "name email displayName" },
          ])
        )
      );

      CategoryController.sendSuccessResponse(
        res,
        { categories: populatedCategories },
        "Display order updated successfully"
      );
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to update display order"
      );
    }
  }

  /**
   * Search categories by text
   */
  static async searchCategories(req: Request, res: Response): Promise<void> {
    try {
      const {
        q,
        limit = 20,
        includeInactive = false,
        parentId,
        includeUserData = false,
      } = req.query;

      if (!q || typeof q !== "string") {
        CategoryController.sendBadRequestResponse(
          res,
          "Search query is required"
        );
        return;
      }

      const query: any = {
        $text: { $search: q },
        isDeleted: false,
      };

      if (includeInactive !== "true") query.isActive = true;

      if (parentId && parentId !== "null") {
        if (!CategoryController.validateObjectId(parentId as string)) {
          CategoryController.sendBadRequestResponse(
            res,
            "Invalid parent category ID"
          );
          return;
        }
        query.parentCategoryId = new Types.ObjectId(parentId as string);
      }

      const categories = await CategoryModel.find(query)
        .select(
          "name description slug image displayOrder isActive parentCategoryId"
        )
        .limit(Number(limit))
        .sort({ score: { $meta: "textScore" } })
        .lean();

      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            category._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...category,
            servicesCount,
          };
        })
      );

      if (includeUserData === "true") {
        await CategoryModel.populate(categoriesWithCounts, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, {
        categories: categoriesWithCounts,
      });
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to search categories");
    }
  }

  /**
   * Moderate a single category
   */
  static async moderateCategory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { moderationStatus, moderationNotes } = req.body;

      if (!Object.values(ModerationStatus).includes(moderationStatus)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Invalid moderation status"
        );
        return;
      }

      const category = await CategoryController.findCategoryById(id);
      if (!category) {
        CategoryController.sendNotFoundResponse(res);
        return;
      }

      category.moderationStatus = moderationStatus;
      category.lastModifiedBy = CategoryController.getUserId(req);

      if (moderationNotes) {
        category.moderationNotes = moderationNotes;
      }

      if (moderationStatus === ModerationStatus.APPROVED) {
        category.isActive = true;
      } else if (moderationStatus === ModerationStatus.REJECTED) {
        category.isActive = false;
      }

      await category.save();

      const serviceCountQuery = CategoryController.buildServiceCountQuery(
        category._id,
        req
      );
      const servicesCount = await ServiceModel.countDocuments(
        serviceCountQuery
      );

      await category.populate([
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      const categoryWithCount = {
        ...category.toObject(),
        servicesCount,
      };

      CategoryController.sendSuccessResponse(
        res,
        { category: categoryWithCount },
        `Category ${moderationStatus.toLowerCase()} successfully`
      );
    } catch (error) {
      CategoryController.handleError(res, error, "Failed to moderate category");
    }
  }

  /**
   * Bulk moderate multiple categories
   */
  static async bulkModerateCategories(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { categoryIds, moderationStatus, moderationNotes } = req.body;

      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        CategoryController.sendBadRequestResponse(
          res,
          "Category IDs array is required and cannot be empty"
        );
        return;
      }

      if (!Object.values(ModerationStatus).includes(moderationStatus)) {
        CategoryController.sendBadRequestResponse(
          res,
          "Invalid moderation status"
        );
        return;
      }

      const invalidIds = categoryIds.filter(
        (id) => !CategoryController.validateObjectId(id)
      );
      if (invalidIds.length > 0) {
        CategoryController.sendBadRequestResponse(
          res,
          `Invalid category IDs: ${invalidIds.join(", ")}`
        );
        return;
      }

      const categories = await CategoryModel.find({
        _id: { $in: categoryIds },
        isDeleted: false,
      });

      if (categories.length === 0) {
        CategoryController.sendNotFoundResponse(
          res,
          "No valid categories found"
        );
        return;
      }

      const foundIds = categories.map((cat) => cat._id.toString());
      const notFoundIds = categoryIds.filter((id) => !foundIds.includes(id));

      const userId = CategoryController.getUserId(req);
      const updateData: any = {
        moderationStatus,
        lastModifiedBy: userId,
        moderatedBy: userId,
        moderatedAt: new Date(),
      };

      if (moderationNotes) {
        updateData.moderationNotes = moderationNotes;
      }

      if (moderationStatus === ModerationStatus.APPROVED) {
        updateData.isActive = true;
      } else if (moderationStatus === ModerationStatus.REJECTED) {
        updateData.isActive = false;
      }

      const updateResult = await CategoryModel.updateMany(
        { _id: { $in: foundIds } },
        updateData
      );

      const updatedCategories = await CategoryModel.find({
        _id: { $in: foundIds },
      }).lean();

      const categoriesWithCounts = await Promise.all(
        updatedCategories.map(async (category) => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            category._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...category,
            servicesCount,
          };
        })
      );

      await CategoryModel.populate(categoriesWithCounts, [
        { path: "createdBy", select: "name email displayName" },
        { path: "lastModifiedBy", select: "name email displayName" },
      ]);

      const response: any = {
        moderated: categoriesWithCounts.length,
        categories: categoriesWithCounts,
      };

      if (notFoundIds.length > 0) {
        response.notFound = notFoundIds;
        response.message = `${
          categoriesWithCounts.length
        } categories ${moderationStatus.toLowerCase()} successfully. ${
          notFoundIds.length
        } categories not found.`;
      }

      CategoryController.sendSuccessResponse(
        res,
        response,
        response.message ||
          `${
            categoriesWithCounts.length
          } categories ${moderationStatus.toLowerCase()} successfully`
      );
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to bulk moderate categories"
      );
    }
  }

  /**
   * Get categories pending moderation
   */
  static async getPendingCategories(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { page, limit, skip } = CategoryController.getPaginationParams(
        req.query
      );
      const { includeUserData = false } = req.query;

      const query = {
        moderationStatus: ModerationStatus.PENDING,
        isDeleted: false,
      };

      const [categories, total] = await Promise.all([
        CategoryModel.find(query)
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CategoryModel.countDocuments(query),
      ]);

      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const serviceCountQuery = CategoryController.buildServiceCountQuery(
            category._id,
            req
          );
          const servicesCount = await ServiceModel.countDocuments(
            serviceCountQuery
          );

          return {
            ...category,
            servicesCount,
          };
        })
      );

      if (includeUserData === "true") {
        await CategoryModel.populate(categoriesWithCounts, [
          { path: "createdBy", select: "name email displayName" },
          { path: "lastModifiedBy", select: "name email displayName" },
        ]);
      }

      CategoryController.sendSuccessResponse(res, {
        categories: categoriesWithCounts,
        pagination: CategoryController.buildPaginationResponse(
          page,
          limit,
          total
        ),
      });
    } catch (error) {
      CategoryController.handleError(
        res,
        error,
        "Failed to fetch pending categories"
      );
    }
  }
}
