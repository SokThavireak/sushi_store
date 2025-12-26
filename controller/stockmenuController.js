import { pool } from '../config/database.js';

export const getStockMenu = async (req, res) => {
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
};

export const addStockItem = async (req, res) => {
    const { name, category, unit } = req.body;
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
};

export const updateStockItem = async (req, res) => {
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
};

export const deleteStockItem = async (req, res) => {
    try {
        await pool.query("DELETE FROM stocks WHERE id=$1", [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Error" });
    }
};