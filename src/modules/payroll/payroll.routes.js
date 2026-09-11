const express = require("express");
const router = express.Router();
const payrollController = require("./payroll.controller");
const authMiddleware = require("../../middleware/auth.middleware");
const { authorize } = require("../../middleware/role.middleware");

// Require valid authentication
router.use(authMiddleware);

// Restrict payroll viewing and calculation to HR, Finance, and Executive management
router.use(authorize("admin", "hotel_manager", "hr_manager", "accountant_manager", "cooperative_manager"));

router.get("/summary", payrollController.getSummary);
router.post("/runs", payrollController.saveRun);
router.get("/history", payrollController.getHistory);

module.exports = router;
