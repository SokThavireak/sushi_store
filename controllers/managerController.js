import express from "express";
import pool from "../config/db.js";
import { checkAuthenticated, checkRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/manager/daily-stock", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    let locId = req.user.assigned_location_id ? String(req.user.assigned_location_id) : null;
    if (["admin", "manager"].includes(req.user.role)) {
      if (req.query.location) locId = String(req.query.location);
      else if (!locId) {
        const firstLoc = await pool.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
        if (firstLoc.rows.length > 0) locId = String(firstLoc.rows[0].id);
      }
    }
    if (!locId) return res.render("error", { message: "Error: No valid location found.", user: req.user });
    
    const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [locId]);
    if (locRes.rows.length === 0) return res.send("Error: Location ID not found.");
    
    const allLocs = await pool.query("SELECT * FROM locations ORDER BY id ASC");
    const dateQuery = req.query.date || new Date().toISOString().split("T")[0];
    const checkRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE location_name = $1 AND report_date = $2", [locRes.rows[0].name, dateQuery]);
    const masterRes = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

    res.render("manager/daily_stock.ejs", {
      title: "Daily Stock Count", layout: "layout", locationName: locRes.rows[0].name,
      locations: allLocs.rows, masterItems: masterRes.rows, alreadySubmitted: checkRes.rows.length > 0,
      user: req.user, currentLocationId: locId, query: { date: dateQuery, location: locId },
    });
  } catch (err) {
    res.status(500).send("Server Error: " + err.message);
  }
});

router.post("/api/manager/daily-stock", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  if (typeof req.user.id === "string" && req.user.id.startsWith("env-")) return res.status(403).json({ error: "Super Admins cannot submit stock counts." });
  const client = await pool.connect();
  try {
    let locId = req.user.assigned_location_id;
    if (["admin", "manager"].includes(req.user.role)) {
      if (req.body.location_id) locId = req.body.location_id;
      else if (!locId) {
        const firstLoc = await client.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
        if (firstLoc.rows.length > 0) locId = firstLoc.rows[0].id;
      }
    }
    if (!locId) return res.status(400).json({ error: "No location specified." });
    
    const locRes = await client.query("SELECT name FROM locations WHERE id = $1", [locId]);
    if (locRes.rows.length === 0) return res.status(400).json({ error: "Invalid location assigned." });

    await client.query("BEGIN");
    const logRes = await client.query("INSERT INTO daily_inventory_logs (location_name, user_id, report_date) VALUES ($1, $2, CURRENT_DATE) RETURNING id", [locRes.rows[0].name, req.user.id]);
    for (const item of req.body.items) {
      await client.query("INSERT INTO daily_inventory_items (log_id, item_name, category, quantity, unit) VALUES ($1, $2, $3, $4, $5)", [logRes.rows[0].id, item.name, item.category, item.quantity, item.unit]);
    }
    await client.query("COMMIT");
    res.json({ message: "Saved successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
});

router.delete("/api/manager/daily-stock/:id", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    const logRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [req.params.id]);
    if (logRes.rows.length === 0) return res.status(404).json({ error: "Log not found" });
    const log = logRes.rows[0];
    const diffMinutes = (new Date() - new Date(log.created_at)) / 1000 / 60;
    
    if (req.user.role !== "admin" && req.user.role !== "manager") {
      if (req.user.id != log.user_id) return res.status(403).json({ error: "Unauthorized" });
      if (diffMinutes > 5) return res.status(403).json({ error: "Time limit exceeded." });
    }
    
    await pool.query("DELETE FROM daily_inventory_items WHERE log_id = $1", [req.params.id]);
    await pool.query("DELETE FROM daily_inventory_logs WHERE id = $1", [req.params.id]);
    res.json({ message: "Deleted successfully" });
  } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

router.get("/manager/daily-stock/edit/:id", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    const logRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [req.params.id]);
    if (logRes.rows.length === 0) return res.redirect("/manager/daily-stock/history");
    const log = logRes.rows[0];
    const diffMinutes = (new Date() - new Date(log.created_at)) / 1000 / 60;
    
    const isAdmin = req.user.role === "admin" || req.user.role === "manager";
    if (!isAdmin && !log.is_unlocked && (req.user.id != log.user_id || diffMinutes > 5)) {
      return res.send(`<script>alert('Edit time limit expired. Ask a Manager to unlock this report.'); window.location.href='/manager/daily-stock/history';</script>`);
    }

    const itemsRes = await pool.query("SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name", [req.params.id]);
    res.render("manager/edit_daily_log.ejs", { log: log, items: itemsRes.rows, title: "Edit Stock Log", layout: "layout" });
  } catch (err) { res.redirect("/manager/daily-stock/history"); }
});

router.post("/api/manager/daily-stock/update/:id", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  const client = await pool.connect();
  try {
    const logRes = await client.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [req.params.id]);
    if (logRes.rows.length === 0) return res.status(404).json({ error: "Log not found" });
    const log = logRes.rows[0];
    const diffMinutes = (new Date() - new Date(log.created_at)) / 1000 / 60;
    const isAdmin = req.user.role === "admin" || req.user.role === "manager";
    
    if (!isAdmin && !log.is_unlocked && (req.user.id != log.user_id || diffMinutes > 5)) {
      return res.status(403).json({ error: "Edit time limit expired or report is locked." });
    }

    await client.query("BEGIN");
    for (const item of (req.body.items || [])) {
      await client.query("UPDATE daily_inventory_items SET quantity = $1 WHERE id = $2 AND log_id = $3", [item.quantity, item.id, req.params.id]);
    }
    await client.query("COMMIT");
    res.json({ message: "Updated" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Update failed" });
  } finally { client.release(); }
});

router.post("/api/manager/daily-stock/toggle-lock/:id", checkAuthenticated, checkRole(["admin", "manager"]), async (req, res) => {
  try {
    await pool.query("UPDATE daily_inventory_logs SET is_unlocked = NOT COALESCE(is_unlocked, false) WHERE id = $1", [req.params.id]);
    res.json({ message: "Permission updated" });
  } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

router.get("/manager/daily-stock/history", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    let queryParams = [];
    let queryConditions = [];
    
    if (["admin", "manager"].includes(req.user.role) && req.query.location) {
      queryConditions.push(`l.id = $${queryParams.length + 1}`);
      queryParams.push(String(req.query.location));
    } else if (req.user.assigned_location_id) {
      const userLoc = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
      if (userLoc.rows.length > 0) {
        queryConditions.push(`dil.location_name = $${queryParams.length + 1}`);
        queryParams.push(userLoc.rows[0].name);
      }
    }

    if (req.query.date) {
      queryConditions.push(`dil.report_date = $${queryParams.length + 1}`);
      queryParams.push(req.query.date);
    }

    let sql = `SELECT dil.*, u.email FROM daily_inventory_logs dil LEFT JOIN users u ON dil.user_id = u.id::varchar LEFT JOIN locations l ON dil.location_name = l.name `;
    if (queryConditions.length > 0) sql += " WHERE " + queryConditions.join(" AND ");
    sql += " ORDER BY dil.report_date DESC, dil.created_at DESC";

    const logsRes = await pool.query(sql, queryParams);
    const locRes = await pool.query("SELECT * FROM locations ORDER BY id ASC");
    res.render("manager/stock_history.ejs", { title: "Stock Count History", layout: "layout", logs: logsRes.rows, locations: locRes.rows, query: req.query, user: req.user });
  } catch (err) { res.status(500).send("Server Error"); }
});

router.get("/manager/daily-stock/view/:id", checkAuthenticated, checkRole(["manager", "admin", "store_manager"]), async (req, res) => {
  try {
    const logRes = await pool.query(`SELECT l.*, u.email FROM daily_inventory_logs l LEFT JOIN users u ON l.user_id = u.id::varchar WHERE l.id = $1`, [req.params.id]);
    if (logRes.rows.length === 0) return res.redirect("/manager/daily-stock/history");
    const log = logRes.rows[0];

    if (req.user.role === "store_manager") {
      const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
      if (locRes.rows.length > 0 && log.location_name !== locRes.rows[0].name) return res.status(403).send("Access Denied");
    }

    const itemsRes = await pool.query(`SELECT dii.*, s.image_url FROM daily_inventory_items dii LEFT JOIN stocks s ON dii.item_name = s.name WHERE dii.log_id = $1 ORDER BY dii.category, dii.item_name`, [req.params.id]);
    res.render("manager/view_daily_log.ejs", { title: `Log #${req.params.id}`, log: log, items: itemsRes.rows, layout: "layout" });
  } catch (err) { res.redirect("/manager/daily-stock/history"); }
});

router.get("/manager/daily-stock/history/:id", checkAuthenticated, async (req, res) => {
  try {
    const logRes = await pool.query(`SELECT l.*, u.email FROM daily_inventory_logs l LEFT JOIN users u ON l.user_id = u.id::varchar WHERE l.id = $1`, [req.params.id]);
    if (logRes.rows.length === 0) return res.status(404).send("Stock Log not found");
    const itemsRes = await pool.query(`SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name`, [req.params.id]);
    res.render("manager/view_daily_log.ejs", { title: `Log #${req.params.id}`, log: logRes.rows[0], items: itemsRes.rows, layout: "layout" });
  } catch (err) { res.status(500).send("Server Error"); }
});

// JSON API counterpart routes for React SPA
router.get("/api/manager/daily-stock", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    let locId = req.user.assigned_location_id ? String(req.user.assigned_location_id) : null;
    if (["admin", "manager"].includes(req.user.role)) {
      if (req.query.location) locId = String(req.query.location);
      else if (!locId) {
        const firstLoc = await pool.query("SELECT id FROM locations ORDER BY id ASC LIMIT 1");
        if (firstLoc.rows.length > 0) locId = String(firstLoc.rows[0].id);
      }
    }
    if (!locId) return res.status(400).json({ error: "No valid location found." });
    
    const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [locId]);
    if (locRes.rows.length === 0) return res.status(404).json({ error: "Location ID not found." });
    
    const allLocs = await pool.query("SELECT * FROM locations ORDER BY id ASC");
    const dateQuery = req.query.date || new Date().toISOString().split("T")[0];
    const checkRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE location_name = $1 AND report_date = $2", [locRes.rows[0].name, dateQuery]);
    const masterRes = await pool.query("SELECT * FROM stocks ORDER BY category, name ASC");

    res.json({
      locationName: locRes.rows[0].name,
      locations: allLocs.rows,
      masterItems: masterRes.rows,
      alreadySubmitted: checkRes.rows.length > 0,
      currentLocationId: locId,
      query: { date: dateQuery, location: locId },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/manager/daily-stock/edit/:id", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    const logRes = await pool.query("SELECT * FROM daily_inventory_logs WHERE id = $1", [req.params.id]);
    if (logRes.rows.length === 0) return res.status(404).json({ error: "Stock Log not found" });
    const log = logRes.rows[0];
    const diffMinutes = (new Date() - new Date(log.created_at)) / 1000 / 60;
    
    const isAdmin = req.user.role === "admin" || req.user.role === "manager";
    if (!isAdmin && !log.is_unlocked && (req.user.id != log.user_id || diffMinutes > 5)) {
      return res.status(403).json({ error: "Edit time limit expired. Ask a Manager to unlock this report." });
    }

    const itemsRes = await pool.query("SELECT * FROM daily_inventory_items WHERE log_id = $1 ORDER BY category, item_name", [req.params.id]);
    res.json({ log, items: itemsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/api/manager/stock-history", checkAuthenticated, checkRole(["store_manager", "admin", "manager"]), async (req, res) => {
  try {
    let queryParams = [];
    let queryConditions = [];
    
    if (["admin", "manager"].includes(req.user.role) && req.query.location) {
      queryConditions.push(`l.id = $${queryParams.length + 1}`);
      queryParams.push(String(req.query.location));
    } else if (req.user.assigned_location_id) {
      const userLoc = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
      if (userLoc.rows.length > 0) {
        queryConditions.push(`dil.location_name = $${queryParams.length + 1}`);
        queryParams.push(userLoc.rows[0].name);
      }
    }

    if (req.query.date) {
      queryConditions.push(`dil.report_date = $${queryParams.length + 1}`);
      queryParams.push(req.query.date);
    }

    let sql = `SELECT dil.*, u.email FROM daily_inventory_logs dil LEFT JOIN users u ON dil.user_id = u.id::varchar LEFT JOIN locations l ON dil.location_name = l.name `;
    if (queryConditions.length > 0) sql += " WHERE " + queryConditions.join(" AND ");
    sql += " ORDER BY dil.report_date DESC, dil.created_at DESC";

    const logsRes = await pool.query(sql, queryParams);
    const locRes = await pool.query("SELECT * FROM locations ORDER BY id ASC");
    res.json({ logs: logsRes.rows, locations: locRes.rows, query: req.query });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/api/manager/daily-stock/view/:id", checkAuthenticated, checkRole(["manager", "admin", "store_manager"]), async (req, res) => {
  try {
    const logRes = await pool.query(`SELECT l.*, u.email FROM daily_inventory_logs l LEFT JOIN users u ON l.user_id = u.id::varchar WHERE l.id = $1`, [req.params.id]);
    if (logRes.rows.length === 0) return res.status(404).json({ error: "Log not found" });
    const log = logRes.rows[0];

    if (req.user.role === "store_manager") {
      const locRes = await pool.query("SELECT name FROM locations WHERE id = $1", [req.user.assigned_location_id]);
      if (locRes.rows.length > 0 && log.location_name !== locRes.rows[0].name) return res.status(403).json({ error: "Access Denied" });
    }

    const itemsRes = await pool.query(`SELECT dii.*, s.image_url FROM daily_inventory_items dii LEFT JOIN stocks s ON dii.item_name = s.name WHERE dii.log_id = $1 ORDER BY dii.category, dii.item_name`, [req.params.id]);
    res.json({ log, items: itemsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;