import { pool } from '../config/database.js';

export const processPayment = async (req, res) => {
    // This maps to app.get('/payment/:id') in your original code
    try {
        const orderId = req.params.id;
        const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
        if (orderRes.rows.length === 0) return res.redirect('/');
        
        const order = orderRes.rows[0];
        const amount = parseFloat(order.total_price).toFixed(2);

        res.render('website/payment', { 
            title: 'Confirm Payment', 
            layout: 'layouts',
            orderId: orderId,
            amount: amount
        });

    } catch (err) {
        console.error("Payment Error:", err);
        res.redirect('/profile');
    }
};

export const confirmPayment = async (req, res) => {
    // This maps to app.post('/payment/confirm/:id')
    try {
        const orderId = req.params.id;
        await pool.query(
            "UPDATE orders SET status = 'Processing' WHERE id = $1", 
            [orderId]
        );
        res.redirect('/orders'); 
    } catch (err) {
        console.error(err);
        res.status(500).send("Error confirming payment");
    }
};