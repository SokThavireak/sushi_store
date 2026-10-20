import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import bcrypt from "bcrypt";
import pool from "./db.js";
import { timingSafeCompare } from "../middleware/security.js";

const baseUrl = process.env.BASE_URL || `https://sushi-store-zplg.onrender.com`;

export default function setupPassport() {
  passport.use(
    "local",
    new LocalStrategy(async function verify(username, password, cb) {
      const adminEmails = process.env.ADMIN_EMAIL
        ? process.env.ADMIN_EMAIL.split(",").map(e => e.trim())
        : [];
      const adminPasswords = process.env.ADMIN_PASSWORD
        ? process.env.ADMIN_PASSWORD.split(",").map(p => p.trim())
        : [];
        
      const cleanUsername = username.trim();
      const adminIndex = adminEmails.indexOf(cleanUsername);

      if (adminIndex !== -1 && adminPasswords[adminIndex] && timingSafeCompare(password, adminPasswords[adminIndex])) {
        return cb(null, {
          id: `env-admin-${adminIndex}`,
          email: cleanUsername,
          role: "admin",
        });
      }

      try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1 ", [cleanUsername]);
        
        if (result.rows.length > 0) {
          const user = result.rows[0];
          bcrypt.compare(password, user.password, (err, valid) => {
            if (valid) {
              const safeUser = { ...user };
              delete safeUser.password;
              return cb(null, safeUser);
            } else {
              return cb(null, false, { message: "Invalid credentials" });
            }
          });
        } else {
          return cb(null, false, { message: "Invalid credentials" });
        }
      } catch (err) {
        return cb(err);
      }
    })
  );

  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "dummy-id",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-secret",
        callbackURL: `${baseUrl}/auth/google/secrets`,
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          const result = await pool.query("SELECT * FROM users WHERE email = $1", [profile.email]);
          if (result.rows.length === 0) {
            const newUser = await pool.query(
              "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING *",
              [profile.email, "google"]
            );
            return cb(null, newUser.rows[0]);
          } else {
            return cb(null, result.rows[0]);
          }
        } catch (err) {
          return cb(err);
        }
      }
    )
  );

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));
}