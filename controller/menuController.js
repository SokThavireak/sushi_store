import { pool } from '../config/database.js';

// Get Public Menu (Website)
export const getMenu = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY category, name");
        const products = result.rows;
        const categories = [...new Set(products.map(p => p.category))];
        
        res.render('website/menu', { 
            title: 'Menu', 
            products: products, 
            categories: categories,
            layout: 'layouts' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// Also used for Public
export const getPublicMenu = getMenu; 

// Get Staff/Cashier Menu Interface
export const getStaffMenu = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY category, name");
        const products = result.rows;
        const categories = [...new Set(products.map(p => p.category))];
        
        // Fetch locations for pickup selection in staff view
        const locRes = await pool.query("SELECT * FROM locations WHERE status = 'Open'");

        res.render('website/menu_staff', { 
            title: 'Staff Menu', 
            products: products, 
            categories: categories,
            locations: locRes.rows,
            layout: 'layouts'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};