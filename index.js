import express from 'express';
import cors from 'cors';
import expressLayouts from 'express-ejs-layouts';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import crypto from 'crypto'; 
import connectPgSimple from 'connect-pg-simple'; 
import { createRequire } from "module";

// =========================================================
// 1. DATABASE & CONFIG IMPORTS
// =========================================================
import { pool } from './config/database.js'; 
import upload from './config/cloudinary.js';

// =========================================================
// 2. CONTROLLER IMPORTS (Connected to ./controller folder)
// =========================================================
import * as adminController from './controller/adminController.js';
import * as cartController from './controller/cartController.js';
import * as categoryController from './controller/categoryController.js';
import * as checkoutController from './controller/checkoutController.js';
// Note: Keeping 'dasboard' spelling to match your screenshot filename
import * as dashboardController from './controller/dasboardController.js'; 
import * as inventoryController from './controller/inventoryController.js';
import * as locationsController from './controller/locationsController.js';
import * as loginController from './controller/loginController.js';
import * as menuController from './controller/menuController.js';
import * as passportController from './controller/passportController.js';
import * as paymentController from './controller/paymentController.js';
import * as profileController from './controller/profileController.js';
import * as publicController from './controller/publicController.js';
import * as stockMenuController from './controller/stockmenuController.js';
import * as stockOrderController from './controller/stockorderController.js';
import * as userController from './controller/userController.js';

env.config();

const app = express();
const port = process.env.PORT || 3000; 
const saltRounds = 10;
const pgSession = connectPgSimple(session); 

// Determine Environment
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BASE_URL || `https://sushi-store-zplg.onrender.com`;

// =========================================================
// 3. MIDDLEWARE SETUP 
// =========================================================
app.set('trust proxy', 1); 

app.use(
  session({
    store: new pgSession({ 
      pool: pool, 
      tableName: 'session' 
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, 
        maxAge: 24 * 60 * 60 * 1000 
    } 
  })
);

app.use(cors());
app.use(express.static('public')); 
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
app.set('view engine', 'ejs'); 
app.set('layout', 'layouts'); 

app.use(passport.initialize());
app.use(passport.session());  

// Global Variables Middleware
app.use((req, res, next) => {
    req.pool = pool;
    res.locals.user = req.user; 
    next();
});

// Admin Layout Middleware
app.use('/admin', (req, res, next) => {
    res.locals.layout = 'layout.ejs'; 
    next();
});

// =========================================================
// 4. AUTH & ROLE HELPER FUNCTIONS
// =========================================================

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

function checkRole(allowedRoles) {
    return (req, res, next) => {
        if (req.user && allowedRoles.includes(req.user.role)) {
            return next();
        }
        res.status(403).send("Access Denied: You do not have permission.");
    }
}

// =========================================================
// 5. ROUTE DEFINITIONS
// =========================================================

// --- Public Pages ---
app.get('/', publicController.getHome);  // Ensure publicController has 'getHome'
app.get('/menu', menuController.getMenu);
app.get('/locations', locationsController.getLocations);

// --- Authentication ---
app.get('/login', loginController.getLogin);
app.post('/login', loginController.postLogin); // Local Strategy logic usually here
app.get('/register', loginController.getRegister);
app.post('/register', loginController.postRegister);
app.get('/logout', loginController.logout);

// --- Google Auth (Passport Controller) ---
// Note: Ensure passportController is set up to handle the callbacks
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        successRedirect: '/menu', 
        failureRedirect: '/login' 
    })
);

// --- User Protected Routes ---
app.get('/profile', checkAuthenticated, profileController.getProfile);
app.get('/cart', checkAuthenticated, cartController.getCart);
app.post('/cart/add', checkAuthenticated, cartController.addToCart);
app.get('/checkout', checkAuthenticated, checkoutController.getCheckout);
app.post('/payment', checkAuthenticated, paymentController.processPayment);

// --- Admin / Staff Routes ---
// Dashboard
app.get('/admin', checkAuthenticated, checkRole(['admin', 'manager']), dashboardController.getDashboard);

// Inventory & Stock
app.get('/admin/inventory', checkAuthenticated, checkRole(['admin', 'manager']), inventoryController.getInventory);
app.get('/admin/stock/menu', checkAuthenticated, checkRole(['admin', 'manager']), stockMenuController.getStockMenu);
app.get('/admin/stock/orders', checkAuthenticated, checkRole(['admin', 'manager']), stockOrderController.getStockOrders);

// User Management
app.get('/admin/users', checkAuthenticated, checkRole(['admin']), userController.getUsers);

// Categories
app.get('/admin/categories', checkAuthenticated, checkRole(['admin']), categoryController.getCategories);

// =========================================================
// 6. START SERVER
// =========================================================
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});