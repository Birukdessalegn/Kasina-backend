const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const { uploadIdImage, uploadIdImages } = require("../../middleware/upload.middleware");
const {
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
} = require("./room-reservations.controller");

router.use(authenticate);
router.use(
  authorize(
    "admin",
    "hotel_manager",
    "manager",
    "cooperative_manager",
    "accountant_manager",
    "finance",
    "accountant",
    "receptionist"
  )
);

router.get("/", getReservations);
router.get("/reports/summary", getReports);
router.get("/:id", getReservation);
router.post("/upload-id", uploadIdImages, uploadStandaloneGuestId);
router.post("/", createReservation);
router.put("/:id", updateReservation);
router.post("/:id/upload-id", uploadIdImages, uploadGuestIdImage);
router.post("/:id/check-in", checkIn);
router.post("/:id/check-out", checkOut);
router.post("/:id/payments", addPayment);
router.post("/:id/cancel", cancelReservation);

module.exports = router;
