const reservationsService = require("./room-reservations.service");

const getReservations = async (req, res) => {
  try {
    const { status, search, startDate, endDate, roomId, limit, offset } = req.query;
    const data = await reservationsService.getAllReservations({
      status,
      search,
      startDate,
      endDate,
      roomId,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReservation = async (req, res) => {
  try {
    const reservation = await reservationsService.getReservationById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found" });
    }
    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error("Error fetching reservation:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createReservation = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const reservation = await reservationsService.createReservation(req.body, userId);
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    console.error("Error creating reservation:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const checkIn = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const updated = await reservationsService.checkInReservation(req.params.id, userId);
    res.json({ success: true, data: updated, message: "Guest checked in successfully" });
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const checkOut = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { payment_amount, payment_method, notes } = req.body;
    const updated = await reservationsService.checkOutReservation(
      req.params.id,
      { payment_amount, payment_method, notes },
      userId
    );
    res.json({ success: true, data: updated, message: "Guest checked out successfully" });
  } catch (error) {
    console.error("Error checking out:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addPayment = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { amount, payment_method, payment_type, transaction_reference, notes } = req.body;
    const updated = await reservationsService.addPayment(
      req.params.id,
      { amount, payment_method, payment_type, transaction_reference, notes },
      userId
    );
    res.json({ success: true, data: updated, message: "Payment added successfully" });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { reason } = req.body;
    const updated = await reservationsService.cancelReservation(req.params.id, reason, userId);
    res.json({ success: true, data: updated, message: "Reservation cancelled" });
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getReservations,
  getReservation,
  createReservation,
  checkIn,
  checkOut,
  addPayment,
  cancelReservation,
};
