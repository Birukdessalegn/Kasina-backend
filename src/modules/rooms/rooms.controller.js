const roomsService = require("./rooms.service");

const getRooms = async (req, res) => {
  try {
    const { status, floor, typeId } = req.query;
    const rooms = await roomsService.getAllRooms({ status, floor, typeId });
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRoom = async (req, res) => {
  try {
    const room = await roomsService.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const newRoom = await roomsService.createRoom(req.body);
    res.status(201).json({ success: true, data: newRoom });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const updated = await roomsService.updateRoom(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating room:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateRoomStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updated = await roomsService.updateRoomStatus(req.params.id, status, notes);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating room status:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    await roomsService.deleteRoom(req.params.id);
    res.json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getRoomTypes = async (req, res) => {
  try {
    const types = await roomsService.getAllRoomTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error("Error fetching room types:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createRoomType = async (req, res) => {
  try {
    const newType = await roomsService.createRoomType(req.body);
    res.status(201).json({ success: true, data: newType });
  } catch (error) {
    console.error("Error creating room type:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateRoomType = async (req, res) => {
  try {
    const updated = await roomsService.updateRoomType(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating room type:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteRoomType = async (req, res) => {
  try {
    await roomsService.deleteRoomType(req.params.id);
    res.json({ success: true, message: "Room type deleted successfully" });
  } catch (error) {
    console.error("Error deleting room type:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await roomsService.getRoomStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching room stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
