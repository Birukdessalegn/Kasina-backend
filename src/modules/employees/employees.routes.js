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

// Only Admin, HR or Hotel Manager can create, edit, delete, or manage accounts
router.post("/", authorize("admin", "hr", "hotel_manager"), employeesController.createEmployee);
router.put("/:id", authorize("admin", "hr", "hotel_manager"), employeesController.updateEmployee);
router.delete("/:id", authorize("admin", "hr", "hotel_manager"), employeesController.deleteEmployee);
router.put("/:id/activate", authorize("admin", "hr", "hotel_manager"), employeesController.activateEmployee);
router.delete("/:id/login-account", authorize("admin", "hr", "hotel_manager"), employeesController.deleteEmployeeAccount);

module.exports = router;