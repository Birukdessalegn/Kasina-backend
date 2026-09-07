const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  getStats,
} = require("./rooms.controller");

// Public/Auth routes for all staff that need room info
router.use(authenticate);

// Statistics
router.get("/stats", getStats);

// Room Types
router.get("/types", getRoomTypes);
router.post("/types", authorize("admin", "manager", "receptionist"), createRoomType);
router.put("/types/:id", authorize("admin", "manager", "receptionist"), updateRoomType);
router.delete("/types/:id", authorize("admin", "manager"), deleteRoomType);

// Rooms
router.get("/", getRooms);
router.get("/:id", getRoom);
router.post("/", authorize("admin", "manager", "receptionist"), createRoom);
router.put("/:id", authorize("admin", "manager", "receptionist"), updateRoom);
router.patch("/:id/status", authorize("admin", "manager", "receptionist"), updateRoomStatus);
router.delete("/:id", authorize("admin", "manager"), deleteRoom);

module.exports = router;
