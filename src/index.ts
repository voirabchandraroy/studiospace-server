import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import studioRoutes from "./routes/studio.routes";
import bookingRoutes from "./routes/booking.routes";
import wishlistRoutes from "./routes/wishlist.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ------------------------------ Middleware ------------------------------ */
app.use(
  cors({
    origin: (process.env.CLIENT_URL || "http://localhost:3000").split(","),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));

/* -------------------------------- Routes -------------------------------- */
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "StudioSpace API is running",
    endpoints: [
      "/api/auth",
      "/api/studios",
      "/api/bookings",
      "/api/wishlist",
    ],
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/studios", studioRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);

/* --------------------------- 404 + error handler -------------------------- */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API route not found." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Internal server error." });
});

/* -------------------------------- Bootstrap ------------------------------- */
const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`StudioSpace server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
