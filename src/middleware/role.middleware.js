// Role hierarchy & alias groupings
const ROLE_HIERARCHY = {
  admin: ["*"],
  hotel_manager: [
    "manager", "accountant_manager", "cooperative_manager", "kitchen_manager", 
    "hr_manager", "housekeeping_manager", "fnb_manager", "store_manager", 
    "purchasing_manager", "finance", "hr", "purchasing", "cashier", "waiter", "chef", "bartender"
  ],
  accountant_manager: ["finance", "accountant", "purchasing_manager", "store_manager", "purchasing", "cashier"],
  cooperative_manager: ["manager", "cafe_supervisor", "bar_restaurant_supervisor", "waiter", "cafe_waiter", "bartender", "barista", "receptionist", "cashier"],
  kitchen_manager: ["chef", "cafe_chef", "fb_controller"],
  cafe_supervisor: ["cafe_waiter", "waiter", "barista", "cashier"],
  bar_restaurant_supervisor: ["waiter", "bartender", "cashier"],
  fnb_manager: ["fb_controller", "kitchen_manager"],
  store_manager: ["storekeeper", "inventory"],
  purchasing_manager: ["purchasing"],
  hr_manager: ["hr"],
  housekeeping_manager: ["housekeeping"],
  cafe_waiter: ["waiter"],
  cafe_chef: ["chef"],
  barista: ["bartender", "waiter"],
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = String(req.user.role || "").toLowerCase().trim();
    const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase().trim());

    // Superuser / Admin bypass
    if (userRole === "admin") {
      return next();
    }

    // Direct match
    if (normalizedAllowed.includes(userRole) || normalizedAllowed.includes("*")) {
      return next();
    }

    // Check if user's role grants permission for any of the allowed roles
    const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
    if (inheritedRoles.includes("*")) {
      return next();
    }

    const hasInheritedAccess = normalizedAllowed.some((allowed) =>
      inheritedRoles.includes(allowed)
    );

    if (hasInheritedAccess) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource",
    });
  };
};

/**
 * Validates that an operation matches the user's assigned outlet,
 * unless the user is an admin or operational manager.
 */
const authorizeOutlet = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const userRole = String(req.user.role || "").toLowerCase();
  const unrestrictedRoles = [
    "admin",
    "hotel_manager",
    "accountant_manager",
    "cooperative_manager",
    "kitchen_manager",
    "fnb_manager",
    "manager"
  ];

  if (unrestrictedRoles.includes(userRole)) {
    // Unrestricted managers can act across any outlet
    return next();
  }

  // Scoped user: check request params/body/query outlet_id against user's assigned outlet
  const requestedOutletId = req.body.outlet_id || req.body.outletId || req.query.outlet_id || req.query.outletId || req.params.outletId;

  if (requestedOutletId && req.user.outlet_id && Number(requestedOutletId) !== Number(req.user.outlet_id)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform operations outside your assigned outlet",
    });
  }

  next();
};

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.authorizeOutlet = authorizeOutlet;