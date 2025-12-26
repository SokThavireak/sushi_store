// --- PROFILE ROUTES ---

app.get("/profile", checkAuthenticated, (req, res) => {
    res.render("website/profile.ejs", { title: "Manage Account", layout: "layouts" });
});

app.post("/profile/update", checkAuthenticated, async (req, res) => {
    const { email, password } = req.body;
    const userId = req.user.id;

    try {
        if (password && password.length > 0) {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error(err);
                    return res.redirect("/profile");
                }
                
                try {
                    await pool.query("UPDATE users SET email = $1, password = $2 WHERE id = $3", [email, hash, userId]);
                    res.redirect("/profile"); 
                } catch (dbErr) {
                    console.error(dbErr);
                    res.redirect("/profile");
                }
            });
        } else {
            await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);
            res.redirect("/profile");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/profile");
    }
});

app.post("/profile/delete", checkAuthenticated, async (req, res) => {
    const userId = req.user.id;
    try {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        req.logout((err) => {
            if (err) console.error(err);
            res.redirect("/");
        });
    } catch (err) {
        res.redirect("/profile");
    }
});