import { Types } from "mongoose";
import { Request, Response } from "express";
import {
  ReviewModel,
  ProviderRatingStatsModel,
  ServiceRatingStatsModel,
} from "../models/review.model";
import {
  ReviewResponse,
  CreateReviewRequest,
  SimpleReviewRequest,
  PaginationOptions,
  ReviewFilters,
  ReviewDocumentType,
} from "../types/review.types";
import { ModerationStatus, UserRole } from "../types/base.types";
import {
  AuthenticatedRequest,
  handleError,
  validateObjectId,
} from "../utils/controller-utils/controller.utils";

// Unified response helper
const respond = (
  res: Response,
  data: any = null,
  message = "Success",
  statusCode = 200
) =>
  res.status(statusCode).json({
    success: statusCode < 400,
    message,
    data,
    timestamp: new Date().toISOString(),
  });

// Unified error response
const respondError = (res: Response, message: string, statusCode = 400) =>
  respond(res, null, message, statusCode);

// Validation schemas
const validators = {
  rating: (rating: number) =>
    rating >= 1 && rating <= 5 && Number.isInteger(rating),
  comment: (comment?: string) => !comment || comment.length <= 2000,
  images: (images?: any[]) => !images || images.length <= 5,
  objectId: (id: string) => validateObjectId(id),
  responseComment: (comment: string) =>
    comment?.trim().length > 0 && comment.length <= 1000,
};

// Validation helper with automatic response
const validate = (res: Response, checks: Array<[boolean, string]>) => {
  for (const [isValid, message] of checks) {
    if (!isValid) {
      respondError(res, message);
      return false;
    }
  }
  return true;
};

// Query builders
const buildQuery = {
  reviews: (filters: ReviewFilters, includeModeration = false) => {
    const query: any = { isDeleted: { $ne: true } };
    if (!includeModeration) query.moderationStatus = ModerationStatus.APPROVED;

    // Apply filters dynamically
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === "dateFrom")
          query.createdAt = { ...query.createdAt, $gte: new Date(value) };
        else if (key === "dateTo")
          query.createdAt = { ...query.createdAt, $lte: new Date(value) };
        else query[key] = value;
      }
    });

    return query;
  },

  pagination: (
    queryBuilder: any,
    {
      page = 1,
      limit = 20,
      sort = "createdAt",
      sortOrder = "desc",
    }: PaginationOptions
  ) => {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(50, Math.max(1, limit));
    const sortObj = { [sort]: sortOrder === "asc" ? 1 : -1 };

    return queryBuilder
      .sort(sortObj)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);
  },
};

// Common population patterns
const populate = {
  full: [
    { path: "reviewerId", select: "fullName profilePicture userRole" },
    { path: "revieweeId", select: "fullName profilePicture userRole" },
    { path: "serviceId", select: "name category description" },
    {
      path: "responses.responderId",
      select: "fullName profilePicture userRole",
    },
  ],
  basic: [
    { path: "reviewerId", select: "fullName profilePicture userRole" },
    { path: "revieweeId", select: "fullName profilePicture userRole" },
    { path: "serviceId", select: "name category description" },
  ],
};

export class ReviewController {
  // Create review (simplified with auto-population)
  static async createReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const reviewData: SimpleReviewRequest & {
        revieweeId: string;
        serviceId?: string;
        projectId?: string;
      } = req.body;

      // Validate
      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!reviewData.revieweeId, "Reviewee ID is required"],
          [validators.objectId(reviewData.revieweeId), "Invalid reviewee ID"],
          [reviewData.revieweeId !== userId, "Cannot review yourself"],
          [!!reviewData.rating, "Rating is required"],
          [validators.rating(reviewData.rating), "Rating must be integer 1-5"],
          [
            validators.comment(reviewData.comment),
            "Comment too long (max 2000 chars)",
          ],
          [validators.images(reviewData.images), "Max 5 images allowed"],
          [
            !reviewData.serviceId || validators.objectId(reviewData.serviceId),
            "Invalid service ID",
          ],
          [
            !reviewData.projectId || validators.objectId(reviewData.projectId),
            "Invalid project ID",
          ],
        ])
      )
        return;

      // Check for duplicate
      const existingQuery = {
        reviewerId: new Types.ObjectId(userId),
        revieweeId: new Types.ObjectId(reviewData.revieweeId),
        isDeleted: { $ne: true },
        ...(reviewData.serviceId && {
          serviceId: new Types.ObjectId(reviewData.serviceId),
        }),
      };

      if (await ReviewModel.findOne(existingQuery)) {
        return respondError(res, "You have already reviewed this item", 409);
      }

      // Create review with auto-populated fields
      const review = await ReviewModel.create({
        // User input
        rating: reviewData.rating,
        comment: reviewData.comment?.trim(),
        images: reviewData.images,
        wouldRecommend: reviewData.wouldRecommend,

        // Auto-populated from context
        reviewerId: new Types.ObjectId(userId),
        revieweeId: new Types.ObjectId(reviewData.revieweeId),
        reviewerType: UserRole.PROVIDER || UserRole.CUSTOMER,
        revieweeType: UserRole.PROVIDER,
        serviceId: reviewData.serviceId
          ? new Types.ObjectId(reviewData.serviceId)
          : undefined,
        projectId: reviewData.projectId
          ? new Types.ObjectId(reviewData.projectId)
          : undefined,

        // System defaults
        isVerified: !!reviewData.projectId, // Verified if from completed project
      });

      await review.populate(populate.basic);
      respond(res, review, "Review created successfully", 201);
    } catch (error) {
      handleError(res, error, "Failed to create review");
    }
  }

  // Get reviews with smart filtering
  static async getReviews(req: Request, res: Response) {
    try {
      const {
        revieweeId,
        serviceId,
        page,
        limit,
        sort,
        sortOrder,
        ...filters
      } = req.query;

      // Build base query
      let query = buildQuery.reviews(filters as ReviewFilters);

      // Add revieweeId filter if provided
      if (revieweeId) {
        if (!validators.objectId(revieweeId as string)) {
          return respondError(res, "Invalid reviewee ID");
        }
        query.revieweeId = new Types.ObjectId(revieweeId as string);
      }

      // Add serviceId filter if provided
      if (serviceId) {
        if (!validators.objectId(serviceId as string)) {
          return respondError(res, "Invalid service ID");
        }
        query.serviceId = new Types.ObjectId(serviceId as string);
      }

      // Execute with pagination
      const [totalCount, reviews] = await Promise.all([
        ReviewModel.countDocuments(query),
        buildQuery
          .pagination(ReviewModel.find(query), {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 20,
            sort: (sort as string) || "createdAt",
            sortOrder: (sortOrder as "asc" | "desc") || "desc",
          })
          .populate(populate.full)
          .exec(),
      ]);

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;

      respond(res, {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to fetch reviews");
    }
  }

  // Get single review with view increment
  static async getReviewById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!validators.objectId(id)) {
        return respondError(res, "Invalid review ID");
      }

      const review = await ReviewModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          isDeleted: { $ne: true },
          moderationStatus: ModerationStatus.APPROVED,
        },
        { $inc: { viewCount: 1 } },
        { new: true }
      ).populate(populate.full);

      if (!review) {
        return respondError(res, "Review not found", 404);
      }

      respond(res, review);
    } catch (error) {
      handleError(res, error, "Failed to fetch review");
    }
  }

  // Update review with smart field filtering
  static async updateReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const allowedFields = ["rating", "comment", "images", "wouldRecommend"];

      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!id, "Review ID is required"],
          [validators.objectId(id), "Invalid review ID"],
        ])
      )
        return;

      // Filter and validate updates
      const updates: any = {};
      Object.entries(req.body).forEach(([key, value]) => {
        if (allowedFields.includes(key) && value !== undefined) {
          updates[key] = value;
        }
      });

      if (Object.keys(updates).length === 0) {
        return respondError(res, "No valid updates provided");
      }

      // Validate update values
      if (
        !validate(res, [
          [
            !updates.rating || validators.rating(updates.rating),
            "Rating must be integer 1-5",
          ],
          [
            validators.comment(updates.comment),
            "Comment too long (max 2000 chars)",
          ],
          [validators.images(updates.images), "Max 5 images allowed"],
        ])
      )
        return;

      // Reset moderation if content changed
      if (updates.comment || updates.images) {
        updates.moderationStatus = ModerationStatus.PENDING;
      }

      const review = await ReviewModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          reviewerId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        },
        updates,
        { new: true, runValidators: true }
      ).populate(populate.basic);

      if (!review) {
        return respondError(res, "Review not found or unauthorized", 404);
      }

      respond(res, review, "Review updated successfully");
    } catch (error) {
      handleError(res, error, "Failed to update review");
    }
  }

  // Soft delete review
  static async deleteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!id, "Review ID is required"],
          [validators.objectId(id), "Invalid review ID"],
        ])
      )
        return;

      const review = await ReviewModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          reviewerId: new Types.ObjectId(userId),
          isDeleted: { $ne: true },
        },
        { isDeleted: true, deletedAt: new Date() },
        { new: true }
      );

      if (!review) {
        return respondError(res, "Review not found or unauthorized", 404);
      }

      respond(res, null, "Review deleted successfully");
    } catch (error) {
      handleError(res, error, "Failed to delete review");
    }
  }

  // Add response to review
  static async addResponse(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.userId!;

      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!id, "Review ID is required"],
          [validators.objectId(id), "Invalid review ID"],
          [!!comment, "Comment is required"],
          [
            validators.responseComment(comment),
            "Comment required and max 1000 chars",
          ],
        ])
      )
        return;

      const review = (await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED,
      })) as ReviewDocumentType;

      if (!review) {
        return respondError(res, "Review not found", 404);
      }

      const isReviewee = review.revieweeId.toString() === userId;
      const isAdmin = req.user?.isAdmin || false;

      if (!isReviewee && !isAdmin) {
        return respondError(
          res,
          "Only the reviewed party or admin can respond",
          403
        );
      }

      const responseData: Partial<ReviewResponse> = {
        responderId: new Types.ObjectId(userId),
        responderType: req.user?.userRole || UserRole.PROVIDER,
        comment: comment.trim(),
        isOfficialResponse: isReviewee,
      };

      await review.addResponse(responseData);
      await review.populate(
        "responses.responderId",
        "fullName profilePicture userRole"
      );

      respond(res, review, "Response added successfully");
    } catch (error) {
      handleError(res, error, "Failed to add response");
    }
  }

  // Review engagement actions (helpful, report)
  static async toggleHelpful(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userId = req.userId!;

      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!id, "Review ID is required"],
          [validators.objectId(id), "Invalid review ID"],
          [!!action, "Action is required"],
          [
            ["add", "remove"].includes(action),
            "Action must be 'add' or 'remove'",
          ],
        ])
      )
        return;

      const review = (await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED,
      })) as ReviewDocumentType;

      if (!review) {
        return respondError(res, "Review not found", 404);
      }

      if (action === "add") {
        await review.markHelpful(new Types.ObjectId(userId));
      } else {
        await review.removeHelpful(new Types.ObjectId(userId));
      }

      respond(
        res,
        {
          helpfulVotes: review.helpfulVotes,
          isHelpful: action === "add",
        },
        `Review ${
          action === "add" ? "marked as helpful" : "helpful mark removed"
        }`
      );
    } catch (error) {
      handleError(res, error, "Failed to update helpful status");
    }
  }

  // Report review
  static async reportReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      if (
        !validate(res, [
          [!!userId, "Authentication required"],
          [!!id, "Review ID is required"],
          [validators.objectId(id), "Invalid review ID"],
        ])
      )
        return;

      const review = (await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      })) as ReviewDocumentType;

      if (!review) {
        return respondError(res, "Review not found", 404);
      }

      await review.reportReview(new Types.ObjectId(userId));
      respond(res, null, "Review reported successfully");
    } catch (error) {
      handleError(res, error, "Failed to report review");
    }
  }

  // Get provider statistics
  static async getProviderStats(req: Request, res: Response) {
    try {
      const { providerId } = req.params;

      if (!providerId || !validators.objectId(providerId)) {
        return respondError(res, "Invalid provider ID");
      }

      const stats = await ProviderRatingStatsModel.findOne({
        providerId: new Types.ObjectId(providerId),
      });

      const defaultStats = {
        providerId,
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };

      respond(res, stats || defaultStats);
    } catch (error) {
      handleError(res, error, "Failed to fetch provider stats");
    }
  }

  // Get service statistics
  static async getServiceStats(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;

      if (!serviceId || !validators.objectId(serviceId)) {
        return respondError(res, "Invalid service ID");
      }

      const stats = await ServiceRatingStatsModel.findOne({
        serviceId: new Types.ObjectId(serviceId),
      });

      const defaultStats = {
        serviceId,
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };

      respond(res, stats || defaultStats);
    } catch (error) {
      handleError(res, error, "Failed to fetch service stats");
    }
  }

  // Get user's own reviews - FIXED VERSION
  static async getMyReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      const { page, limit, sort, sortOrder } = req.query;

      // Simple authentication check without using validate helper
      if (!userId) {
        return respondError(res, "Authentication required", 401);
      }

      const query = {
        reviewerId: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      };

      const [totalCount, reviews] = await Promise.all([
        ReviewModel.countDocuments(query),
        buildQuery
          .pagination(ReviewModel.find(query), {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 20,
            sort: (sort as string) || "createdAt",
            sortOrder: (sortOrder as "asc" | "desc") || "desc",
          })
          .populate([
            { path: "revieweeId", select: "fullName profilePicture userRole" },
            { path: "serviceId", select: "name category description" },
            {
              path: "responses.responderId",
              select: "fullName profilePicture userRole",
            },
          ])
          .exec(),
      ]);

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;

      respond(res, {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to fetch your reviews");
    }
  }

  // Get reviews received by a user (reviews where they are the reviewee)
  static async getReceivedReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      const { page, limit, sort, sortOrder } = req.query;

      // Simple authentication check without using validate helper
      if (!userId) {
        return respondError(res, "Authentication required", 401);
      }

      const query = {
        revieweeId: new Types.ObjectId(userId),
        moderationStatus: ModerationStatus.APPROVED,
        isDeleted: { $ne: true },
      };

      const [totalCount, reviews] = await Promise.all([
        ReviewModel.countDocuments(query),
        buildQuery
          .pagination(ReviewModel.find(query), {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 20,
            sort: (sort as string) || "createdAt",
            sortOrder: (sortOrder as "asc" | "desc") || "desc",
          })
          .populate(populate.full)
          .exec(),
      ]);

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;

      respond(res, {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to fetch received reviews");
    }
  }
}
