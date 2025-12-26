// =========================================================
// STOCK ORDER MANAGEMENT
// =========================================================

app.get('/admin/stock', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
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
        const locResult = await pool.query("SELECT * FROM locations");
        const stockResult = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

        res.render('admin/stock/stock_orders.ejs', { 
            title: 'Stock Requests', 
            requests: result.rows,
            locations: locResult.rows,      
            stocks: stockResult.rows        
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

app.post('/api/stock/create', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    const client = await pool.connect();
    try {
        const { location_name, items } = req.body; 
        
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

        const reqRes = await client.query(
            "INSERT INTO stock_requests (user_id, location_name, status) VALUES ($1, $2, 'Pending') RETURNING id",
            [req.user.id, finalLocation]
        );
        const reqId = reqRes.rows[0].id;

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