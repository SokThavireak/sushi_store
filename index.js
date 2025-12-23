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
import crypto from 'crypto'; // Required for ABA Security Hash

env.config();

const app = express();
const port = 3000;
const saltRounds = 10;

// =========================================================
// CONFIG: Multer Storage (Saves images to public/uploads)
// =========================================================
const uploadDir = path.join(process.cwd(), "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); 
  },
});
const upload = multer({ storage: storage });

// 1. Basic Setup & Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  })
);

app.use(cors());
app.use(express.static('public')); 
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
app.set('view engine', 'ejs'); 
app.use(passport.initialize());
app.use(passport.session());  

// 2. Database Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD, 
    port: process.env.DB_PORT,
});

app.use((req, res, next) => {
    req.pool = pool;
    next();
});

// 3. Layout Configuration
app.set('layout', 'layouts'); 

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

// Customer requests cancellation

// Customer Order History Page
app.get('/orders', checkAuthenticated, async (req, res) => {
    try {
        // Fetch orders for the currently logged-in user
        const result = await pool.query(
            "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", 
            [req.user.id]
        );
        
        res.render('orders', { 
            title: 'My Orders', 
            orders: result.rows, 
            user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.post('/orders/request-cancel/:id', checkAuthenticated, async (req, res) => {
    try {
        // Only allow if currently Pending and belongs to user
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

// Customer requests refund
app.post('/orders/request-refund/:id', checkAuthenticated, async (req, res) => {
    try {
        // Only allow if currently Completed and belongs to user
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
    try {
        const result = await pool.query("SELECT * FROM products");
        const products = result.rows;
        const categories = [
            { name: "Most Sales" }, 
            ...[...new Set(products.map(p => p.category))].map(c => ({ name: c }))
        ];
        res.render("website/main/index", { 
            title: "Home", products, categories, layout: 'layouts', user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.render("website/main/index", { products: [], categories: [], user: req.user });
    }
});

app.get('/about', (req, res) => {
    res.render('website/about', { title: 'About Us', layout: 'layouts', user: req.user});
});

app.get('/location', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.render('website/location', { 
            title: 'Our Locations', locations: result.rows, layout: 'layouts', user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.get('/offers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        const discountedProducts = result.rows.filter(p => p.discount_type && p.discount_type !== 'none' && p.discount_value > 0);
        res.render('website/offers', { 
            title: 'Offers', products: discountedProducts, layout: 'layouts', user: req.user 
        });
    } catch (err) {
        res.render('website/offers', { title: 'Offers', products: [], layout: 'layouts', user: req.user });
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
      categories: categoriesRes.rows, 
      user: req.user
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

// 1. Checkout Page (Fetches Open Stores)
app.get('/checkout', checkAuthenticated, async (req, res) => {
    try {
        // Fetch cart items for THIS user
        const cartRes = await pool.query(`
            SELECT c.*, p.name, p.price 
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            WHERE c.user_id = $1`, [req.user.id]);
        
        // Fetch Stores with 'Open' status
        const locRes = await pool.query("SELECT * FROM locations WHERE status = 'Open'");

        res.render('website/checkout', {
            title: 'Checkout', 
            cart: cartRes.rows, 
            locations: locRes.rows, 
            layout: 'layouts', 
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

// 2. Process Order
// 2. Process Order (Updated for Staff Fast-Track)
app.post('/api/orders', checkAuthenticated, async (req, res) => {
    let { pickup_location, payment_method, table_number } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Allow Cashier to use Staff Logic
        if (req.user.role === 'staff') {
            res.redirect('/staff/menu?status=success');
        } else if (payment_method === 'QR') {
            res.redirect(`/payment/${orderId}`);
        } else {
            res.redirect('/'); // <--- Change this to '/' to go to Home
        }

        const cartRes = await client.query(`
            SELECT c.product_id, c.quantity, p.price 
            FROM cart c JOIN products p ON c.product_id = p.id
            WHERE c.user_id = $1`, [req.user.id]);

        if (cartRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('/menu'); 
        }

        const total = cartRes.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // INSERT table_number
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
            res.redirect('/profile'); 
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).send("Error processing order");
    } finally {
        client.release();
    }
});

// DELETE ORDER
app.post('/admin/orders/delete/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const id = req.params.id;
        // Delete items first (Foreign Key constraint)
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [id]);
        await pool.query("DELETE FROM orders WHERE id = $1", [id]);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting order");
    }
});

// EDIT ORDER PAGE (GET)
// 1. GET: Edit Order Page (Updated to fetch Items)
app.get('/admin/orders/edit/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const orderId = req.params.id;

        // 1. Fetch Order + User Info
        const orderRes = await pool.query(`
            SELECT o.*, u.email, u.name as user_name 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            WHERE o.id = $1
        `, [orderId]);

        // 2. Fetch Order Items
        const itemsRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);

        // 3. Fetch Locations (for the dropdown)
        const locRes = await pool.query("SELECT * FROM locations");

        if (orderRes.rows.length === 0) {
            return res.redirect('/admin/orders');
        }

        res.render('admin/edit_order', {
            order: orderRes.rows[0],
            items: itemsRes.rows,
            locations: locRes.rows,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// 2. POST: Delete Item from Order
app.post('/admin/orders/items/delete/:itemId', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.itemId;
        await client.query('BEGIN');

        // Get item details to calculate deduction
        const itemRes = await client.query("SELECT order_id, price, quantity FROM order_items WHERE id = $1", [itemId]);
        if(itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('back');
        }
        const { order_id, price, quantity } = itemRes.rows[0];
        const deductAmount = price * quantity;

        // Delete the Item
        await client.query("DELETE FROM order_items WHERE id = $1", [itemId]);

        // Update Order Total
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

// 3. POST: Update Item Quantity
app.post('/admin/orders/items/update/:itemId', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.itemId;
        const newQuantity = parseInt(req.body.quantity);
        
        if (newQuantity < 1) { // If qty is 0 or less, treat as delete
             return res.redirect(307, `/admin/orders/items/delete/${itemId}`);
        }

        await client.query('BEGIN');

        // Get current details
        const itemRes = await client.query("SELECT order_id, price, quantity FROM order_items WHERE id = $1", [itemId]);
        if(itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.redirect('back');
        }
        const { order_id, price, quantity: oldQuantity } = itemRes.rows[0];

        // Calculate Difference
        const qtyDiff = newQuantity - oldQuantity;
        const priceDiff = qtyDiff * price;

        // Update Item
        await client.query("UPDATE order_items SET quantity = $1 WHERE id = $2", [newQuantity, itemId]);

        // Update Order Total
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

// UPDATE ORDER (POST)
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
    const reqTime = Math.floor(Date.now() / 1000); // Current timestamp

    // ABA Payway String Format: 
    // req_time + merchant_id + tran_id + amount + items + shipping + firstname + lastname + email + phone + type + payment_option + return_url + ...
    // Note: We leave optional fields empty for simplicity here, but order matters.
    // This string must match EXACTLY what is sent in the form.
    
    // items = base64 encoded JSON (optional, we leave empty)
    const items = ""; 
    const shipping = ""; 
    const cfirstname = "Murakami"; 
    const clastname = "Customer"; 
    const cemail = "customer@example.com"; 
    const cphone = "099999999"; 
    const type = "purchase"; 
    const payment_option = ""; // cards, abapay, alipay, wechat, ... (empty = show all)
    const return_url = "http://localhost:3000/profile"; // Update this in production
    
    // Construct the string to hash
    const dataToHash = reqTime + merchantId + transactionId + amount + items + shipping + cfirstname + clastname + cemail + cphone + type + payment_option + return_url;

    // Generate Hash (HMAC SHA512 + Base64)
    const hash = crypto.createHmac('sha512', apiKey).update(dataToHash).digest('base64');

    return { hash, reqTime, items, shipping, cfirstname, clastname, cemail, cphone, type, payment_option, return_url };
}

// =========================================================
// PAYMENT ROUTES (DEMO MODE)
// =========================================================

// 1. GET: Render the Payment Page (Simplified)
app.get('/payment/:id', checkAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;

        // Fetch Order to get the amount
        const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
        if (orderRes.rows.length === 0) return res.redirect('/');
        
        const order = orderRes.rows[0];
        const amount = parseFloat(order.total_price).toFixed(2);

        // Render the new simplified page
        res.render('website/payment', { 
            title: 'Confirm Payment', 
            user: req.user,
            layout: 'layouts',
            orderId: orderId,
            amount: amount
        });

    } catch (err) {
        console.error("Payment Error:", err);
        res.redirect('/profile');
    }
});

// 2. POST: Handle "Fake" Payment Success
// 2. POST: Handle "Fake" Payment Success
app.post('/payment/confirm/:id', checkAuthenticated, async (req, res) => {
    try {
        const orderId = req.params.id;

        // Update Order Status to 'Processing'
        await pool.query(
            "UPDATE orders SET status = 'Processing' WHERE id = $1", 
            [orderId]
        );

        // Redirect user to HOME instead of profile
        res.redirect('/'); 

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
    
    res.render("website/menu_staff", { // We will create this file next
      title: "Staff POS Menu",
      products: productsRes.rows,
      layout: "layouts",
      categories: categoriesRes.rows, 
      user: req.user
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

// =========================================================
// DAILY STOCK COUNT (Store Manager Input & Admin Viewing)
// =========================================================

// 1. GET: Show Daily Stock Form (Only Store Managers submit counts)
app.get('/manager/daily-stock', checkAuthenticated, checkRole(['store_manager']), async (req, res) => {
    try {
        const userId = req.user.id;
        const locId = req.user.assigned_location_id;

        // 1. Get Location Name
        if (!locId) return res.send("Error: You are not assigned to a location.");
        const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [locId]);
        const locationName = locRes.rows[0].name;

        // 2. Check if already submitted today
        const today = new Date().toISOString().split('T')[0];
        const checkRes = await pool.query(
            "SELECT * FROM daily_inventory_logs WHERE user_id = $1 AND report_date = $2", 
            [userId, today]
        );
        const alreadySubmitted = checkRes.rows.length > 0;

        // 3. Fetch Master Menu (To show list of items to count)
        const masterRes = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

        res.render('manager/daily_stock.ejs', { 
            title: 'Daily Stock Count', 
            user: req.user,
            layout: 'layout',
            locationName: locationName,
            masterItems: masterRes.rows,
            alreadySubmitted: alreadySubmitted
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// 2. POST: Save Daily Stock Data (Only Store Managers save)
app.post('/api/manager/daily-stock', checkAuthenticated, checkRole(['store_manager']), async (req, res) => {
    const client = await pool.connect();
    try {
        const { items } = req.body; // Array of {name, category, quantity, unit}
        const userId = req.user.id;
        const locId = req.user.assigned_location_id;

        // Get Location Name for the log
        const locRes = await client.query("SELECT name FROM locations WHERE id = $1", [locId]);
        const locationName = locRes.rows[0].name;

        await client.query('BEGIN');

        // 1. Create Log Entry
        const logRes = await client.query(
            "INSERT INTO daily_inventory_logs (location_name, user_id, report_date) VALUES ($1, $2, CURRENT_DATE) RETURNING id",
            [locationName, userId]
        );
        const logId = logRes.rows[0].id;

        // 2. Insert Items
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

// 3. GET: History Dashboard (UPDATED: Admins can view all, Managers locked to own)
app.get('/manager/daily-stock/history', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const { location, date } = req.query;
        let queryParams = [];
        let whereClauses = [];
        
        // --- 1. LOCATION PERMISSION LOGIC ---
        // Store Manager: FORCED to their assigned location
        if (req.user.role === 'store_manager') {
             if (!req.user.assigned_location_id) return res.send("Error: No location assigned.");
             
             // Get location name for the query
             const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
             const myLocName = locRes.rows[0].name;
             
             whereClauses.push(`location_name = $${queryParams.length + 1}`);
             queryParams.push(myLocName);
        } 
        // Admin/Manager: OPTIONAL filter (Select as they want)
        else if (location && location !== 'All Locations') {
             whereClauses.push(`location_name = $${queryParams.length + 1}`);
             queryParams.push(location);
        }

        // --- 2. DATE FILTER (Optional) ---
        if (date) {
            whereClauses.push(`report_date = $${queryParams.length + 1}`);
            queryParams.push(date);
        }

        // Construct SQL
        let sql = `
            SELECT l.*, u.email 
            FROM daily_inventory_logs l
            LEFT JOIN users u ON l.user_id = u.id
        `;
        if (whereClauses.length > 0) {
            sql += " WHERE " + whereClauses.join(" AND ");
        }
        sql += " ORDER BY report_date DESC";

        const logsRes = await pool.query(sql, queryParams);
        
        // Fetch All Locations for the Admin Dropdown
        const allLocs = await pool.query("SELECT * FROM locations ORDER BY name ASC");

        res.render('manager/stock_history.ejs', { 
            title: 'Stock Count History',
            logs: logsRes.rows,
            locations: allLocs.rows,
            layout: 'layout',
            user: req.user,
            filters: { location: location || '', date: date || '' }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// 4. GET: View Specific Log Details (Required for the 'View' button)
app.get('/manager/daily-stock/view/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const logId = req.params.id;

        // Fetch Log Header
        const logRes = await pool.query(`
            SELECT l.*, u.email 
            FROM daily_inventory_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.id = $1
        `, [logId]);

        if (logRes.rows.length === 0) return res.redirect('/manager/daily-stock/history');
        const log = logRes.rows[0];

        // SECURITY: Store Manager can only view their own location's logs
        if (req.user.role === 'store_manager') {
             const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
             if (locRes.rows.length > 0 && log.location_name !== locRes.rows[0].name) {
                 return res.status(403).send("Access Denied: This log belongs to another store.");
             }
        }

        // Fetch Items in this log
        const itemsRes = await pool.query("SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name", [logId]);

        res.render('manager/view_daily_log.ejs', {
            title: `Log #${logId}`,
            log: log,
            items: itemsRes.rows,
            user: req.user
        });

    } catch (err) {
        console.error(err);
        res.redirect('/manager/daily-stock/history');
    }
});

// =========================================================
// MASTER STOCK MENU (Definition of Items)
// =========================================================

// 1. GET: Render the Menu Page
app.get('/admin/stock/menu', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        // Fetch all defined stock items
        const result = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");
        res.render('admin/stock/stock_menu.ejs', { 
            title: 'Master Ingredient Menu', 
            stocks: result.rows, // Data for the EJS loop
            user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// 2. POST: Add New Master Item
app.post('/admin/stock/menu/add', checkAuthenticated, checkRole(['manager', 'admin']), upload.single('image'), async (req, res) => {
    const { name, category, unit } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : '';
    
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

// 3. PATCH: Update Master Item
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

// 4. DELETE: Remove Master Item
app.delete('/api/stock/menu/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        await pool.query("DELETE FROM stocks WHERE id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Error" });
    }
});

// =========================================================
// STOCK ORDER MANAGEMENT
// =========================================================

// 1. List Stock Requests (The "Inbox" for Managers/Admins)
app.get('/admin/stock', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        let query = `
            SELECT s.*, u.email 
            FROM stock_requests s 
            LEFT JOIN users u ON s.user_id = u.id 
        `;
        let params = [];

        // Store Managers only see their own store's requests
        if (req.user.role === 'store_manager' && req.user.assigned_location_id) {
            const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
            if (locRes.rows.length > 0) {
                query += ` WHERE s.location_name = $1`;
                params.push(locRes.rows[0].name);
            }
        }

        query += ` ORDER BY s.created_at DESC`;
        const result = await pool.query(query, params);

        res.render('admin/stock/stock_orders.ejs', { 
            title: 'Stock Requests', 
            requests: result.rows, 
            user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// 2. View "Create Request" OR "Master Ingredient Menu"
// FIXED: Fetches 'stocks' so the EJS doesn't crash
app.get('/admin/stock/create', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const locRes = await pool.query("SELECT * FROM locations");
        const prodRes = await pool.query("SELECT * FROM products ORDER BY category, name");
        const catRes = await pool.query("SELECT * FROM categories ORDER BY id ASC");
        
        // --- NEW: Fetch Master Ingredients for the Admin Menu ---
        let stocks = [];
        try {
             // Ensure you have a table named 'stocks' or change this to your ingredient table name
             const stockRes = await pool.query("SELECT * FROM stocks ORDER BY category, name");
             stocks = stockRes.rows;
        } catch(e) {
             console.log("Note: 'stocks' table might not exist yet. Using empty array.");
        }

        res.render('admin/stock/create_stock.ejs', { 
            title: 'Stock Management', 
            locations: locRes.rows, 
            products: prodRes.rows,
            categories: catRes.rows,
            stocks: stocks, // <--- THIS FIXES THE ERROR
            user: req.user 
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/stock');
    }
});

// 3. ADMIN: Add New Ingredient to Master Menu
app.post("/admin/stock/add", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), upload.single("image"), async (req, res) => {
    const { name, category, quantity, unit } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : "";

    try {
        // Ensure you have a 'stocks' table with these columns
        await pool.query(
            "INSERT INTO stocks (name, category, quantity, unit, image_url) VALUES ($1, $2, $3, $4, $5)",
            [name, category, quantity || 0, unit, image_url]
        );
        res.redirect("/admin/stock/create");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding stock item. Does the 'stocks' table exist?");
    }
});

// 4. ADMIN: Update Ingredient (PATCH)
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

// 5. ADMIN: Delete Ingredient (DELETE)
app.delete("/api/stock/:id", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        await pool.query("DELETE FROM stocks WHERE id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed" });
    }
});

// 6. STORE MANAGER: Create Stock Request (Send Request)
app.post('/api/stock/create', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    const client = await pool.connect();
    try {
        const { location_name, items } = req.body; 
        
        // SECURITY: If Store Manager, force the location to their assigned one
        let finalLocation = location_name;
        if (req.user.role === 'store_manager') {
            if (req.user.assigned_location_id) {
                const locRes = await client.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
                if (locRes.rows.length > 0) {
                    finalLocation = locRes.rows[0].name;
                } else {
                    return res.status(403).json({ error: "No assigned location found." });
                }
            } else {
                return res.status(403).json({ error: "You are not assigned to a store." });
            }
        }

        await client.query('BEGIN');

        // Create Parent Request
        const reqRes = await client.query(
            "INSERT INTO stock_requests (user_id, location_name, status) VALUES ($1, $2, 'Pending') RETURNING id",
            [req.user.id, finalLocation]
        );
        const reqId = reqRes.rows[0].id;

        // Insert Items
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(
                    "INSERT INTO stock_request_items (stock_request_id, item_name, category, quantity) VALUES ($1, $2, $3, $4)",
                    [reqId, item.name, item.category, item.quantity]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: "Success" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Failed to create request" });
    } finally {
        client.release();
    }
});

// =========================================================
// ADMIN DASHBOARD (With Chart Data)
// =========================================================
app.get("/admin/dashboard", checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async(req, res) => {
    try {
        const client = await pool.connect();
        
        // 1. Determine Location Filter
        let filterLocationName = null;
        let locationFilterClause = "";
        let queryParams = [];

        // Fetch all locations for the Dropdown (Admin/Manager only)
        const allLocationsRes = await client.query("SELECT * FROM locations ORDER BY name ASC");
        
        // LOGIC: Set Filter based on Role
        if (req.user.role === 'store_manager') {
            // Store Manager: Locked to their assigned store
            if (req.user.assigned_location_id) {
                const myLoc = allLocationsRes.rows.find(l => l.id === req.user.assigned_location_id);
                filterLocationName = myLoc ? myLoc.name : 'Unknown';
            }
        } else {
            // Admin/Manager: Check URL param (e.g. ?location=Central)
            if (req.query.location && req.query.location !== 'All') {
                filterLocationName = req.query.location;
            }
        }

        // Helper to construct SQL WHERE clauses
        // If filterLocationName is set, we add "AND pickup_location = $1"
        if (filterLocationName) {
            locationFilterClause = "AND pickup_location = $1";
            queryParams.push(filterLocationName);
        }

        // 2. Fetch Key Metrics (Apply Filter)
        const productCountRes = await client.query("SELECT COUNT(*) FROM products"); // Inventory is global usually
        const userCountRes = await client.query("SELECT COUNT(*) FROM users"); // Users are global
        
        // Orders Count (Filtered)
        const orderCountRes = await client.query(
            `SELECT COUNT(*) FROM orders WHERE 1=1 ${locationFilterClause}`, 
            queryParams
        );

        // Revenue (Filtered, Completed only)
        const revenueRes = await client.query(
            `SELECT SUM(total_price) FROM orders WHERE status = 'Completed' ${locationFilterClause}`, 
            queryParams
        );
        const totalRevenue = revenueRes.rows[0].sum || 0;

        // 3. Charts Data (Filtered)
        const chartQuery = `
            SELECT to_char(created_at, 'Mon DD') as day, SUM(total_price) as daily_sales
            FROM orders 
            WHERE status = 'Completed' AND created_at > NOW() - INTERVAL '7 days' ${locationFilterClause}
            GROUP BY day, created_at
            ORDER BY created_at ASC
        `;
        const chartRes = await client.query(chartQuery, queryParams);

        // 4. Status Distribution (Filtered - For Donut Chart)
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
            user: req.user, 
            productsCount: productCountRes.rows[0].count,
            userCount: userCountRes.rows[0].count,
            ordersCount: orderCountRes.rows[0].count,
            totalRevenue: parseFloat(totalRevenue).toFixed(2),
            chartData: chartRes.rows,
            statusData: statusRes.rows,
            
            // Location Data for Dropdown
            locations: allLocationsRes.rows,
            currentFilter: filterLocationName || 'All'
        });

    } catch (err) {
        console.error(err);
        res.render("admin/dashboard.ejs", { 
            title: "Dashboard", user: req.user, productsCount: 0, userCount: 0, ordersCount: 0, totalRevenue: 0, chartData: [], statusData: [], locations: [], currentFilter: 'All' 
        });
    }
});

// =========================================================
// REPORTS PAGE (With Date & Location Filter)
// =========================================================
app.get('/admin/reports', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
        
        // 1. Determine Location Filter
        let filterLocationName = null;
        let dbParams = [selectedDate]; // First param is always Date
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

        // 2. Fetch Orders
        const ordersRes = await pool.query(`
            SELECT o.*, u.email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            WHERE DATE(o.created_at) = $1 ${locationSql}
            ORDER BY o.created_at DESC
        `, dbParams);

        const orders = ordersRes.rows;

        // 3. Calculate Stats
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
            user: req.user,
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

//Updated Order Logic
app.get('/admin/orders', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager', 'staff', 'cashier']), async (req, res) => {
    try {
        // FIXED: Removed 'u.name' because it doesn't exist in your users table yet.
        // We only select o.* and u.email.
        let query = `
            SELECT o.*, u.email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
        `;
        let params = [];

        // 2. KEEP EXISTING FILTER: If User is Store Manager, Staff, or Cashier, filter by their location
        if ((req.user.role === 'store_manager' || req.user.role === 'staff' || req.user.role === 'cashier') && req.user.assigned_location_id) {
            const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
            if (locRes.rows.length > 0) {
                const locationName = locRes.rows[0].name;
                query += ` WHERE o.pickup_location = $1`;
                params.push(locationName);
            }
        }

        // 3. UPDATE ORDER BY: Prioritize 'Requested' statuses, then date
        query += ` 
            ORDER BY 
            CASE WHEN o.status LIKE '%Requested%' THEN 0 ELSE 1 END,
            o.created_at DESC
        `;

        const result = await pool.query(query, params);
        
        // Render the View
        res.render('admin/orders/orders', { 
            title: 'Order Management', 
            orders: result.rows, 
            user: req.user 
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

// CHANGE: replaced 'checkAdmin' with 'checkAuthenticated, checkRole(...)'
app.post('/admin/orders/handle-request/:id', checkAuthenticated, checkRole(['admin', 'manager', 'store_manager']), async (req, res) => {
    const { action } = req.body;
    const orderId = req.params.id;
    let newStatus = '';

    if (action === 'approve_cancel') newStatus = 'Cancelled';
    if (action === 'reject_cancel') newStatus = 'Pending'; // Return to previous state
    
    if (action === 'approve_refund') newStatus = 'Refunded';
    if (action === 'reject_refund') newStatus = 'Completed'; // Return to previous state

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
    res.render("admin/inventory.ejs", { title: "Add Item", user: req.user });
});

app.get("/admin/inventory", checkAuthenticated, checkRole(['manager', 'admin']), async(req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
    const categoryResult = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    const allCategories = [{ name: "On Sale" }, ...categoryResult.rows];
    res.render("admin/inventory.ejs", { 
        title: "Inventory Management", products: result.rows, categories: allCategories, user: req.user 
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

app.post("/admin/inventory/add", checkAuthenticated, checkRole(['manager', 'admin']), upload.single("image"), async (req, res) => {
  const { name, category, price, is_best_seller, discount_type, discount_value } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : "https://via.placeholder.com/150";
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

app.get('/admin/reports', checkAuthenticated, checkRole(['manager', 'admin', "store_manager"]), (req, res) => {
    res.render('admin/reports.ejs', { title: 'Sales Reports & Analytics', user: req.user });
});

// --- ADMIN LOCATIONS ---

app.get('/admin/locations', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.render('admin/locations.ejs', { title: 'Location Management', locations: result.rows, user: req.user });
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
        
        // FETCH LOCATIONS
        const locResult = await pool.query("SELECT * FROM locations ORDER BY name ASC"); 

        res.render("admin/users/users.ejs", { 
            title: "User Management", 
            user: req.user, 
            usersList: result.rows,
            locations: locResult.rows // PASS LOCATIONS
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
        
        // Fetch all locations to populate the dropdown
        const locResult = await pool.query("SELECT * FROM locations");

        if (userResult.rows.length > 0) {
            res.render("admin/users/edit_user.ejs", { 
                title: "Edit User", 
                user: req.user, 
                targetUser: userResult.rows[0],
                locations: locResult.rows // Pass locations to the view [cite: 1]
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

        // FIX: Allow location to be saved for 'store_manager', 'staff', AND 'cashier'
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
    
    // VALIDATION: Force Location for Store Manager, Staff, OR Cashier
    if ((role === 'store_manager' || role === 'staff' || role === 'cashier') && !assigned_location_id) {
        return res.send(`<script>alert('Error: Staff, Cashiers, and Store Managers must have an assigned location.'); window.location.href='/admin/users';</script>`);
    }

    // Set location to NULL for other roles
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
            title: 'Category Management', layout: 'layout', categories: result.rows, user: req.user, userRole: req.user.role 
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
    res.render("website/profile.ejs", { title: "Manage Account", layout: "layouts", user: req.user });
});

app.post("/profile/update", checkAuthenticated, async (req, res) => {
    const { email, password } = req.body;
    const userId = req.user.id;

    try {
        if (password && password.length > 0) {
            // FIX: Wait for hash to finish before updating DB
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error(err);
                    return res.redirect("/profile");
                }
                
                try {
                    await pool.query("UPDATE users SET email = $1, password = $2 WHERE id = $3", [email, hash, userId]);
                    res.redirect("/profile"); // Redirect happens AFTER update
                } catch (dbErr) {
                    console.error(dbErr);
                    res.redirect("/profile");
                }
            });
        } else {
            // No password change, just update email
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
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, user: req.user, action: 'login' });
});

app.get("/register", (req, res) => {
    res.render("website/auth.ejs", { title: "Login / Register", layout: false, user: req.user, action: 'register' });
});

app.post("/login", passport.authenticate("local", { failureRedirect: "/login" }), (req, res) => {
    const role = req.user.role;

    if (role === 'admin' || role === 'manager' || role === 'store_manager' || role === 'cashier') {
        // Management roles go to Dashboard
        res.redirect("/admin/dashboard");
    } else if (role === 'staff') {
        // Staff goes directly to the Staff Menu
        res.redirect("/staff/menu");
    } else {
        // Regular customers go to Home
        res.redirect("/"); 
    }
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
        if (err) return next(err);
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
      callbackURL: "http://localhost:3000/auth/google/secrets",
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
          const existingUser = result.rows[0];
          if (existingUser.role === 'user') {
            return cb(null, existingUser);
          } else {
            return cb(null, false, { message: "Admins/Managers must log in with password." });
          }
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
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