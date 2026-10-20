import express from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { checkAuthenticated } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/security.js";

const router = express.Router();
const saltRounds = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/api/auth/status", (req, res) => {
  if (req.isAuthenticated()) {
    const safeUser = { ...req.user };
    delete safeUser.password;
    res.json({ authenticated: true, user: safeUser });
  } else {
    res.json({ authenticated: false });
  }
});

router.post("/login", authRateLimiter, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    req.logIn(user, (err) => {
      if (err) return next(err);
      const rawRole = user.role || "";
      const role = rawRole.trim().toLowerCase();
      let targetUrl = "/";
      if (["admin", "manager", "store_manager", "cashier"].includes(role)) {
        targetUrl = "/admin/dashboard";
      } else if (role === "staff") {
        targetUrl = "/staff/menu";
      }
      return res.json({ message: "Login Successful", role: role, targetUrl: targetUrl });
    });
  })(req, res, next);
});

router.post("/register", authRateLimiter, async (req, res) => {
  const email = (req.body.username || req.body.email || "").trim().toLowerCase();
  const password = req.body.password;

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long." });
  }

  try {
    const checkResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const hash = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING id, email, role, created_at",
      [email, hash]
    );
    const newUser = result.rows[0];

    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ error: "Login failed after register" });
      res.json({ message: "Registration successful", user: newUser });
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logout successful" });
  });
});

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/login");
  });
});

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/auth/google/secrets", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
  const role = req.user.role;
  if (["admin", "manager", "store_manager"].includes(role)) {
    res.redirect("/admin/dashboard");
  } else {
    res.redirect("/");
  }
});

router.get("/api/profile", checkAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

router.put("/profile/update", checkAuthenticated, async (req, res) => {
  const { email, password } = req.body;
  const userId = req.user.id;
  try {
    if (password && password.length > 0) {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) return res.status(500).json({ error: "Hashing failed" });
        await pool.query("UPDATE users SET email = $1, password = $2 WHERE id = $3", [email, hash, userId]);
        res.json({ message: "Profile updated" });
      });
    } else {
      await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);
      res.json({ message: "Profile updated" });
    }
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

router.delete("/profile/delete", checkAuthenticated, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Account deleted" });
    });
  } catch (err) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

export default router;