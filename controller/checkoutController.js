// =========================================================
// CHECKOUT & ORDERS ROUTE
// =========================================================

app.get('/checkout', checkAuthenticated, async (req, res) => {
    if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
         return res.redirect('/'); 
    }

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
            res.redirect('/orders'); 
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