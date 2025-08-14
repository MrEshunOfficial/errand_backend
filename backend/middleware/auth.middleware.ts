// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticateToken = async (
  req: AuthRequest,
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
      console.log("Token from cookies");
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        console.log("Token from Authorization header");
      }
    }

    console.log("Token received:", token ? "Present" : "Missing");

    if (!token) {
      res.status(401).json({ message: "Access token required" });
      return;
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET environment variable is not set");
      res.status(500).json({ message: "Internal server error" });
      return;
    }

    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
      console.log("Token decoded successfully:", decoded);
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
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
    console.error("Authentication error:", error);
    res.status(401).json({
      message: "Invalid token",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return; // CRITICAL FIX: Added return statement here
  }
};

export const requireVerification = (
  req: AuthRequest,
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
  req: AuthRequest,
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
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
};