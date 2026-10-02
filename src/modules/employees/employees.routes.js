const express = require("express");
const router = express.Router();
const employeesController = require("./employees.controller");
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");

// Require authentication for employee routes
router.use(authenticate);

// Specific lookup routes (before /:id)
router.get("/hierarchy", employeesController.getHierarchy);
router.get("/outlets", employeesController.getOutlets);
router.get("/positions", employeesController.getPositions);
router.get("/roles", employeesController.getRoles);
router.get("/departments", employeesController.getDepartments);

router.get("/", employeesController.getEmployees);
router.get("/:id", employeesController.getEmployee);

// Admin, HR, Hotel Manager, General Manager, or Cooperative Manager can manage employees
const allowedManagers = ["admin", "hr", "hr_manager", "hotel_manager", "manager", "cooperative_manager"];
router.post("/", authorize(...allowedManagers), employeesController.createEmployee);
router.put("/:id", authorize(...allowedManagers), employeesController.updateEmployee);
router.delete("/:id", authorize(...allowedManagers), employeesController.deleteEmployee);
router.put("/:id/activate", authorize(...allowedManagers), employeesController.activateEmployee);
router.delete("/:id/login-account", authorize(...allowedManagers), employeesController.deleteEmployeeAccount);

module.exports = router;