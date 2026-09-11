const housekeepingService = require("./housekeeping.service");

const getDashboard = async (req, res) => {
  try {
    const data = await housekeepingService.getHousekeepingDashboard();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Housekeeping dashboard error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTasks = async (req, res) => {
  try {
    const tasks = await housekeepingService.getTasks(req.query);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("Get housekeeping tasks error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { roomId, assignedEmployeeId, taskType, priority, notes, checklist } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, message: "Room ID is required" });
    }
    const task = await housekeepingService.createTask({
      roomId,
      assignedEmployeeId,
      taskType,
      priority,
      notes,
      checklist
    });
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error("Create housekeeping task error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }
    const updated = await housekeepingService.updateTaskStatus(req.params.id, { status, notes });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update task status error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateLinenStock = async (req, res) => {
  try {
    const { inUse, inLaundry, cleanAvailable } = req.body;
    const updated = await housekeepingService.updateLinen(req.params.id, { inUse, inLaundry, cleanAvailable });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update linen stock error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboard,
  getTasks,
  createTask,
  updateTaskStatus,
  updateLinenStock
};
