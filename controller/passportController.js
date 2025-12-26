import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import bcrypt from "bcrypt";
import { pool } from '../config/database.js';
import env from "dotenv";

env.config();

// 1. Local Strategy (Email/Password)
passport.use(
  "local",
  new Strategy({ usernameField: 'username' }, async function verify(username, password, cb) {
    const adminEmails = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(',') : [];
    const adminPasswords = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.split(',') : [];
    const adminIndex = adminEmails.indexOf(username);

    // Check Hardcoded Admin
    if (adminIndex !== -1 && password === adminPasswords[adminIndex]) {
      return cb(null, { id: `env-admin-${adminIndex}`, email: username, role: 'admin' });
    }

    // Check Database User
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, valid) => {
          if (valid) return cb(null, user);
          else return cb(null, false, { message: "Incorrect password" });
        });
      } else {
        return cb(null, false, { message: "User not found" });
      }
    } catch (err) {
      return cb(err);
    }
  })
);

// 2. Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback', 
    proxy: true 
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

export default {};