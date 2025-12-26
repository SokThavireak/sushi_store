// =========================================================
// PUBLIC ROUTES
// =========================================================

app.get('/orders', checkAuthenticated, async (req, res) => {
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

// --- NEW CONTROLLER ROUTE ---
app.get("/menu", menuController.getPublicMenu);