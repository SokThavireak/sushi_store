import { pool } from '../config/database.js';

export const getCategories = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
        res.render('admin/category.ejs', { 
            title: 'Category Management', layout: 'layout', categories: result.rows, userRole: req.user.role 
        });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

export const addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        await pool.query('INSERT INTO categories (name) VALUES ($1)', [name]);
        res.status(201).json({ message: "Category Created" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
};

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await pool.query('UPDATE categories SET name = $1 WHERE id = $2', [name, id]);
        res.status(200).json({ message: "Category Updated" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        res.status(200).json({ message: "Category Deleted" });
    } catch (err) {
        res.status(500).json({ error: "Database Error" });
    }
};