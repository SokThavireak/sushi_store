// =========================================================
// CART API ROUTES
// =========================================================

app.get("/api/cart", async (req, res) => {
  if (!req.user) return res.json([]); 

  if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
      return res.json([]); 
  }

  try {
    const result = await pool.query(`
      SELECT c.id as cart_id, c.quantity, p.id as product_id, p.name, p.price, p.image_url 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = $1 
      ORDER BY c.id ASC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/cart", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Please login to add items" });

  if (typeof req.user.id === 'string' && req.user.id.startsWith('env-')) {
      return res.status(403).json({ error: "Super Admins cannot use the shopping cart." });
  }

  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const check = await pool.query("SELECT * FROM cart WHERE product_id = $1 AND user_id = $2", [productId, userId]);
    if (check.rows.length > 0) {
      await pool.query("UPDATE cart SET quantity = quantity + 1 WHERE product_id = $1 AND user_id = $2", [productId, userId]);
    } else {
      await pool.query("INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, 1)", [userId, productId]);
    }
    res.json({ message: "Item added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/cart/:id", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Login required" });
  const { id } = req.params;
  const { action } = req.body;
  
  try {
    if (action === 'increment') {
      await pool.query("UPDATE cart SET quantity = quantity + 1 WHERE id = $1", [id]);
    } else if (action === 'decrement') {
      const current = await pool.query("SELECT quantity FROM cart WHERE id = $1", [id]);
      if (current.rows.length > 0 && current.rows[0].quantity > 1) {
        await pool.query("UPDATE cart SET quantity = quantity - 1 WHERE id = $1", [id]);
      } else {
        await pool.query("DELETE FROM cart WHERE id = $1", [id]);
      }
    }
    res.json({ message: "Updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});