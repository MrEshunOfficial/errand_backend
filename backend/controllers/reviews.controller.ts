import { Types } from "mongoose";
import { Request, Response } from "express";
import { 
  ReviewModel, 
  ProviderRatingStatsModel, 
  ServiceRatingStatsModel 
} from "../models/review.models";
import { 
  ReviewResponse, 
  CreateReviewRequest,
  PaginationOptions,
  ReviewFilters,
  ReviewDocumentType
} from "../types/review.types";
import { 
  ModerationStatus, 
  UserRole 
} from "../types/base.types";
import { 
  AuthenticatedRequest, 
  handleError, 
  validateObjectId 
} from "../utils/controller-utils/controller.utils";

// Base response helper
const sendResponse = (
  res: Response, 
  data: any, 
  message: string = "Success", 
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

// Validation helper
const validateReviewData = (data: CreateReviewRequest): string | null => {
  if (!validateObjectId(data.revieweeId)) return "Invalid reviewee ID";
  if (!data.revieweeType || !Object.values(UserRole).includes(data.revieweeType)) {
    return "Invalid reviewee type";
  }
  if (!data.reviewType || !["service", "provider"].includes(data.reviewType)) {
    return "Invalid review type";
  }
  if (!data.context || !["project_completion", "general_experience", "dispute_resolution"].includes(data.context)) {
    return "Invalid review context";
  }
  if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
    return "Rating must be an integer between 1 and 5";
  }
  if (data.reviewType === "service" && (!data.serviceId || !validateObjectId(data.serviceId))) {
    return "Service ID is required for service reviews";
  }
  if (data.serviceId && !validateObjectId(data.serviceId)) {
    return "Invalid service ID";
  }
  if (data.projectId && !validateObjectId(data.projectId)) {
    return "Invalid project ID";
  }
  if (data.title && data.title.length > 100) {
    return "Title cannot exceed 100 characters";
  }
  if (data.comment && data.comment.length > 2000) {
    return "Comment cannot exceed 2000 characters";
  }
  if (data.images && data.images.length > 5) {
    return "Maximum 5 images allowed per review";
  }
  if (data.serviceStartDate && data.serviceEndDate && 
      new Date(data.serviceEndDate) < new Date(data.serviceStartDate)) {
    return "Service end date must be after or equal to start date";
  }
  return null;
};

// Build query helper
const buildReviewQuery = (filters: ReviewFilters, includeModeration: boolean = false) => {
  const query: any = { isDeleted: { $ne: true } };
  
  if (!includeModeration) {
    query.moderationStatus = ModerationStatus.APPROVED;
  }
  
  if (filters.rating) {
    query.rating = filters.rating;
  }
  if (filters.reviewType) {
    query.reviewType = filters.reviewType;
  }
  if (filters.context) {
    query.context = filters.context;
  }
  if (typeof filters.isVerified === 'boolean') {
    query.isVerified = filters.isVerified;
  }
  if (typeof filters.wouldRecommend === 'boolean') {
    query.wouldRecommend = filters.wouldRecommend;
  }
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }
  
  return query;
};

// Apply pagination and sorting
const applyPaginationAndSort = (queryBuilder: any, options: PaginationOptions) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;
  
  let sortObj: any = { createdAt: -1 };
  if (options.sort) {
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    sortObj = { [options.sort]: sortOrder };
  }
  
  return queryBuilder.sort(sortObj).limit(limit).skip(skip);
};

export class ReviewController {
  // Create a new review
  static async createReview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      const reviewData: CreateReviewRequest = req.body;
      
      // Validate input data
      const validationError = validateReviewData(reviewData);
      if (validationError) {
        return res.status(400).json({ 
          success: false, 
          message: validationError 
        });
      }

      // Prevent self-review
      if (reviewData.revieweeId === userId) {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot review yourself" 
        });
      }

      // Check for existing review (one review per reviewer-reviewee-service combination)
      const existingQuery: any = {
        reviewerId: new Types.ObjectId(userId),
        revieweeId: new Types.ObjectId(reviewData.revieweeId),
        reviewType: reviewData.reviewType,
        isDeleted: { $ne: true }
      };
      
      if (reviewData.serviceId) {
        existingQuery.serviceId = new Types.ObjectId(reviewData.serviceId);
      }

      const existingReview = await ReviewModel.findOne(existingQuery);
      if (existingReview) {
        return res.status(409).json({ 
          success: false, 
          message: "You have already reviewed this item" 
        });
      }

      // Create the review
      const review = new ReviewModel({
        ...reviewData,
        reviewerId: new Types.ObjectId(userId),
        revieweeId: new Types.ObjectId(reviewData.revieweeId),
        serviceId: reviewData.serviceId ? new Types.ObjectId(reviewData.serviceId) : undefined,
        projectId: reviewData.projectId ? new Types.ObjectId(reviewData.projectId) : undefined,
        reviewerType: req.user?.userRole || UserRole.CUSTOMER,
        timeline: reviewData.serviceStartDate || reviewData.serviceEndDate ? {
          serviceStartDate: reviewData.serviceStartDate,
          serviceEndDate: reviewData.serviceEndDate
        } : undefined
      });

      await review.save();

      // Populate the response
      await review.populate([
        { path: 'reviewerId', select: 'fullName profilePicture userRole' },
        { path: 'revieweeId', select: 'fullName profilePicture userRole' },
        { path: 'serviceId', select: 'name category description' }
      ]);

      return sendResponse(res, review, "Review created successfully", 201);
    } catch (error) {
      return handleError(res, error, "Failed to create review");
    }
  }

  // Get reviews with filtering and pagination
  static async getReviews(req: Request, res: Response) {
    try {
      const { 
        revieweeId, 
        serviceId, 
        page = 1, 
        limit = 20, 
        sort = 'createdAt', 
        sortOrder = 'desc',
        ...filters 
      } = req.query;

      let query = buildReviewQuery(filters as ReviewFilters);

      if (revieweeId) {
        if (!validateObjectId(revieweeId as string)) {
          return res.status(400).json({ 
            success: false, 
            message: "Invalid reviewee ID" 
          });
        }
        query.revieweeId = new Types.ObjectId(revieweeId as string);
      }

      if (serviceId) {
        if (!validateObjectId(serviceId as string)) {
          return res.status(400).json({ 
            success: false, 
            message: "Invalid service ID" 
          });
        }
        query.serviceId = new Types.ObjectId(serviceId as string);
      }

      // Get total count for pagination
      const totalCount = await ReviewModel.countDocuments(query);
      
      // Build and execute query with pagination
      let reviewQuery = ReviewModel.find(query);
      reviewQuery = applyPaginationAndSort(reviewQuery, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort: sort as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      });

      const reviews = await reviewQuery
        .populate('reviewerId', 'fullName profilePicture userRole')
        .populate('revieweeId', 'fullName profilePicture userRole')
        .populate('serviceId', 'name category description')
        .populate('responses.responderId', 'fullName profilePicture userRole')
        .exec();

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const totalPages = Math.ceil(totalCount / limitNum);

      return sendResponse(res, {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      return handleError(res, error, "Failed to fetch reviews");
    }
  }

  // Get single review by ID
  static async getReviewById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED
      })
        .populate('reviewerId', 'fullName profilePicture userRole')
        .populate('revieweeId', 'fullName profilePicture userRole')
        .populate('serviceId', 'name category description')
        .populate('responses.responderId', 'fullName profilePicture userRole');

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found" 
        });
      }

      // Increment view count
      await ReviewModel.updateOne(
        { _id: review._id },
        { $inc: { viewCount: 1 } }
      );

      return sendResponse(res, review);
    } catch (error) {
      return handleError(res, error, "Failed to fetch review");
    }
  }

  // Update review (only by owner)
  static async updateReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        reviewerId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      });

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found or unauthorized" 
        });
      }

      const updateData = req.body;
      const allowedUpdates = ['rating', 'title', 'comment', 'images', 'wouldRecommend'];
      const updates: any = {};

      for (const key of allowedUpdates) {
        if (updateData[key] !== undefined) {
          updates[key] = updateData[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "No valid updates provided" 
        });
      }

      // Validate updates
      if (updates.rating && (updates.rating < 1 || updates.rating > 5 || !Number.isInteger(updates.rating))) {
        return res.status(400).json({ 
          success: false, 
          message: "Rating must be an integer between 1 and 5" 
        });
      }

      if (updates.title && updates.title.length > 100) {
        return res.status(400).json({ 
          success: false, 
          message: "Title cannot exceed 100 characters" 
        });
      }

      if (updates.comment && updates.comment.length > 2000) {
        return res.status(400).json({ 
          success: false, 
          message: "Comment cannot exceed 2000 characters" 
        });
      }

      if (updates.images && updates.images.length > 5) {
        return res.status(400).json({ 
          success: false, 
          message: "Maximum 5 images allowed per review" 
        });
      }

      // Reset moderation status if content changed
      if (updates.comment || updates.images) {
        updates.moderationStatus = ModerationStatus.PENDING;
      }

      const updatedReview = await ReviewModel.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      )
        .populate('reviewerId', 'fullName profilePicture userRole')
        .populate('revieweeId', 'fullName profilePicture userRole')
        .populate('serviceId', 'name category description');

      return sendResponse(res, updatedReview, "Review updated successfully");
    } catch (error) {
      return handleError(res, error, "Failed to update review");
    }
  }

  // Delete review (soft delete)
  static async deleteReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        reviewerId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      });

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found or unauthorized" 
        });
      }

      review.isDeleted = true;
      review.deletedAt = new Date();
      await review.save();

      return sendResponse(res, null, "Review deleted successfully");
    } catch (error) {
      return handleError(res, error, "Failed to delete review");
    }
  }

  // Add response to review
  static async addResponse(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { comment } = req.body;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      if (!comment || comment.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Comment is required" 
        });
      }

      if (comment.length > 1000) {
        return res.status(400).json({ 
          success: false, 
          message: "Comment cannot exceed 1000 characters" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED
      }) as ReviewDocumentType | null;

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found" 
        });
      }

      // Check if user is the reviewee (can respond to reviews about them)
      const isReviewee = review.revieweeId.toString() === userId;
      const isAdmin = req.user?.isAdmin || false;

      if (!isReviewee && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: "Only the reviewed party or admin can respond" 
        });
      }

      const responseData: Partial<ReviewResponse> = {
        responderId: new Types.ObjectId(userId),
        responderType: req.user?.userRole || UserRole.PROVIDER,
        comment: comment.trim(),
        isOfficialResponse: isReviewee
      };

      // Use the instance method or manual update
      if (review.addResponse) {
        await review.addResponse(responseData);
      } else {
        // Fallback: manual response addition
        review.responses = review.responses || [];
        review.responses.push({
          ...responseData,
          _id: new Types.ObjectId(),
          respondedAt: new Date(),
          moderationStatus: ModerationStatus.PENDING,
          helpfulVotes: 0,
          helpfulVoters: []
        } as ReviewResponse);
        await review.save();
      }
      
      await review.populate('responses.responderId', 'fullName profilePicture userRole');

      return sendResponse(res, review, "Response added successfully");
    } catch (error) {
      return handleError(res, error, "Failed to add response");
    }
  }

  // Mark review as helpful
  static async markHelpful(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED
      }) as ReviewDocumentType | null;

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found" 
        });
      }

      await review.markHelpful(new Types.ObjectId(userId));

      return sendResponse(res, {
        helpfulVotes: review.helpfulVotes,
        isHelpful: true
      }, "Review marked as helpful");
    } catch (error) {
      return handleError(res, error, "Failed to mark review as helpful");
    }
  }

  // Remove helpful mark
  static async removeHelpful(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true },
        moderationStatus: ModerationStatus.APPROVED
      }) as ReviewDocumentType | null;

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found" 
        });
      }

      await review.removeHelpful(new Types.ObjectId(userId));

      return sendResponse(res, {
        helpfulVotes: review.helpfulVotes,
        isHelpful: false
      }, "Helpful mark removed");
    } catch (error) {
      return handleError(res, error, "Failed to remove helpful mark");
    }
  }

  // Report review
  static async reportReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      if (!validateObjectId(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid review ID" 
        });
      }

      const review = await ReviewModel.findOne({
        _id: new Types.ObjectId(id),
        isDeleted: { $ne: true }
      }) as ReviewDocumentType | null;

      if (!review) {
        return res.status(404).json({ 
          success: false, 
          message: "Review not found" 
        });
      }

      await review.reportReview(new Types.ObjectId(userId));

      return sendResponse(res, null, "Review reported successfully");
    } catch (error) {
      return handleError(res, error, "Failed to report review");
    }
  }

  // Get provider rating statistics
  static async getProviderStats(req: Request, res: Response) {
    try {
      const { providerId } = req.params;
      
      if (!validateObjectId(providerId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid provider ID" 
        });
      }

      const stats = await ProviderRatingStatsModel.findOne({
        providerId: new Types.ObjectId(providerId)
      });

      if (!stats) {
        // Return default stats if none found
        const defaultStats = {
          providerId,
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        return sendResponse(res, defaultStats);
      }

      return sendResponse(res, stats);
    } catch (error) {
      return handleError(res, error, "Failed to fetch provider stats");
    }
  }

  // Get service rating statistics
  static async getServiceStats(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;
      
      if (!validateObjectId(serviceId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid service ID" 
        });
      }

      const stats = await ServiceRatingStatsModel.findOne({
        serviceId: new Types.ObjectId(serviceId)
      });

      if (!stats) {
        // Return default stats if none found
        const defaultStats = {
          serviceId,
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
        return sendResponse(res, defaultStats);
      }

      return sendResponse(res, stats);
    } catch (error) {
      return handleError(res, error, "Failed to fetch service stats");
    }
  }

  // Get user's own reviews
  static async getMyReviews(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      const { page = 1, limit = 20, sort = 'createdAt', sortOrder = 'desc' } = req.query;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      const query = {
        reviewerId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      };

      const totalCount = await ReviewModel.countDocuments(query);
      
      let reviewQuery = ReviewModel.find(query);
      reviewQuery = applyPaginationAndSort(reviewQuery, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort: sort as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      });

      const reviews = await reviewQuery
        .populate('revieweeId', 'fullName profilePicture userRole')
        .populate('serviceId', 'name category description')
        .populate('responses.responderId', 'fullName profilePicture userRole')
        .exec();

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const totalPages = Math.ceil(totalCount / limitNum);

      return sendResponse(res, {
        reviews,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      });
    } catch (error) {
      return handleError(res, error, "Failed to fetch your reviews");
    }
  }
}