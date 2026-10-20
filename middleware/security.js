// Security Hardening Middleware: Headers, Rate Limiting, and Audit Logging
import crypto from "crypto";

/**
 * 1. Security Headers Middleware (Equivalent to Helmet)
 * Protects against Clickjacking, MIME-sniffing, XSS, and Information Leakage.
 */
export function secureHeaders(req, res, next) {
  // Prevent clickjacking on checkout and POS pages
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable browser XSS filtering
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Restrict permissions for sensitive APIs
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  // Remove Express identification header
  res.removeHeader("X-Powered-By");
  
  // Strict Transport Security for production/HTTPS
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  
  next();
}

/**
 * 2. In-Memory Sliding Window Rate Limiter
 * Protects against brute-force attacks and credential stuffing without external Redis dependencies.
 */
class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 10, message = "Too many requests. Please try again later.") {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.hits = new Map();

    // Periodic cleanup every 5 minutes to prevent memory leaks
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown-ip";
      const key = `${clientIp}:${req.path}`;
      const now = Date.now();

      let record = this.hits.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.hits.set(key, record);
      } else {
        record.count++;
      }

      res.setHeader("X-RateLimit-Limit", this.maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.maxRequests - record.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

      if (record.count > this.maxRequests) {
        return res.status(429).json({ error: this.message });
      }

      next();
    };
  }
}

// 10 attempts per 15 minutes for authentication
export const authRateLimiter = new RateLimiter(15 * 60 * 1000, 10, "Too many login/registration attempts. Please try again after 15 minutes.").middleware();

// 60 requests per minute for sensitive checkout/payment operations
export const paymentRateLimiter = new RateLimiter(60 * 1000, 30, "Too many payment requests. Please slow down.").middleware();

/**
 * 3. Security Audit Logger
 * Tracks POS cashier adjustments, refunds, deletions, and high-privilege actions.
 */
export async function logAuditEvent(pool, { userId, email, role, action, targetType, targetId, details, ip }) {
  const timestamp = new Date().toISOString();
  const logMessage = `[AUDIT ${timestamp}] User:${userId || "guest"} (${role || "none"}) Action:${action} Target:${targetType}#${targetId || "N/A"} - ${JSON.stringify(details || {})}`;
  console.log(`🛡️ ${logMessage}`);

  if (pool && !pool.isMock) {
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, role, action, target_type, target_id, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [userId || null, role || "anonymous", action, targetType, targetId ? String(targetId) : null, JSON.stringify(details || {}), ip || "unknown"]
      );
    } catch (err) {
      // If table doesn't exist yet, do not break the request flow
      // We will ensure the audit_logs table creation query is handled gracefully
    }
  }
}

/**
 * 4. Constant-Time String Comparison (Timing-Attack Defense)
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Prevent timing side-channel on length
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
