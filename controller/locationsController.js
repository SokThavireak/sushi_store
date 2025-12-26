// --- ADMIN LOCATIONS ---

app.get('/admin/locations', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.render('admin/locations.ejs', { title: 'Location Management', locations: result.rows });
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.post('/api/locations', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    const { name, address, google_map_url, status, hours_mon_fri, hours_sat_sun } = req.body;
    try {
        await pool.query(
            "INSERT INTO locations (name, address, google_map_url, status, hours_mon_fri, hours_sat_sun) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, address, google_map_url, status, hours_mon_fri, hours_sat_sun]
        );
        res.redirect('/admin/locations');
    } catch (err) {
        res.status(500).send("Error adding location");
    }
});

app.patch('/api/locations/:id', checkAuthenticated, checkRole(['manager', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { name, address, google_map_url, status, hours_mon_fri, hours_sat_sun } = req.body;
    try {
        await pool.query(
            "UPDATE locations SET name=$1, address=$2, google_map_url=$3, status=$4, hours_mon_fri=$5, hours_sat_sun=$6 WHERE id=$7",
            [name, address, google_map_url, status, hours_mon_fri, hours_sat_sun, id]
        );
        res.json({ message: "Updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete('/api/locations/:id', checkAuthenticated, checkRole(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM locations WHERE id=$1", [id]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});