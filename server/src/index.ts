// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import ticketRoutes from "./routes/tickets.js";
import uploadRoutes from "./routes/upload.js";
import historyRoutes from "./routes/history.js";
import adminRoutes from "./routes/admin.js";
import convertRoutes from "./routes/convert.js";

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(cors({
  origin: [
    FRONTEND_URL, 
    "http://localhost:3000",
    "https://allinoneconverter-phi.vercel.app", // Production frontend
    /\.vercel\.app$/ // Allow all Vercel apps for development
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/convert", convertRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Start server (local development)
if (process.env.NODE_ENV !== "production") {
  async function startServer() {
    try {
      await connectDB();
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📁 Frontend URL: ${FRONTEND_URL}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }
  startServer();
} else {
  // For Vercel serverless deployment
  connectDB().catch(err => console.error("DB connection error:", err));
}

// Export for Vercel
export default app;
