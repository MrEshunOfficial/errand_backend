// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

// Remove the custom AuthRequest interface - use the global Express.Request instead
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if cookies object exists
    console.log("Cookies object:", req.cookies);
    console.log("Authorization header:", req.headers.authorization);

    // Get token from cookies (if cookies exist) or Authorization header
    let token: string | undefined;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      res.status(401).json({ message: "Access token required" });
      return;
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET) {
      res.status(500).json({ message: "Internal server error" });
      return;
    }

    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    } catch (jwtError) {
      res.status(401).json({
        message: "Invalid token",
        error:
          jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
      });
      return;
    }

    // Find user
    const user = await User.findById(decoded.userId);
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      res.status(401).json({ message: "Invalid token - user not found" });
      return;
    }

    req.userId = decoded.userId;
    req.user = user;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }
};

export const requireVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isVerified) {
    res.status(403).json({ message: "Email verification required" });
    return;
  }
  next();
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
};

/**
 * Optional authentication middleware
 * Attaches user to request if valid token exists, but doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from cookies or Authorization header
    let token: string | undefined;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // If no token, continue without authentication
    if (!token) {
      next();
      return;
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET) {
      next(); // Continue without auth rather than failing
      return;
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
      
      // Find user
      const user = await User.findById(decoded.userId);
      if (user) {
        req.userId = decoded.userId;
        req.user = user;
      }
    } catch (jwtError) {
      // Invalid token - continue as unauthenticated rather than failing
      console.log("Invalid token, continuing as unauthenticated");
    }

    next();
  } catch (error) {
    // Any error - continue without auth rather than failing
    next();
  }
};