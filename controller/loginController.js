import { pool } from '../config/database.js';
import passport from 'passport';
import bcrypt from 'bcrypt';
const saltRounds = 10;

export const getLogin = (req, res) => {
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, action: 'login' });
};

export const getRegister = (req, res) => {
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, action: 'register' });
};

export const postLogin = (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            const rawRole = user.role || "";
            const role = rawRole.trim().toLowerCase();

            let targetUrl = "/";
            if (['admin', 'manager', 'store_manager', 'cashier'].includes(role)) {
                targetUrl = "/admin/dashboard";
            } else if (role === 'staff') {
                targetUrl = "/staff/menu";
            }

            return res.json({ 
                message: "Login Successful", 
                role: role, 
                targetUrl: targetUrl 
            });
        });
    })(req, res, next);
};

export const postRegister = async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  try {
    const checkResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) console.error(err);
        else {
          const result = await pool.query(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING *",
            [email, hash]
          );
          req.login(result.rows[0], (err) => {
            res.redirect("/");
          });
        }
      });
    }
  } catch (err) {
    res.redirect("/register");
  }
};

export const logout = (req, res) => {
    req.logout((err) => {
        if (err) return console.error(err);
        res.redirect("/");
    });
};