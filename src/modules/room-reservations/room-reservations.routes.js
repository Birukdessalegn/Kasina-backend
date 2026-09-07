const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const {
  getReservations,
  getReservation,
  createReservation,
  checkIn,
  checkOut,
  addPayment,
  cancelReservation,
} = require("./room-reservations.controller");

router.use(authenticate);
router.use(authorize("admin", "manager", "receptionist"));

router.get("/", getReservations);
router.get("/:id", getReservation);
router.post("/", createReservation);
router.post("/:id/check-in", checkIn);
router.post("/:id/check-out", checkOut);
router.post("/:id/payments", addPayment);
router.post("/:id/cancel", cancelReservation);

module.exports = router;
