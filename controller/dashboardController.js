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