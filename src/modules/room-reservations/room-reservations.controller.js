const reservationsService = require("./room-reservations.service");
const path = require("path");
const fs = require("fs");

const saveBase64Image = (base64Str) => {
  if (!base64Str || typeof base64Str !== "string" || !base64Str.startsWith("data:image/")) {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return base64Str;
    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const dataBuffer = Buffer.from(matches[2], "base64");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `guest-id-${uniqueSuffix}.${ext}`;
    const uploadDir = path.join(__dirname, "../../../uploads/guest-ids");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, filename), dataBuffer);
    return `/uploads/guest-ids/${filename}`;
  } catch (err) {
    console.error("Error saving base64 ID image:", err);
    return base64Str;
  }
};

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
    const payload = { ...req.body };
    if (!payload.id_image_url && payload.id_image_preview) {
      payload.id_image_url = payload.id_image_preview;
    }
    if (payload.id_image_url && payload.id_image_url.startsWith("data:image/")) {
      payload.id_image_url = saveBase64Image(payload.id_image_url);
    }
    delete payload.id_image_preview;
    delete payload.id_image_file;

    const reservation = await reservationsService.createReservation(payload, userId);
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

const updateReservation = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const payload = { ...req.body };
    if (!payload.id_image_url && payload.id_image_preview) {
      payload.id_image_url = payload.id_image_preview;
    }
    if (payload.id_image_url && payload.id_image_url.startsWith("data:image/")) {
      payload.id_image_url = saveBase64Image(payload.id_image_url);
    }
    delete payload.id_image_preview;
    delete payload.id_image_file;

    const updated = await reservationsService.updateReservation(req.params.id, payload, userId);
    res.json({ success: true, data: updated, message: "Reservation updated successfully" });
  } catch (error) {
    console.error("Error updating reservation:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const uploadGuestIdImage = async (req, res) => {
  try {
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/guest-ids/${req.file.filename}`;
    } else if (req.body.id_image_base64 || req.body.id_image_preview || req.body.id_image_url) {
      imageUrl = saveBase64Image(req.body.id_image_base64 || req.body.id_image_preview || req.body.id_image_url);
    }
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: "No image file or data provided." });
    }
    const updated = await reservationsService.updateGuestIdImage(req.params.id, imageUrl);
    res.json({
      success: true,
      data: updated,
      imageUrl,
      message: "Guest ID image uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading guest ID image:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const uploadStandaloneGuestId = async (req, res) => {
  try {
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/guest-ids/${req.file.filename}`;
    } else if (req.body.id_image_base64 || req.body.id_image_preview || req.body.id_image_url) {
      imageUrl = saveBase64Image(req.body.id_image_base64 || req.body.id_image_preview || req.body.id_image_url);
    }
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: "No image file or data provided." });
    }
    res.json({
      success: true,
      imageUrl,
      message: "Guest ID image uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading guest ID image:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const reports = await reservationsService.getReservationReports({ startDate, endDate });
    res.json({ success: true, data: reports });
  } catch (error) {
    console.error("Error generating reservation reports:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getReservations,
  getReservation,
  createReservation,
  updateReservation,
  uploadGuestIdImage,
  uploadStandaloneGuestId,
  checkIn,
  checkOut,
  addPayment,
  cancelReservation,
  getReports,
};
