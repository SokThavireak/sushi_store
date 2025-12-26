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
// 2. CONTROLLER IMPORTS 
// (Make sure all files exist in the 'controller' folder)
// =========================================================
import * as adminController from './controller/adminController.js';
import * as cartController from './controller/cartController.js';
import * as categoryController from './controller/categoryController.js';
import * as dashboardController from './controller/dashboardController.js'; // Ensure file is named dashboardController.js
import * as checkoutController from './controller/checkoutController.js';
import * as inventoryController from './controller/inventoryController.js';
import * as locationsController from './controller/locationsController.js';
import * as loginController from './controller/loginController.js';
import * as menuController from './controller/menuController.js'; // Fixed folder name
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

// Find this section in your index.js
app.use(
  session({
    store: new pgSession({ 
      pool: pool, 
      tableName: 'session',
      createTableIfMissing: true // <--- Add this to auto-create the table
    }),
    secret: process.env.SESSION_SECRET || "mysecret", // Add a fallback just in case
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: isProduction, // <--- CHANGE THIS (was true)
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
app.get('/', publicController.getHome);
app.get('/menu', menuController.getPublicMenu); // Ensure getPublicMenu is exported
app.get('/locations', locationsController.getLocations);

// --- Authentication ---
app.get('/login', loginController.getLogin);
app.post('/login', loginController.postLogin);
app.get('/register', loginController.getRegister);
app.post('/register', loginController.postRegister);
app.get('/logout', loginController.logout);

// --- Google Auth ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { 
        successRedirect: '/menu', 
        failureRedirect: '/login' 
    })
);

// --- User Protected Routes ---
app.get('/profile', checkAuthenticated, profileController.getProfile);
app.post('/profile/update', checkAuthenticated, profileController.updateProfile);
app.post('/profile/delete', checkAuthenticated, profileController.deleteProfile);

app.get('/cart', checkAuthenticated, cartController.getCart);
app.post('/api/cart', checkAuthenticated, cartController.addToCart); // API route
app.patch('/api/cart/:id', checkAuthenticated, cartController.updateCartItem);

app.get('/checkout', checkAuthenticated, checkoutController.getCheckout);
app.post('/api/orders', checkAuthenticated, checkoutController.createOrder); 
app.get('/payment/:id', checkAuthenticated, paymentController.processPayment);
app.post('/payment/confirm/:id', checkAuthenticated, paymentController.confirmPayment);

// --- Admin / Staff Routes ---
app.get('/admin/dashboard', checkAuthenticated, checkRole(['admin', 'manager', 'store_manager']), dashboardController.getDashboard);
app.get('/admin/reports', checkAuthenticated, checkRole(['admin', 'manager', 'store_manager']), dashboardController.getReports);

// Orders
app.get('/admin/orders', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), dashboardController.getOrders); 
app.post('/admin/orders/:id/status', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), dashboardController.updateOrderStatus);
app.post('/admin/orders/handle-request/:id', checkAuthenticated, checkRole(['admin', 'manager', 'store_manager']), dashboardController.handleOrderRequest);
app.post('/admin/orders/update/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), checkoutController.updateAdminOrder);

// Inventory
app.get('/admin/inventory', checkAuthenticated, checkRole(['manager', 'admin']), inventoryController.getInventory);
app.post('/admin/inventory/add', checkAuthenticated, checkRole(['manager', 'admin']), upload.single("image"), inventoryController.addProduct);
app.patch('/api/inventory/:id', checkAuthenticated, checkRole(['manager', 'admin']), inventoryController.updateProduct);
app.delete('/api/inventory/:id', checkAuthenticated, checkRole(['manager', 'admin']), inventoryController.deleteProduct);

// Stock
app.get('/admin/stock/menu', checkAuthenticated, checkRole(['manager', 'admin']), stockMenuController.getStockMenu);
app.get('/admin/stock', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), stockOrderController.getStockOrders); // Changed route to match controller
app.get('/admin/stock/create', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), stockOrderController.getCreateStock);

// Users
app.get('/admin/users', checkAuthenticated, checkRole(['admin']), userController.getUsers);
app.post('/admin/users/delete/:id', checkAuthenticated, checkRole(['admin']), userController.deleteUser);
app.get('/admin/users/edit/:id', checkAuthenticated, checkRole(['admin']), userController.editUser);
app.post('/admin/users/update/:id', checkAuthenticated, checkRole(['admin']), userController.updateUser);
app.post('/admin/create-manager', checkAuthenticated, checkRole(['admin', 'manager']), userController.createManager);

// Categories
app.get('/admin/category', checkAuthenticated, checkRole(['manager', 'admin']), categoryController.getCategories); // Fixed URL to singular if that matches ejs

// Daily Stock (AdminController)
app.get('/manager/daily-stock', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), adminController.getDailyStock);
app.post('/api/manager/daily-stock', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), adminController.postDailyStock);
app.get('/manager/daily-stock/history', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), adminController.getDailyStockHistory);
app.get('/manager/daily-stock/view/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), adminController.getDailyStockView);

// Staff Menu
app.get("/staff/menu", checkAuthenticated, checkRole(['admin', 'manager', 'store_manager', 'staff', 'cashier']), menuController.getStaffMenu);


// =========================================================
// 6. START SERVER
// =========================================================
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});