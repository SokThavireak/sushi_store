import express from "express";
import cors from "cors";
import expressLayouts from "express-ejs-layouts";
import passport from "passport";
import session from "express-session";
import env from "dotenv";
import connectPgSimple from "connect-pg-simple";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";

import pool from "./config/db.js";
import upload from "./config/cloudinary.js";
import setupPassport from "./config/passportSetup.js";

import authController from "./controllers/authController.js";
import publicController from "./controllers/publicController.js";
import adminController from "./controllers/adminController.js";
import managerController from "./controllers/managerController.js";

import crypto from "crypto";
import { secureHeaders, paymentRateLimiter, logAuditEvent } from "./middleware/security.js";
import { checkAuthenticated, checkRole, canAccessOrder } from "./middleware/auth.js";
import { renderPaymentPage } from "./controllers/paymentController.js";
import { processStaffCheckout } from "./controllers/orderController.js";

env.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layout");

// Apply Security Headers (Equivalent to Helmet)
app.use(secureHeaders);

const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const isDemoMode = process.env.DEMO_MODE === "true" || pool.isMock;

export default app;

// Middleware Setup

app.set("trust proxy", 1);

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    throw new Error("FATAL SECURITY CONFIGURATION: SESSION_SECRET environment variable is missing in production!");
  }
  console.warn("⚠️ Security Notice: Generating dynamic ephemeral session secret (for local/dev only).");
  sessionSecret = crypto.randomBytes(32).toString("hex");
}

const sessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
};

if (!isDemoMode && pool && !pool.isMock) {
  try {
    const pgSession = connectPgSimple(session);
    sessionOptions.store = new pgSession({
      pool: pool,
      tableName: "session",
    });
  } catch (err) {
    console.warn("⚠️ pgSession initialization error, using MemoryStore:", err.message);
  }
} else {
  console.log("🔒 Using In-Memory Session Store (Demo Mode)");
}

app.use(session(sessionOptions));

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "client/dist")));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(methodOverride("_method"));

// Setup & Initialize Passport

setupPassport();
app.use(passport.initialize());
app.use(passport.session());

// Global Template Variables

app.use((req, res, next) => {
  req.pool = pool;
  res.locals.user = req.user;
  next();
});

// Admin layout removed as it's now handled by React

app.post(
  "/api/staff/checkout/:id",
  checkAuthenticated,
  checkRole(["manager", "admin", "store_manager", "staff", "cashier"]),
  processStaffCheckout
);

// PAYMENT ROUTES (DEMO MODE & PRODUCTION)
app.get("/payment/:id", checkAuthenticated, renderPaymentPage);

// Secure payment confirmation route
app.post("/payment/confirm/:id", checkAuthenticated, paymentRateLimiter, async (req, res) => {
  try {
    const orderId = req.params.id;
    const pool = req.pool;

    const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = orderRes.rows[0];

    // Authorization: Verify user is staff or the customer who placed the order
    if (!canAccessOrder(req.user, order)) {
      return res.status(403).json({ error: "Access Denied: You do not own this order." });
    }

    if (order.status === "Completed") {
      return res.json({ success: true, message: "Payment already confirmed" });
    }

    // Mark order as completed and payment method as QR
    await pool.query("UPDATE orders SET status = 'Completed', payment_method = 'QR' WHERE id = $1", [orderId]);

    await logAuditEvent(pool, {
      userId: req.user.id,
      role: req.user.role,
      action: "CONFIRM_PAYMENT",
      targetType: "ORDER",
      targetId: orderId,
      details: { previousStatus: order.status, total: order.total_price },
      ip: req.ip
    });

    res.json({ success: true, message: "Payment confirmed" });
  } catch (err) {
    console.error("Payment confirmation error:", err);
    res.status(500).json({ error: "Error confirming payment" });
  }
});

// Register Routers

app.use("/", authController);
app.use("/", publicController);
app.use("/", adminController);
app.use("/", managerController);

// Fallback route for SPA page navigation (if frontend dist exists)
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.includes(".")) {
    return next();
  }
  const clientDist = path.join(__dirname, "client/dist/index.html");
  res.sendFile(clientDist, (err) => {
    if (err) {
      next();
    }
  });
});

// Start Server

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}