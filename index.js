import express from 'express';
import { Pool } from 'pg';
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
import connectPgSimple from 'connect-pg-simple'; // REQUIRED: Import Session Store
import { createRequire } from "module";

env.config();

// ADD THIS AT THE TOP:
import upload from './config/cloudinary.js';
const app = express();
const port = process.env.PORT || 3000; // Use Render's PORT or 3000
const saltRounds = 10;
const pgSession = connectPgSimple(session); // Initialize Session Store

// Determine Environment
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BASE_URL || `https://sushi-store-zplg.onrender.com`;

// =========================================================
// 2. Database Connection (FIXED: Added SSL)
// =========================================================
// We use DATABASE_URL if available (common in Render), otherwise fall back to individual vars
const connectionConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Fixes the "SSL/TLS required" error
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD, 
        port: process.env.DB_PORT,
        // Only use SSL if we are in production or explicitly requested
        ssl: isProduction ? { rejectUnauthorized: false } : false
      };

const pool = new Pool(connectionConfig);

// Test Connection
pool.connect().then(() => console.log('✅ Database connected successfully')).catch(err => console.error('❌ Database connection error:', err));

// =========================================================
// 1. Middleware Setup (FIXED: Memory Leak)
// =========================================================
// Add this line so cookies work behind Render's proxy
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
        secure: true, // Requires 'trust proxy' to be set!
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

// Passport MUST come after session
app.use(passport.initialize());
app.use(passport.session());  

app.use((req, res, next) => {
    req.pool = pool;
    // Make user available to all views
    res.locals.user = req.user; 
    next();
});

// Admin Layout Middleware
app.use('/admin', (req, res, next) => {
    res.locals.layout = 'layout.ejs'; 
    next();
});

// =========================================================
// AUTH MIDDLEWARE
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
        res.status(403).send("Access Denied");
    }
}

// =========================================================
// PUBLIC ROUTES
// =========================================================

// Customer Order History Page
app.get('/orders', checkAuthenticated, async (req, res) => {
    // --- FIX START ---
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
        // Render empty orders for super admin to prevent DB crash
        return res.render('orders', { title: 'My Orders', orders: [] });
    }
    // --- FIX END ---

    try {
        const result = await pool.query(
            "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", 
            [req.user.id]
        );
        res.render('orders', { title: 'My Orders', orders: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.post('/orders/request-cancel/:id', checkAuthenticated, async (req, res) => {
    try {
        await pool.query(
            "UPDATE orders SET status = 'Cancel Requested' WHERE id = $1 AND user_id = $2 AND status = 'Pending'",
            [req.params.id, req.user.id]
        );
        res.redirect('/orders');
    } catch (err) {
        console.error(err);
        res.redirect('/orders');
    }
});

app.post('/orders/request-refund/:id', checkAuthenticated, async (req, res) => {
    try {
        await pool.query(
            "UPDATE orders SET status = 'Refund Requested' WHERE id = $1 AND user_id = $2 AND status = 'Completed'",
            [req.params.id, req.user.id]
        );
        res.redirect('/orders');
    } catch (err) {
        console.error(err);
        res.redirect('/orders');
    }
});

app.get("/", async (req, res) => {
    // 1. SECURITY CHECK: If user is Staff, redirect AND STOP.
    if (req.user && req.user.role === 'staff') {
        return res.redirect('/staff/menu'); // <--- The 'return' is critical!
    }

    // 2. If not staff, continue loading the home page
    try {
        const result = await pool.query("SELECT * FROM products");
        const products = result.rows;
        const categories = [
            { name: "Most Sales" }, 
            ...[...new Set(products.map(p => p.category))].map(c => ({ name: c }))
        ];
        res.render("website/main/index", { 
            title: "Home", products, categories, layout: 'layouts'
        });
    } catch (err) {
        console.error(err);
        // If there is an error, we render an empty page (but only if we haven't redirected yet)
        if (!res.headersSent) {
            res.render("website/main/index", { products: [], categories: [] });
        }
    }
});

app.get('/about', (req, res) => {
    res.render('website/about', { title: 'About Us', layout: 'layouts'});
});

app.get('/location', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.render('website/location', { title: 'Our Locations', locations: result.rows, layout: 'layouts' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.get('/offers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        const discountedProducts = result.rows.filter(p => p.discount_type && p.discount_type !== 'none' && p.discount_value > 0);
        res.render('website/offers', { title: 'Offers', products: discountedProducts, layout: 'layouts' });
    } catch (err) {
        res.render('website/offers', { title: 'Offers', products: [], layout: 'layouts' });
    }
});

app.get("/menu", async (req, res) => {
  try {
    const productsRes = await pool.query("SELECT * FROM products ORDER BY id ASC");
    const categoriesRes = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    res.render("website/menu", {
      title: "Menu",
      layout: "layouts",
      products: productsRes.rows,
      categories: categoriesRes.rows
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

// =========================================================
// CART API ROUTES
// =========================================================

app.get("/api/cart", async (req, res) => {
  if (!req.user) return res.json([]); 

  // --- FIX START: Prevent crash for Env Admins ---
  // Environment admins have string IDs ("env-admin-0"), but DB expects Numbers.
  if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
      return res.json([]); // Return empty cart for super admins
  }
  // --- FIX END ---

  try {
    const result = await pool.query(`
      SELECT c.id as cart_id, c.quantity, p.id as product_id, p.name, p.price, p.image_url 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = $1 
      ORDER BY c.id ASC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/cart", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please login to add items" });

  // --- FIX START ---
  if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
      return res.status(403).json({ error: "Super Admins cannot use the shopping cart." });
  }
  // --- FIX END ---

  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const check = await pool.query("SELECT * FROM cart WHERE product_id = $1 AND user_id = $2", [productId, userId]);
    if (check.rows.length > 0) {
      await pool.query("UPDATE cart SET quantity = quantity + 1 WHERE product_id = $1 AND user_id = $2", [productId, userId]);
    } else {
      await pool.query("INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, 1)", [userId, productId]);
    }
    res.json({ message: "Item added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/cart/:id", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Login required" });
  const { id } = req.params;
  const { action } = req.body;
  
  try {
    if (action === 'increment') {
      await pool.query("UPDATE cart SET quantity = quantity + 1 WHERE id = $1", [id]);
    } else if (action === 'decrement') {
      const current = await pool.query("SELECT quantity FROM cart WHERE id = $1", [id]);
      if (current.rows.length > 0 && current.rows[0].quantity > 1) {
        await pool.query("UPDATE cart SET quantity = quantity - 1 WHERE id = $1", [id]);
      } else {
        await pool.query("DELETE FROM cart WHERE id = $1", [id]);
      }
    }
    res.json({ message: "Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =========================================================
// CHECKOUT & ORDERS ROUTE
// =========================================================

app.get('/checkout', checkAuthenticated, async (req, res) => {
    // --- FIX START ---
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
         return res.redirect('/'); // Admins cannot checkout
    }
    // --- FIX END ---

    try {
        const cartRes = await pool.query(`
            SELECT c.*, p.name, p.price 
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            WHERE c.user_id = $1`, [req.user.id]);
        
        const locRes = await pool.query("SELECT * FROM locations WHERE status = 'Open'");

        res.render('website/checkout', {
            title: 'Checkout', 
            cart: cartRes.rows, 
            locations: locRes.rows, 
            layout: 'layouts'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

app.post('/api/orders', checkAuthenticated, async (req, res) => {
    let { pickup_location, payment_method, table_number } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const cartRes = await client.query(`
            SELECT c.product_id, c.quantity, p.price 
            FROM cart c JOIN products p ON c.product_id = p.id
            WHERE c.user_id = $1`, [req.user.id]);

        if (cartRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('/menu'); 
        }

        const total = cartRes.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const orderRes = await client.query(
            "INSERT INTO orders (user_id, total_price, payment_method, pickup_location, status, table_number) VALUES ($1, $2, $3, $4, 'Pending', $5) RETURNING id",
            [req.user.id, total, payment_method, pickup_location, table_number]
        );
        const orderId = orderRes.rows[0].id;

        for (const item of cartRes.rows) {
            await client.query(
                "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",
                [orderId, item.product_id, item.quantity, item.price]
            );
        }

        await client.query("DELETE FROM cart WHERE user_id = $1", [req.user.id]);
        await client.query('COMMIT');
        
        if (req.user.role === 'staff') {
            res.redirect('/staff/menu?status=success');
        } else if (payment_method === 'QR') {
            res.redirect(`/payment/${orderId}`);
        } else {
            res.redirect('/orders'); // Redirect to orders page instead of profile
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error processing order");
    } finally {
        client.release();
    }
});

app.post('/admin/orders/delete/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const id = req.params.id;
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [id]);
        await pool.query("DELETE FROM orders WHERE id = $1", [id]);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting order");
    }
});

app.get('/admin/orders/edit/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const orderId = req.params.id;

        const orderRes = await pool.query(`
            SELECT o.*, u.email, u.name as user_name 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            WHERE o.id = $1
        `, [orderId]);

        const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
        const locRes = await pool.query("SELECT * FROM locations");

        if (orderRes.rows.length === 0) {
            return res.redirect('/admin/orders');
        }

        res.render('admin/edit_order', {
            order: orderRes.rows[0],
            items: itemsRes.rows,
            locations: locRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.post('/admin/orders/items/delete/:itemId', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.itemId;
        await client.query('BEGIN');

        const itemRes = await client.query("SELECT order_id, price, quantity FROM order_items WHERE id = $1", [itemId]);
        if(itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('back');
        }
        const { order_id, price, quantity } = itemRes.rows[0];
        const deductAmount = price * quantity;

        await client.query("DELETE FROM order_items WHERE id = $1", [itemId]);
        await client.query("UPDATE orders SET total_price = total_price - $1 WHERE id = $2", [deductAmount, order_id]);

        await client.query('COMMIT');
        res.redirect(`/admin/orders/edit/${order_id}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error removing item");
    } finally {
        client.release();
    }
});

app.post('/admin/orders/items/update/:itemId', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.itemId;
        const newQuantity = parseInt(req.body.quantity);
        
        if (newQuantity < 1) { 
             return res.redirect(307, `/admin/orders/items/delete/${itemId}`);
        }

        await client.query('BEGIN');

        const itemRes = await client.query("SELECT order_id, price, quantity FROM order_items WHERE id = $1", [itemId]);
        if(itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('back');
        }
        const { order_id, price, quantity: oldQuantity } = itemRes.rows[0];

        const qtyDiff = newQuantity - oldQuantity;
        const priceDiff = qtyDiff * price;

        await client.query("UPDATE order_items SET quantity = $1 WHERE id = $2", [newQuantity, itemId]);
        await client.query("UPDATE orders SET total_price = total_price + $1 WHERE id = $2", [priceDiff, order_id]);

        await client.query('COMMIT');
        res.redirect(`/admin/orders/edit/${order_id}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error updating quantity");
    } finally {
        client.release();
    }
});

app.post('/admin/orders/update/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    try {
        const id = req.params.id;
        const { status, payment_method, pickup_location, table_number } = req.body;
        
        await pool.query(
            "UPDATE orders SET status=$1, payment_method=$2, pickup_location=$3, table_number=$4 WHERE id=$5",
            [status, payment_method, pickup_location, table_number, id]
        );
        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating order");
    }
});

// =========================================================
// ABA PAYWAY INTEGRATION (SECURE)
// =========================================================

function getAbaHash(transactionId, amount) {
    const merchantId = process.env.ABA_MERCHANT_ID;
    const apiKey = process.env.ABA_API_KEY;
    const reqTime = Math.floor(Date.now() / 1000); 

    const items = ""; 
    const shipping = ""; 
    const cfirstname = "Murakami"; 
    const clastname = "Customer"; 
    const cemail = "customer@example.com"; 
    const cphone = "099999999"; 
    const type = "purchase"; 
    const payment_option = ""; 
    // FIXED: Use Dynamic Base URL
    const return_url = `${baseUrl}/orders`; 
    
    const dataToHash = reqTime + merchantId + transactionId + amount + items + shipping + cfirstname + clastname + cemail + cphone + type + payment_option + return_url;

    const hash = crypto.createHmac('sha512', apiKey).update(dataToHash).digest('base64');

    return { hash, reqTime, items, shipping, cfirstname, clastname, cemail, cphone, type, payment_option, return_url };
}

// =========================================================
// PAYMENT ROUTES (DEMO MODE)
// =========================================================

app.get('/payment/:id', checkAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
        if (orderRes.rows.length === 0) return res.redirect('/');
        
        const order = orderRes.rows[0];
        const amount = parseFloat(order.total_price).toFixed(2);

        res.render('website/payment', { 
            title: 'Confirm Payment', 
            layout: 'layouts',
            orderId: orderId,
            amount: amount
        });

    } catch (err) {
        console.error("Payment Error:", err);
        res.redirect('/profile');
    }
});

app.post('/payment/confirm/:id', checkAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;
        await pool.query(
            "UPDATE orders SET status = 'Processing' WHERE id = $1", 
            [orderId]
        );
        res.redirect('/orders'); // Redirect to order history
    } catch (err) {
        console.error(err);
        res.status(500).send("Error confirming payment");
    }
});

// =========================================================
// ADMIN ROUTES
// =========================================================

app.get("/staff/menu", checkAuthenticated, checkRole(['admin', 'manager', 'store_manager', 'staff', 'cashier']), async (req, res) => {
  try {
    const productsRes = await pool.query("SELECT * FROM products ORDER BY id ASC");
    const categoriesRes = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    
    res.render("website/menu_staff", { 
      title: "Staff POS Menu",
      products: productsRes.rows,
      layout: "layouts",
      categories: categoriesRes.rows
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

// DAILY STOCK COUNT
app.get('/manager/daily-stock', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), async (req, res) => {
    try {
        const userId = req.user.id;
        // Treat locId as a string, do not use parseInt
        let locId = req.user.assigned_location_id ? String(req.user.assigned_location_id) : null;

        // 1. Handle Admin/Manager Location Override
        if (['admin', 'manager'].includes(req.user.role)) {
            if (req.query.location) {
                locId = String(req.query.location); // Keep as string
            } else if (!locId) {
                // Default to first location if none assigned
                const firstLoc = await pool.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
                if (firstLoc.rows.length > 0) locId = String(firstLoc.rows[0].id);
            }
        }

        if (!locId) {
            return res.render('error', { message: "Error: No valid location found.", user: req.user });
        }

        // 2. Fetch Location Name (Query works for string or int now)
        const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [locId]);
        if (locRes.rows.length === 0) return res.send("Error: Location ID not found.");
        const locationName = locRes.rows[0].name;

        // 3. Fetch ALL Locations for dropdown
        const allLocs = await pool.query("SELECT * FROM locations ORDER BY id ASC");

        // 4. Check if Stock Submitted
        // We use query parameters to allow "viewing" other dates/locations
        const dateQuery = req.query.date || new Date().toISOString().split('T')[0];
        
        let alreadySubmitted = false;
        try {
            const checkRes = await pool.query(
                "SELECT * FROM daily_inventory_logs WHERE location_name = $1 AND report_date = $2", 
                [locationName, dateQuery]
            );
            alreadySubmitted = checkRes.rows.length > 0;
        } catch (dbErr) {
            console.error("Check Submitted Error:", dbErr.message);
        }

        const masterRes = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

        res.render('manager/daily_stock.ejs', { 
            title: 'Daily Stock Count', 
            layout: 'layout',
            locationName: locationName,
            locations: allLocs.rows,
            masterItems: masterRes.rows,
            alreadySubmitted: alreadySubmitted,
            user: req.user,
            currentLocationId: locId,
            query: { date: dateQuery, location: locId }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

app.post('/api/manager/daily-stock', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), async (req, res) => {
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
        return res.status(403).json({ error: "Super Admins cannot submit stock counts. Please create a real Manager account." });
    }
    const client = await pool.connect();
    try {
        const { items, location_id } = req.body; 
        const userId = req.user.id;
        let locId = req.user.assigned_location_id;

        // FIX: Allow Admin/Manager to use passed location or default
        if (['admin', 'manager'].includes(req.user.role)) {
            if (location_id) {
                locId = location_id;
            } else if (!locId) {
                // Fallback to first location if none provided
                const firstLoc = await client.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
                if (firstLoc.rows.length > 0) locId = firstLoc.rows[0].id;
            }
        }

        if (!locId) {
            client.release();
            return res.status(400).json({ error: "Error: No location specified." });
        }

        const locRes = await client.query("SELECT name FROM locations WHERE id = $1", [locId]);
        
        if (locRes.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid location assigned." });
        }

        const locationName = locRes.rows[0].name;

        await client.query('BEGIN');

        const logRes = await client.query(
            "INSERT INTO daily_inventory_logs (location_name, user_id, report_date) VALUES ($1, $2, CURRENT_DATE) RETURNING id",
            [locationName, userId]
        );
        const logId = logRes.rows[0].id;

        for (const item of items) {
            await client.query(
                "INSERT INTO daily_inventory_items (log_id, item_name, category, quantity, unit) VALUES ($1, $2, $3, $4, $5)",
                [logId, item.name, item.category, item.quantity, item.unit]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Saved successfully" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Database error" });
    } finally {
        client.release();
    }
});

// --- DELETE LOG ROUTE ---
app.delete('/api/manager/daily-stock/:id', checkAuthenticated, async (req, res) => {
    try {
        const logId = req.params.id;
        
        // 1. Fetch Log Info to check permissions
        const logRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [logId]);
        if (logRes.rows.length === 0) return res.status(404).json({ error: "Log not found" });
        
        const log = logRes.rows[0];
        
        // 2. Permission Check (5 Minute Rule)
        const created = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now - created) / 1000 / 60;
        
        const isOwner = (req.user.id == log.user_id);
        const isAdmin = (req.user.role === 'admin');

        if (!isAdmin) {
            if (!isOwner) return res.status(403).json({ error: "Unauthorized" });
            if (diffMinutes > 5) return res.status(403).json({ error: "Time limit exceeded. Cannot delete after 5 minutes." });
        }

        // 3. Delete Items first (Foreign Key) then Log
        await pool.query("DELETE FROM daily_inventory_items WHERE log_id = $1", [logId]);
        await pool.query("DELETE FROM daily_inventory_logs WHERE id = $1", [logId]);

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// --- GET EDIT PAGE ---
app.get('/manager/daily-stock/edit/:id', checkAuthenticated, async (req, res) => {
    try {
        const logId = req.params.id;
        
        const logRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [logId]);
        if (logRes.rows.length === 0) return res.redirect('/manager/daily-stock/history');
        const log = logRes.rows[0];

        // Permission Logic
        const created = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now - created) / 1000 / 60;
        
        const isOwner = (req.user.id == log.user_id);
        const isAdmin = (req.user.role === 'admin' || req.user.role === 'manager');
        const isUnlocked = log.is_unlocked; // <--- Check Database Flag

        // ALLOW IF: (Admin/Manager) OR (Unlocked) OR (Owner & < 5 mins)
        if (!isAdmin && !isUnlocked && (!isOwner || diffMinutes > 5)) {
            return res.send(`<script>alert('Edit time limit expired. Ask a Manager to unlock this report.'); window.location.href='/manager/daily-stock/history';</script>`);
        }

        const itemsRes = await pool.query("SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name", [logId]);

        res.render('manager/edit_daily_log.ejs', {
            log: log,
            items: itemsRes.rows,
            title: 'Edit Stock Log',
            layout: 'layout'
        });

    } catch (err) {
        console.error(err);
        res.redirect('/manager/daily-stock/history');
    }
});

// --- SUBMIT EDIT (UPDATE) ---
app.post('/api/manager/daily-stock/update/:id', checkAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const logId = req.params.id;
        const { items } = req.body; // Array of { id, quantity }

        // (You can add the same 5-minute permission check here for extra security if you want)

        await client.query('BEGIN');

        for (const item of items) {
            // Update each item's quantity
            await client.query(
                "UPDATE daily_inventory_items SET quantity = $1 WHERE id = $2 AND log_id = $3",
                [item.quantity, item.id, logId]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Updated" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    } finally {
        client.release();
    }
});

app.post('/api/manager/daily-stock/toggle-lock/:id', checkAuthenticated, checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const logId = req.params.id;
        
        // Toggle the is_unlocked status
        // If it's false, make it true. If true, make it false.
        await pool.query(`
            UPDATE daily_inventory_logs 
            SET is_unlocked = NOT COALESCE(is_unlocked, false) 
            WHERE id = $1
        `, [logId]);

        res.json({ message: "Permission updated" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get('/manager/daily-stock/history', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), async (req, res) => {
    try {
        let queryParams = [];
        let queryConditions = [];
        
        // Handle Location Filter
        // If Admin/Manager -> Allow filtering by query.location
        // If Store Manager -> Force their assigned_location_id
        if (['admin', 'manager'].includes(req.user.role)) {
            if (req.query.location) {
                queryConditions.push(`l.id = $${queryParams.length + 1}`); // Compare ID, not name
                queryParams.push(String(req.query.location)); // Push as string
            }
        } else {
            // Force assigned location
            if (req.user.assigned_location_id) {
                // Assuming locations table has id, and logs store location_name... 
                // It is safer to filter logs by location_name if that is what you stored, 
                // OR join tables. simpler here is to join or look up name first.
                
                // Let's look up the name for the user's ID to be safe
                const userLoc = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
                if(userLoc.rows.length > 0) {
                    queryConditions.push(`dil.location_name = $${queryParams.length + 1}`);
                    queryParams.push(userLoc.rows[0].name);
                }
            }
        }

        // Handle Date Filter
        if (req.query.date) {
            queryConditions.push(`dil.report_date = $${queryParams.length + 1}`);
            queryParams.push(req.query.date);
        }

        // Construct Query
        // We join locations table just in case we need to filter by ID above, 
        // OR we just query logs directly. 
        // Best approach given your setup (logs store location_name):
        
        let sql = `
            SELECT dil.*, u.email 
            FROM daily_inventory_logs dil
            LEFT JOIN users u ON dil.user_id = u.id::varchar 
            LEFT JOIN locations l ON dil.location_name = l.name 
        `; // Added cast ::varchar for user_id join just in case

        if (queryConditions.length > 0) {
            sql += " WHERE " + queryConditions.join(" AND ");
        }

        sql += " ORDER BY dil.report_date DESC, dil.created_at DESC";

        const logsRes = await pool.query(sql, queryParams);
        const locRes = await pool.query("SELECT * FROM locations ORDER BY id ASC");

        res.render('manager/stock_history.ejs', {
            title: 'Stock Count History',
            layout: 'layout',
            logs: logsRes.rows,
            locations: locRes.rows,
            query: req.query,
            user: req.user
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

// Route: View Daily Log Details (Fixed: Fetches Images & No Duplicates)
app.get('/manager/daily-stock/view/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const logId = req.params.id;

        // 1. Fetch Log Details
        const logRes = await pool.query(`
            SELECT l.*, u.email 
            FROM daily_inventory_logs l
            LEFT JOIN users u ON l.user_id = u.id::varchar
            WHERE l.id = $1
        `, [logId]);

        if (logRes.rows.length === 0) return res.redirect('/manager/daily-stock/history');
        const log = logRes.rows[0];

        // 2. Security Check for Store Managers
        if (req.user.role === 'store_manager') {
             const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
             if (locRes.rows.length > 0 && log.location_name !== locRes.rows[0].name) {
                 return res.status(403).send("Access Denied: This log belongs to another store.");
             }
        }

        // 3. Fetch Items WITH Images (This was the part causing errors before)
        const itemsRes = await pool.query(`
            SELECT dii.*, s.image_url 
            FROM daily_inventory_items dii
            LEFT JOIN stocks s ON dii.item_name = s.name
            WHERE dii.log_id = $1 
            ORDER BY dii.category, dii.item_name
        `, [logId]);

        // 4. Render
        res.render('manager/view_daily_log.ejs', {
            title: `Log #${logId}`,
            log: log,
            items: itemsRes.rows,
            layout: 'layout'
        });

    } catch (err) {
        console.error(err);
        res.redirect('/manager/daily-stock/history');
    }
});

// Route to View Specific History Item Details
app.get('/manager/daily-stock/history/:id', checkAuthenticated, async (req, res) => {
    try {
        const logId = req.params.id;

        // 1. Fetch from DAILY_INVENTORY_LOGS (Not stock_requests)
        const logRes = await pool.query(`
            SELECT l.*, u.email 
            FROM daily_inventory_logs l
            LEFT JOIN users u ON l.user_id = u.id::varchar
            WHERE l.id = $1
        `, [logId]);

        if (logRes.rows.length === 0) {
            return res.status(404).send('Stock Log not found');
        }

        // 2. Fetch the items for this log
        const itemsRes = await pool.query(`
            SELECT * FROM daily_inventory_items 
            WHERE log_id = $1 
            ORDER BY category, item_name
        `, [logId]);

        // 3. Render the correct view (view_daily_log.ejs)
        res.render('manager/view_daily_log.ejs', {
            title: `Log #${logId}`,
            log: logRes.rows[0],
            items: itemsRes.rows,
            layout: 'layout'
        });

    } catch (err) {
        console.error("Error fetching daily stock details:", err);
        res.status(500).send('Server Error');
    }
});

// DEBUG ROUTE: List all stock requests
app.get('/debug/stocks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stock_requests ORDER BY id DESC');
        res.json(result.rows); // This will show you the raw JSON data
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// =========================================================
// MASTER STOCK MENU
// =========================================================

app.get('/admin/stock/menu', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");
        res.render('admin/stock/stock_menu.ejs', { 
            title: 'Master Ingredient Menu', 
            stocks: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.post('/admin/stock/menu/add', checkAuthenticated, checkRole(['manager', 'admin']), upload.single('image'), async (req, res) => {
    const { name, category, unit } = req.body;
    // USE CLOUDINARY URL
    const image_url = req.file ? req.file.path : ''; 
    
    try {
        await pool.query(
            "INSERT INTO stocks (name, category, unit, image_url, quantity) VALUES ($1, $2, $3, $4, 0)",
            [name, category, unit, image_url]
        );
        res.redirect('/admin/stock/menu');
    } catch (err) {
        console.error(err);
        res.send(`<script>alert('Error adding item'); window.location.href='/admin/stock/menu';</script>`);
    }
});

app.patch('/api/stock/menu/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { name, category, unit, image_url } = req.body;
    try {
        await pool.query(
            "UPDATE stocks SET name=$1, category=$2, unit=$3, image_url=$4 WHERE id=$5",
            [name, category, unit, image_url, id]
        );
        res.json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ error: "Error" });
    }
});

app.delete('/api/stock/menu/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        await pool.query("DELETE FROM stocks WHERE id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Error" });
    }
});

// Route: Update Stock Request Status (Approve/Reject)
// PERMISSION: Only 'admin' and 'manager' can approve/reject.
app.post('/admin/stock/:id/status', checkAuthenticated, checkRole(['admin', 'manager']), async (req, res) => {
    try {
        const requestId = req.params.id;
        const { status } = req.body; // 'Confirmed' or 'Rejected'

        // 1. Update the status in the database
        await pool.query(
            "UPDATE stock_requests SET status = $1 WHERE id = $2",
            [status, requestId]
        );

        res.json({ success: true, message: "Status updated successfully" });

    } catch (err) {
        console.error("Error updating stock request status:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// NEW ROUTE: View Stock Request (Warehouse Orders)
app.get('/admin/stock/request/:id', checkAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        // Query the STOCK_REQUESTS table
        const requestResult = await pool.query(`SELECT * FROM stock_requests WHERE id = $1`, [id]);

        if (requestResult.rows.length === 0) return res.status(404).send('Request not found');

        const itemsResult = await pool.query(`SELECT * FROM stock_request_items WHERE request_id = $1`, [id]);
        const locationsResult = await pool.query('SELECT * FROM locations');

        res.render('view_stock', {
            user: req.user,
            request: requestResult.rows[0],
            items: itemsResult.rows,
            locations: locationsResult.rows,
            query: {} 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// =========================================================
// STOCK ORDER MANAGEMENT
// =========================================================

app.get('/admin/stock', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        // 1. Fetch the Stock Requests (Existing code)
        let query = `
            SELECT s.*, u.email 
            FROM stock_requests s 
            LEFT JOIN users u ON s.user_id = u.id 
        `;
        let params = [];

        if (req.user.role === 'store_manager' && req.user.assigned_location_id) {
            const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
            if (locRes.rows.length > 0) {
                query += ` WHERE s.location_name = $1`;
                params.push(locRes.rows[0].name);
            }
        }

        query += ` ORDER BY s.created_at DESC`;
        const result = await pool.query(query, params);

        // 2. FETCH LOCATIONS (For the dropdown)
        const locResult = await pool.query("SELECT * FROM locations");

        // 3. FETCH THE MISSING STOCKS (This is the fix!)
        const stockResult = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

        // 4. Render with ALL data
        res.render('admin/stock/stock_orders.ejs', { 
            title: 'Stock Requests', 
            requests: result.rows,
            locations: locResult.rows,      // Pass locations
            stocks: stockResult.rows        // <--- PASS THIS VARIABLE!
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.get('/admin/stock/create', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const locRes = await pool.query("SELECT * FROM locations");
        const prodRes = await pool.query("SELECT * FROM products ORDER BY category, name");
        const catRes = await pool.query("SELECT * FROM categories ORDER BY id ASC");
        
        let stocks = [];
        try {
             const stockRes = await pool.query("SELECT * FROM stocks ORDER BY category, name");
             stocks = stockRes.rows;
        } catch(e) {
             console.log("Note: 'stocks' table might not exist yet.");
        }

        res.render('admin/stock/create_stock.ejs', { 
            title: 'Stock Management', 
            locations: locRes.rows, 
            products: prodRes.rows,
            categories: catRes.rows,
            stocks: stocks
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/stock');
    }
});

app.post("/admin/stock/add", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), upload.single("image"), async (req, res) => {
    const { name, category, quantity, unit } = req.body;
    // USE CLOUDINARY URL
    const image_url = req.file ? req.file.path : "";

    try {
        await pool.query(
            "INSERT INTO stocks (name, category, quantity, unit, image_url) VALUES ($1, $2, $3, $4, $5)",
            [name, category, quantity || 0, unit, image_url]
        );
        res.redirect("/admin/stock/create");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding stock item.");
    }
});

app.patch("/api/stock/:id", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    const { id } = req.params;
    const { name, category, quantity, unit, image_url } = req.body;
    try {
        await pool.query(
            "UPDATE stocks SET name=$1, category=$2, quantity=$3, unit=$4, image_url=$5 WHERE id=$6",
            [name, category, quantity, unit, image_url, id]
        );
        res.json({ message: "Updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete("/api/stock/:id", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        await pool.query("DELETE FROM stocks WHERE id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// Ensure your create route saves 'location_name' directly
app.post('/api/stock/create', checkAuthenticated, async (req, res) => {
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
        return res.status(403).json({ error: "Super Admins cannot submit requests. Please create a real Manager account." });
    }
    try {
        const { location_name, items } = req.body;
        
        // 1. Insert the Request Header
        // Make sure you insert 'location_name' as a string string, NOT an ID
        const requestResult = await pool.query(
            `INSERT INTO stock_requests (user_id, location_name, status, created_at) 
             VALUES ($1, $2, 'Pending', NOW()) RETURNING id`,
            [req.user.id, location_name] 
        );
        
        const requestId = requestResult.rows[0].id;

        // 2. Insert Items (Loop)
        for (const item of items) {
            await pool.query(
                `INSERT INTO stock_request_items (stock_request_id, item_name, quantity, category)
                VALUES ($1, $2, $3, $4)`,
                [requestId, item.name, item.quantity, item.category]
            );
        }

        res.json({ success: true, id: requestId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// =========================================================
// ADMIN DASHBOARD
// =========================================================
app.get("/admin/dashboard", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async(req, res) => {
    try {
        const client = await pool.connect();
        
        let filterLocationName = null;
        let locationFilterClause = "";
        let queryParams = [];

        const allLocationsRes = await client.query("SELECT * FROM locations ORDER BY name ASC");
        
        if (req.user.role === 'store_manager') {
            if (req.user.assigned_location_id) {
                const myLoc = allLocationsRes.rows.find(l => l.id === req.user.assigned_location_id);
                filterLocationName = myLoc ? myLoc.name : 'Unknown';
            }
        } else {
            if (req.query.location && req.query.location !== 'All') {
                filterLocationName = req.query.location;
            }
        }

        if (filterLocationName) {
            locationFilterClause = "AND pickup_location = $1";
            queryParams.push(filterLocationName);
        }

        const productCountRes = await client.query("SELECT COUNT(*) FROM products"); 
        const userCountRes = await client.query("SELECT COUNT(*) FROM users"); 
        
        const orderCountRes = await client.query(
            `SELECT COUNT(*) FROM orders WHERE 1=1 ${locationFilterClause}`, 
            queryParams
        );

        const revenueRes = await client.query(
            `SELECT SUM(total_price) FROM orders WHERE status = 'Completed' ${locationFilterClause}`, 
            queryParams
        );
        const totalRevenue = revenueRes.rows[0].sum || 0;

        const chartQuery = `
            SELECT to_char(created_at, 'Mon DD') as day, SUM(total_price) as daily_sales
            FROM orders 
            WHERE status = 'Completed' AND created_at > NOW() - INTERVAL '7 days' ${locationFilterClause}
            GROUP BY day, created_at
            ORDER BY created_at ASC
        `;
        const chartRes = await client.query(chartQuery, queryParams);

        const statusQuery = `
            SELECT status, COUNT(*) as count 
            FROM orders 
            WHERE 1=1 ${locationFilterClause}
            GROUP BY status
        `;
        const statusRes = await client.query(statusQuery, queryParams);

        client.release();

        res.render("admin/dashboard.ejs", { 
            title: "Dashboard", 
            productsCount: productCountRes.rows[0].count,
            userCount: userCountRes.rows[0].count,
            ordersCount: orderCountRes.rows[0].count,
            totalRevenue: parseFloat(totalRevenue).toFixed(2),
            chartData: chartRes.rows,
            statusData: statusRes.rows,
            locations: allLocationsRes.rows,
            currentFilter: filterLocationName || 'All'
        });

    } catch (err) {
        console.error(err);
        res.render("admin/dashboard.ejs", { 
            title: "Dashboard", productsCount: 0, userCount: 0, ordersCount: 0, totalRevenue: 0, chartData: [], statusData: [], locations: [], currentFilter: 'All' 
        });
    }
});

app.get('/admin/reports', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        
        let filterLocationName = null;
        let dbParams = [selectedDate]; 
        let locationSql = "";

        const allLocationsRes = await pool.query("SELECT * FROM locations ORDER BY name ASC");

        if (req.user.role === 'store_manager') {
            if (req.user.assigned_location_id) {
                const myLoc = allLocationsRes.rows.find(l => l.id === req.user.assigned_location_id);
                filterLocationName = myLoc ? myLoc.name : null;
            }
        } else {
            if (req.query.location && req.query.location !== 'All') {
                filterLocationName = req.query.location;
            }
        }

        if (filterLocationName) {
            locationSql = "AND o.pickup_location = $2";
            dbParams.push(filterLocationName);
        }

        const ordersRes = await pool.query(`
            SELECT o.*, u.email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            WHERE DATE(o.created_at) = $1 ${locationSql}
            ORDER BY o.created_at DESC
        `, dbParams);

        const orders = ordersRes.rows;

        let grossSales = 0;
        let completedCount = 0;
        orders.forEach(o => {
            if (o.status === 'Completed') {
                grossSales += parseFloat(o.total_price);
                completedCount++;
            }
        });

        res.render('admin/reports.ejs', { 
            title: 'Sales Reports', 
            orders: orders,
            stats: {
                grossSales: grossSales.toFixed(2),
                netProfit: (grossSales * 0.7).toFixed(2),
                avgOrderValue: completedCount > 0 ? (grossSales / completedCount).toFixed(2) : "0.00",
                totalTx: orders.length
            },
            selectedDate: selectedDate,
            locations: allLocationsRes.rows,
            currentFilter: filterLocationName || 'All'
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.get('/admin/orders', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    try {
        let query = `
            SELECT o.*, u.email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
        `;
        let params = [];

        if ((req.user.role === 'store_manager' || req.user.role === 'staff' || req.user.role === 'cashier') && req.user.assigned_location_id) {
            const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
            if (locRes.rows.length > 0) {
                const locationName = locRes.rows[0].name;
                query += ` WHERE o.pickup_location = $1`;
                params.push(locationName);
            }
        }

        query += ` 
            ORDER BY 
            CASE WHEN o.status LIKE '%Requested%' THEN 0 ELSE 1 END,
            o.created_at DESC
        `;

        const result = await pool.query(query, params);
        
        res.render('admin/orders/orders', { 
            title: 'Order Management', 
            orders: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

app.post('/admin/orders/:id/status', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    try {
        await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [req.body.status, req.params.id]);
        res.redirect('/admin/orders');
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.post('/admin/orders/handle-request/:id', checkAuthenticated, checkRole(['admin', 'manager', 'store_manager']), async (req, res) => {
    const { action } = req.body;
    const orderId = req.params.id;
    let newStatus = '';

    if (action === 'approve_cancel') newStatus = 'Cancelled';
    if (action === 'reject_cancel') newStatus = 'Pending'; 
    
    if (action === 'approve_refund') newStatus = 'Refunded';
    if (action === 'reject_refund') newStatus = 'Completed'; 

    try {
        await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [newStatus, orderId]);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/orders');
    }
});

// --- INVENTORY ---

app.get("/add-item", checkAuthenticated, checkRole(['manager', 'admin']), (req, res) => {
    res.render("admin/inventory.ejs", { title: "Add Item" });
});

app.get("/admin/inventory", checkAuthenticated, checkRole(['manager', 'admin']), async(req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
    const categoryResult = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    const allCategories = [{ name: "On Sale" }, ...categoryResult.rows];
    res.render("admin/inventory.ejs", { 
        title: "Inventory Management", products: result.rows, categories: allCategories
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

app.post("/admin/inventory/add", checkAuthenticated, checkRole(['manager', 'admin']), upload.single("image"), async (req, res) => {
  const { name, category, price, is_best_seller, discount_type, discount_value } = req.body;
  
  // USE CLOUDINARY URL or Placeholder
  const image_url = req.file ? req.file.path : "https://via.placeholder.com/150";
  
  const isBestSellerBool = is_best_seller === 'true';
  const finalType = discount_type || 'none';
  const finalValue = discount_value || 0;

  try {
    const nameCheck = await pool.query("SELECT * FROM products WHERE name = $1", [name]);
    if (nameCheck.rows.length > 0) {
        return res.send(`<script>alert('Error: Name exists.'); window.location.href='/admin/inventory';</script>`);
    }

    const catCheck = await pool.query("SELECT * FROM categories WHERE name = $1", [category]);
    if (catCheck.rows.length === 0) {
        await pool.query("INSERT INTO categories (name) VALUES ($1)", [category]);
    }

    await pool.query(
      "INSERT INTO products (name, category, price, image_url, is_best_seller, discount_type, discount_value) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [name, category, price, image_url, isBestSellerBool, finalType, finalValue]
    );

    res.redirect("/admin/inventory"); 
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding item");
  }
});

app.patch("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category, price, image_url, is_best_seller, discount_type, discount_value } = req.body;
  try {
    await pool.query(
      "UPDATE products SET name=$1, category=$2, price=$3, image_url=$4, is_best_seller=$5, discount_type=$6, discount_value=$7 WHERE id=$8",
      [name, category, price, image_url, is_best_seller, discount_type, discount_value, id]
    );
    res.json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM cart WHERE product_id = $1", [id]); 
    await pool.query("DELETE FROM products WHERE id = $1", [id]); 
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// --- ADMIN LOCATIONS ---

app.get('/admin/locations', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.render('admin/locations.ejs', { title: 'Location Management', locations: result.rows });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.post('/api/locations', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    const { name, address, google_map_url, status, hours_mon_fri, hours_sat_sun } = req.body;
    try {
        await pool.query(
            "INSERT INTO locations (name, address, google_map_url, status, hours_mon_fri, hours_sat_sun) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, address, google_map_url, status, hours_mon_fri, hours_sat_sun]
        );
        res.redirect('/admin/locations');
    } catch (err) {
        res.status(500).send("Error adding location");
    }
});

app.patch('/api/locations/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { name, address, google_map_url, status, hours_mon_fri, hours_sat_sun } = req.body;
    try {
        await pool.query(
            "UPDATE locations SET name=$1, address=$2, google_map_url=$3, status=$4, hours_mon_fri=$5, hours_sat_sun=$6 WHERE id=$7",
            [name, address, google_map_url, status, hours_mon_fri, hours_sat_sun, id]
        );
        res.json({ message: "Updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete('/api/locations/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM locations WHERE id=$1", [id]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// --- ADMIN USER MANAGEMENT ---

app.get("/admin/users", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
        const locResult = await pool.query("SELECT * FROM locations ORDER BY name ASC"); 

        res.render("admin/users/users.ejs", { 
            title: "User Management", 
            usersList: result.rows,
            locations: locResult.rows 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
    }
});

app.post("/admin/users/delete/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        if (parseInt(id) === req.user.id) return res.redirect("/admin/users");
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        res.redirect("/admin/users");
    } catch (err) {
        res.redirect("/admin/users");
    }
});

app.get("/admin/users/edit/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        
        const locResult = await pool.query("SELECT * FROM locations");

        if (userResult.rows.length > 0) {
            res.render("admin/users/edit_user.ejs", { 
                title: "Edit User", 
                targetUser: userResult.rows[0],
                locations: locResult.rows 
            });
        } else {
            res.redirect("/admin/users");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/admin/users");
    }
});

app.post("/admin/users/update/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        const { email, role, assigned_location_id } = req.body; 

        const finalLocation = (role === 'store_manager' || role === 'staff' || role === 'cashier') ? assigned_location_id : null;

        await pool.query(
            "UPDATE users SET email = $1, role = $2, assigned_location_id = $3 WHERE id = $4", 
            [email, role, finalLocation, id]
        );
        res.redirect("/admin/users");
    } catch (err) {
        console.error(err);
        res.redirect("/admin/users");
    }
});

app.post("/admin/create-manager", checkAuthenticated, checkRole(['admin', 'manager']), async (req, res) => {
  const { email, password, role, assigned_location_id } = req.body;

  try {
    const checkResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
        return res.send(`<script>alert('Email already exists'); window.location.href='/admin/users';</script>`);
    }
    
    if ((role === 'store_manager' || role === 'staff' || role === 'cashier') && !assigned_location_id) {
        return res.send(`<script>alert('Error: Staff, Cashiers, and Store Managers must have an assigned location.'); window.location.href='/admin/users';</script>`);
    }

    const finalLocation = (role === 'store_manager' || role === 'staff' || role === 'cashier') ? assigned_location_id : null;

    bcrypt.hash(password, saltRounds, async (err, hash) => {
      await pool.query(
          "INSERT INTO users (email, password, role, assigned_location_id) VALUES ($1, $2, $3, $4)", 
          [email, hash, role, finalLocation]
      );
      res.redirect("/admin/users"); 
    });

  } catch (err) {
    console.error(err);
    res.redirect("/admin/users"); 
  }
});

// --- CATEGORY MANAGEMENT ---

app.get('/admin/category', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
        res.render('admin/category.ejs', { 
            title: 'Category Management', layout: 'layout', categories: result.rows, userRole: req.user.role 
        });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.post('/api/category', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const { name } = req.body;
        await pool.query('INSERT INTO categories (name) VALUES ($1)', [name]);
        res.status(201).json({ message: "Category Created" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
});

app.patch('/api/category/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await pool.query('UPDATE categories SET name = $1 WHERE id = $2', [name, id]);
        res.status(200).json({ message: "Category Updated" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
});

app.delete('/api/category/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        res.status(200).json({ message: "Category Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
});

// --- PROFILE ROUTES ---

app.get("/profile", checkAuthenticated, (req, res) => {
    res.render("website/profile.ejs", { title: "Manage Account", layout: "layouts" });
});

app.post("/profile/update", checkAuthenticated, async (req, res) => {
    const { email, password } = req.body;
    const userId = req.user.id;

    try {
        if (password && password.length > 0) {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error(err);
                    return res.redirect("/profile");
                }
                
                try {
                    await pool.query("UPDATE users SET email = $1, password = $2 WHERE id = $3", [email, hash, userId]);
                    res.redirect("/profile"); 
                } catch (dbErr) {
                    console.error(dbErr);
                    res.redirect("/profile");
                }
            });
        } else {
            await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);
            res.redirect("/profile");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/profile");
    }
});

app.post("/profile/delete", checkAuthenticated, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        req.logout((err) => {
            if (err) console.error(err);
            res.redirect("/");
        });
    } catch (err) {
        res.redirect("/profile");
    }
});

// =========================================================
// AUTHENTICATION LOGIC
// =========================================================

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/", 
    failureRedirect: "/login",
  })
);

app.get("/login", (req, res) => {
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, action: 'login' });
});

app.get("/register", (req, res) => {
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, action: 'register' });
});

// REPLACE your existing app.post("/login" ...) with this:

// REPLACE THE OLD app.post("/login"...) WITH THIS:

// REPLACE THE OLD app.post("/login"...) WITH THIS:

app.post("/login", (req, res, next) => {
    // We use a custom callback to handle JSON responses properly
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        
        // 1. Handle Login Failure (Send JSON error)
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            // 2. Clean the Role
            const rawRole = user.role || "";
            const role = rawRole.trim().toLowerCase();

            // 3. Determine the Destination URL
            let targetUrl = "/";
            if (['admin', 'manager', 'store_manager', 'cashier'].includes(role)) {
                targetUrl = "/admin/dashboard";
            } else if (role === 'staff') {
                targetUrl = "/staff/menu";
            }

            // 4. Send JSON Success (The Client will read this!)
            return res.json({ 
                message: "Login Successful", 
                role: role, 
                targetUrl: targetUrl 
            });
        });
    })(req, res, next);
});

app.post("/register", async (req, res) => {
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
});

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return console.error(err);
        res.redirect("/");
    });
});

// --- PASSPORT STRATEGIES ---

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    const adminEmails = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(',') : [];
    const adminPasswords = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.split(',') : [];
    const adminIndex = adminEmails.indexOf(username);

    if (adminIndex !== -1 && password === adminPasswords[adminIndex]) {
      return cb(null, { id: `env-admin-${adminIndex}`, email: username, role: 'admin' });
    }

    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1 ", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, valid) => {
          if (valid) return cb(null, user);
          else return cb(null, false);
        });
      } else {
        return cb("User not found");
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
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${baseUrl}/auth/google/secrets`, // Ensure this matches Google Console exactly
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        // 1. Check if user already exists in DB
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [profile.email]);
        
        if (result.rows.length === 0) {
          // 2. REGISTER: User doesn't exist, create new record
          const newUser = await pool.query(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING *",
            [profile.email, "google"] // Placeholder password for OAuth users
          );
          return cb(null, newUser.rows[0]);
        } else {
          // 3. LOGIN: Existing user found
          const existingUser = result.rows[0];
          
          // Optional: Update record with Google ID if needed
          return cb(null, existingUser);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

// Trigger Google Login
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// Google Callback Handler
app.get("/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    // Redirect based on role after successful login
    const role = req.user.role;
    if (['admin', 'manager', 'store_manager'].includes(role)) {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/");
    }
  }
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});