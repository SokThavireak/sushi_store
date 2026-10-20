// POST: Process staff checkout for Cash or QR
export const processStaffCheckout = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { payment_method } = req.body;
        
        // Access the database pool that is passed through your middleware
        const pool = req.pool; 
        
        if (payment_method === 'Cash') {
            // Update order to Completed and set payment to Cash
            await pool.query(
                "UPDATE orders SET status = 'Completed', payment_method = 'Cash' WHERE id = $1", 
                [orderId]
            );
            res.json({ success: true, method: 'Cash' });
            
        } else if (payment_method === 'QR') {
            // Just update the payment method, keep status Pending/Processing
            await pool.query(
                "UPDATE orders SET payment_method = 'QR' WHERE id = $1", 
                [orderId]
            );
            // Send back the URL to the ABA screen we built
            res.json({ success: true, method: 'QR', redirectUrl: `/payment/${orderId}` });
            
        } else {
            res.status(400).json({ error: "Invalid payment method" });
        }
    } catch (err) {
        console.error("Checkout Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
};