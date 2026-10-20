import { canAccessOrder } from "../middleware/auth.js";

// GET: Render the payment confirmation page
export const renderPaymentPage = async (req, res) => {
  try {
    const orderId = req.params.id;
    const pool = req.pool; // Access the DB pool passed from your index.js middleware

    const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (orderRes.rows.length === 0) return res.redirect("/");

    const order = orderRes.rows[0];

    // Authorization: Verify user is staff or the order owner
    if (!canAccessOrder(req.user, order)) {
      return res.status(403).send("Access Denied: You do not have permission to view this payment page.");
    }

    const amount = parseFloat(order.total_price).toFixed(2); // Must be 2 decimal places

    res.render("website/payment", {
      title: "Confirm Payment",
      layout: "layouts",
      orderId: orderId,
      amount: amount
    });
  } catch (err) {
    console.error("Payment Error:", err);
    res.redirect("/profile");
  }
};