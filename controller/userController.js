// --- ADMIN USER MANAGEMENT ---

app.get("/admin/users", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
        const locResult = await pool.query("SELECT * FROM locations ORDER BY name ASC"); 

        res.render("admin/users/users.ejs", { 
            title: "User Management", 
            usersList: result.rows,
            locations: locResult.rows 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching users");
    }
});

app.post("/admin/users/delete/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        if (parseInt(id) === req.user.id) return res.redirect("/admin/users");
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
        res.redirect("/admin/users");
    } catch (err) {
        res.redirect("/admin/users");
    }
});

app.get("/admin/users/edit/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        
        const locResult = await pool.query("SELECT * FROM locations");

        if (userResult.rows.length > 0) {
            res.render("admin/users/edit_user.ejs", { 
                title: "Edit User", 
                targetUser: userResult.rows[0],
                locations: locResult.rows 
            });
        } else {
            res.redirect("/admin/users");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/admin/users");
    }
});

app.post("/admin/users/update/:id", checkAuthenticated, checkRole(['admin']), async (req, res) => {
    try {
        const id = req.params.id;
        const { email, role, assigned_location_id } = req.body; 

        const finalLocation = (role === 'store_manager' || role === 'staff' || role === 'cashier') ? assigned_location_id : null;

        await pool.query(
            "UPDATE users SET email = $1, role = $2, assigned_location_id = $3 WHERE id = $4", 
            [email, role, finalLocation, id]
        );
        res.redirect("/admin/users");
    } catch (err) {
        console.error(err);
        res.redirect("/admin/users");
    }
});

app.post("/admin/create-manager", checkAuthenticated, checkRole(['admin', 'manager']), async (req, res) => {
  const { email, password, role, assigned_location_id } = req.body;

  try {
    const checkResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
        return res.send(`<script>alert('Email already exists'); window.location.href='/admin/users';</script>`);
    }
    
    if ((role === 'store_manager' || role === 'staff' || role === 'cashier') && !assigned_location_id) {
        return res.send(`<script>alert('Error: Staff, Cashiers, and Store Managers must have an assigned location.'); window.location.href='/admin/users';</script>`);
    }

    const finalLocation = (role === 'store_manager' || role === 'staff' || role === 'cashier') ? assigned_location_id : null;

    bcrypt.hash(password, saltRounds, async (err, hash) => {
      await pool.query(
          "INSERT INTO users (email, password, role, assigned_location_id) VALUES ($1, $2, $3, $4)", 
          [email, hash, role, finalLocation]
      );
      res.redirect("/admin/users"); 
    });

  } catch (err) {
    console.error(err);
    res.redirect("/admin/users"); 
  }
});