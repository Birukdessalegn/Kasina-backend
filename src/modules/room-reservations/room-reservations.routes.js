const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const { uploadIdImage } = require("../../middleware/upload.middleware");
const {
  getReservations,
  getReservation,
  createReservation,
  updateReservation,
  uploadGuestIdImage,
  checkIn,
  checkOut,
  addPayment,
  cancelReservation,
  getReports,
} = require("./room-reservations.controller");

router.use(authenticate);
router.use(authorize("admin", "manager", "receptionist"));

router.get("/", getReservations);
router.get("/reports/summary", getReports);
router.get("/:id", getReservation);
router.post("/", createReservation);
router.put("/:id", updateReservation);
router.post("/:id/upload-id", uploadIdImage.single("id_image"), uploadGuestIdImage);
router.post("/:id/check-in", checkIn);
router.post("/:id/check-out", checkOut);
router.post("/:id/payments", addPayment);
router.post("/:id/cancel", cancelReservation);

module.exports = router;
