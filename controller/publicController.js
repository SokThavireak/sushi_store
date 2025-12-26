import { pool } from '../config/database.js';

export const getHome = async (req, res) => {
    if (req.user && req.user.role === 'staff') {
        return res.redirect('/staff/menu'); 
    }

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
        if (!res.headersSent) {
            res.render("website/main/index", { products: [], categories: [] });
        }
    }
};

export const getOrders = async (req, res) => {
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
        return res.render('orders', { title: 'My Orders', orders: [] });
    }

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
};

export const requestCancel = async (req, res) => {
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
};

export const requestRefund = async (req, res) => {
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
};

export const getAbout = (req, res) => {
    res.render('website/about', { title: 'About Us', layout: 'layouts'});
};

export const getOffers = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
        const discountedProducts = result.rows.filter(p => p.discount_type && p.discount_type !== 'none' && p.discount_value > 0);
        res.render('website/offers', { title: 'Offers', products: discountedProducts, layout: 'layouts' });
    } catch (err) {
        res.render('website/offers', { title: 'Offers', products: [], layout: 'layouts' });
    }
};