// --- INVENTORY ---

app.get("/add-item", checkAuthenticated, checkRole(['manager', 'admin']), (req, res) => {
    res.render("admin/inventory.ejs", { title: "Add Item" });
});

app.get("/admin/inventory", checkAuthenticated, checkRole(['manager', 'admin']), async(req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
    const categoryResult = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    const allCategories = [{ name: "On Sale" }, ...categoryResult.rows];
    res.render("admin/inventory.ejs", { 
        title: "Inventory Management", products: result.rows, categories: allCategories
    });
  } catch (err) {
    res.status(500).send("Database Error");
  }
});

app.post("/admin/inventory/add", checkAuthenticated, checkRole(['manager', 'admin']), upload.single("image"), async (req, res) => {
  const { name, category, price, is_best_seller, discount_type, discount_value } = req.body;
  const image_url = req.file ? req.file.path : "https://via.placeholder.com/150";
  const isBestSellerBool = is_best_seller === 'true';
  const finalType = discount_type || 'none';
  const finalValue = discount_value || 0;

  try {
    const nameCheck = await pool.query("SELECT * FROM products WHERE name = $1", [name]);
    if (nameCheck.rows.length > 0) {
        return res.send(`<script>alert('Error: Name exists.'); window.location.href='/admin/inventory';</script>`);
    }

    const catCheck = await pool.query("SELECT * FROM categories WHERE name = $1", [category]);
    if (catCheck.rows.length === 0) {
        await pool.query("INSERT INTO categories (name) VALUES ($1)", [category]);
    }

    await pool.query(
      "INSERT INTO products (name, category, price, image_url, is_best_seller, discount_type, discount_value) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [name, category, price, image_url, isBestSellerBool, finalType, finalValue]
    );

    res.redirect("/admin/inventory"); 
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding item");
  }
});

app.patch("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category, price, image_url, is_best_seller, discount_type, discount_value } = req.body;
  try {
    await pool.query(
      "UPDATE products SET name=$1, category=$2, price=$3, image_url=$4, is_best_seller=$5, discount_type=$6, discount_value=$7 WHERE id=$8",
      [name, category, price, image_url, is_best_seller, discount_type, discount_value, id]
    );
    res.json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/inventory/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM cart WHERE product_id = $1", [id]); 
    await pool.query("DELETE FROM products WHERE id = $1", [id]); 
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});