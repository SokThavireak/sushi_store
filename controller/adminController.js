// =========================================================
// ADMIN ROUTES
// =========================================================

// --- NEW CONTROLLER ROUTE ---
app.get("/staff/menu", 
    checkAuthenticated, 
    checkRole(['admin', 'manager', 'store_manager', 'staff', 'cashier']), 
    menuController.getStaffMenu
);

// DAILY STOCK COUNT
app.get('/manager/daily-stock', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), async (req, res) => {
    try {
        const userId = req.user.id;
        let locId = req.user.assigned_location_id ? String(req.user.assigned_location_id) : null;

        if (['admin', 'manager'].includes(req.user.role)) {
            if (req.query.location) {
                locId = String(req.query.location); 
            } else if (!locId) {
                const firstLoc = await pool.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
                if (firstLoc.rows.length > 0) locId = String(firstLoc.rows[0].id);
            }
        }

        if (!locId) {
            return res.render('error', { message: "Error: No valid location found.", user: req.user });
        }

        const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [locId]);
        if (locRes.rows.length === 0) return res.send("Error: Location ID not found.");
        const locationName = locRes.rows[0].name;

        const allLocs = await pool.query("SELECT * FROM locations ORDER BY id ASC");

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
    const client = await pool.connect();
    try {
        const { items, location_id } = req.body; 
        const userId = req.user.id;
        let locId = req.user.assigned_location_id;

        if (['admin', 'manager'].includes(req.user.role)) {
            if (location_id) {
                locId = location_id;
            } else if (!locId) {
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

app.get('/manager/daily-stock/history', checkAuthenticated, checkRole(['store_manager', 'admin', 'manager']), async (req, res) => {
    try {
        let queryParams = [];
        let queryConditions = [];
        
        if (['admin', 'manager'].includes(req.user.role)) {
            if (req.query.location) {
                queryConditions.push(`l.id = $${queryParams.length + 1}`); 
                queryParams.push(String(req.query.location)); 
            }
        } else {
            if (req.user.assigned_location_id) {
                const userLoc = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
                if(userLoc.rows.length > 0) {
                    queryConditions.push(`dil.location_name = $${queryParams.length + 1}`);
                    queryParams.push(userLoc.rows[0].name);
                }
            }
        }

        if (req.query.date) {
            queryConditions.push(`dil.report_date = $${queryParams.length + 1}`);
            queryParams.push(req.query.date);
        }

        let sql = `
            SELECT dil.*, u.email 
            FROM daily_inventory_logs dil
            LEFT JOIN users u ON dil.user_id = u.id::varchar 
            LEFT JOIN locations l ON dil.location_name = l.name 
        `; 

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

app.get('/manager/daily-stock/view/:id', checkAuthenticated, checkRole(['manager', 'admin', 'store_manager']), async (req, res) => {
    try {
        const logId = req.params.id;

        const logRes = await pool.query(`
            SELECT l.*, u.email 
            FROM daily_inventory_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.id = $1
        `, [logId]);

        if (logRes.rows.length === 0) return res.redirect('/manager/daily-stock/history');
        const log = logRes.rows[0];

        if (req.user.role === 'store_manager') {
             const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
             if (locRes.rows.length > 0 && log.location_name !== locRes.rows[0].name) {
                 return res.status(403).send("Access Denied: This log belongs to another store.");
             }
        }

        const itemsRes = await pool.query("SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name", [logId]);

        res.render('manager/view_daily_log.ejs', {
            title: `Log #${logId}`,
            log: log,
            items: itemsRes.rows
        });

    } catch (err) {
        console.error(err);
        res.redirect('/manager/daily-stock/history');
    }
});