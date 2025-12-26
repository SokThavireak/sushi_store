// --- PASSPORT STRATEGIES ---

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    const adminEmails = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(',') : [];
    const adminPasswords = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.split(',') : [];
    const adminIndex = adminEmails.indexOf(username);

    if (adminIndex !== -1 && password === adminPasswords[adminIndex]) {
      return cb(null, { id: `env-admin-${adminIndex}`, email: username, role: 'admin' });
    }

    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1 ", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        bcrypt.compare(password, user.password, (err, valid) => {
          if (valid) return cb(null, user);
          else return cb(null, false);
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      return cb(err);
    }
  })
);

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback', 
    proxy: true 
  },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [profile.email]);
        
        if (result.rows.length === 0) {
          const newUser = await pool.query(
            "INSERT INTO users (email, password, role) VALUES ($1, $2, 'user') RETURNING *",
            [profile.email, "google"] 
          );
          return cb(null, newUser.rows[0]);
        } else {
          const existingUser = result.rows[0];
          return cb(null, existingUser);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get("/auth/google/callback", 
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    const role = req.user.role;
    if (['admin', 'manager', 'store_manager'].includes(role)) {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/");
    }
  }
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});