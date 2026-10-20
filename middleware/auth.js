export function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  const isApi = req.xhr || req.path.startsWith("/api") || (req.headers.accept && req.headers.accept.includes("application/json"));
  if (isApi) {
    return res.status(401).json({ error: "Authentication required" });
  }
  res.redirect("/login");
}

export function checkRole(allowedRoles) {
  return (req, res, next) => {
    if (req.user && allowedRoles.includes(req.user.role)) {
      return next();
    }
    const isApi = req.xhr || req.path.startsWith("/api") || (req.headers.accept && req.headers.accept.includes("application/json"));
    if (isApi) {
      return res.status(403).json({ error: "Access Denied: Insufficient permissions" });
    }
    res.status(403).send("Access Denied");
  };
}

/**
 * Validates whether the logged in user is either the owner of the order OR possesses a staff/admin role.
 */
export function canAccessOrder(user, order) {
  if (!user || !order) return false;
  const staffRoles = ["admin", "manager", "store_manager", "staff", "cashier"];
  if (staffRoles.includes(user.role)) return true;
  return String(user.id) === String(order.user_id);
}
