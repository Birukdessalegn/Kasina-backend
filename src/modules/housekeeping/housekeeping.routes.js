const express = require("express");
const router = express.Router();
const housekeepingController = require("./housekeeping.controller");
const authMiddleware = require("../../middleware/auth.middleware");

router.use(authMiddleware);

router.get("/dashboard", housekeepingController.getDashboard);
router.get("/tasks", housekeepingController.getTasks);
router.post("/tasks", housekeepingController.createTask);
router.put("/tasks/:id/status", housekeepingController.updateTaskStatus);
router.put("/linens/:id", housekeepingController.updateLinenStock);

module.exports = router;
