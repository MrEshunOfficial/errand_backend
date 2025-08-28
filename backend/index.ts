// index.ts
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import profileRoutes from "./routes/profile.routes.js";
import clientProfileRoutes from "./routes/clientProfile.routes.js";
import providerProfileRoutes from "./routes/providerProfile.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import reportRoutes from "./routes/report.routes.js";
import { connectDB } from "./database/connectDB";
import authRoutes from "./routes/auth.routes.js";
import warningRoutes from "./routes/warning.routes.js";
import reviewRoutes from "./routes/reviews.routes.js";
import idDetailsRoutes from "./routes/idDetails.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration FIRST
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser());

// Routes - Order matters for profile routes to prevent conflicts
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/profile/client-profiles", clientProfileRoutes);
app.use("/api/profile/provider-profiles", providerProfileRoutes);
app.use("/api/id-details", idDetailsRoutes); // Add this line
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/warnings", warningRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);

// Static file serving
app.use("/uploads", express.static("uploads"));

// Error handling middleware (optional but recommended)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  }
);

app.listen(PORT, () => {
  connectDB();
  console.log("Server is running on port: ", PORT);
});
