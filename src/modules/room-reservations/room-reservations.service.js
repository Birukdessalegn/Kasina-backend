const pool = require("../../config/database");

/**
 * Generate a unique reservation code: e.g. KAS-2026-X8F2
 */
const generateReservationCode = async () => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `KAS-${year}-${randomSuffix}`;
  
  // Verify uniqueness
  const res = await pool.query("SELECT id FROM room_reservations WHERE reservation_code = $1", [code]);
  if (res.rows.length > 0) {
    return generateReservationCode();
  }
  return code;
};

/**
 * Calculate difference in days between two YYYY-MM-DD strings
 */
const calculateNights = (checkIn, checkOut) => {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
};

/**
 * Check if a room is available for given dates
 */
const isRoomAvailable = async (roomId, checkIn, checkOut, excludeReservationId = null) => {
  let query = `
    SELECT id, reservation_code, guest_name, check_in_date, check_out_date, status
    FROM room_reservations
    WHERE room_id = $1
      AND status IN ('confirmed', 'checked_in')
      AND (
        (check_in_date <= $2 AND check_out_date > $2)
        OR (check_in_date < $3 AND check_out_date >= $3)
        OR (check_in_date >= $2 AND check_out_date <= $3)
      )
  `;
  const params = [roomId, checkIn, checkOut];
  if (excludeReservationId) {
    query += ` AND id != $4`;
    params.push(excludeReservationId);
  }

  const { rows } = await pool.query(query, params);
  return rows.length === 0;
};

/**
 * Get all room reservations with filters
 */
const getAllReservations = async ({ status, search, startDate, endDate, roomId, limit = 50, offset = 0 } = {}) => {
  let query = `
    SELECT 
      rr.*,
      r.room_number,
      r.floor,
      rt.name AS room_type_name,
      u.username AS created_by_username
    FROM room_reservations rr
    JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN users u ON rr.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== "all") {
    params.push(status);
    query += ` AND rr.status = $${params.length}`;
  }

  if (roomId) {
    params.push(roomId);
    query += ` AND rr.room_id = $${params.length}`;
  }

  if (startDate) {
    params.push(startDate);
    query += ` AND rr.check_out_date >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    query += ` AND rr.check_in_date <= $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (
      rr.guest_name ILIKE $${params.length}
      OR rr.guest_phone ILIKE $${params.length}
      OR rr.reservation_code ILIKE $${params.length}
      OR rr.guest_id_number ILIKE $${params.length}
      OR r.room_number ILIKE $${params.length}
    )`;
  }

  query += ` ORDER BY rr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
};

/**
 * Get single reservation by ID including payments
 */
const getReservationById = async (id) => {
  const resQuery = `
    SELECT 
      rr.*,
      r.room_number,
      r.floor,
      rt.name AS room_type_name,
      rt.amenities,
      u.username AS created_by_username
    FROM room_reservations rr
    JOIN rooms r ON rr.room_id = r.id
    JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN users u ON rr.created_by = u.id
    WHERE rr.id = $1
  `;
  const { rows: resRows } = await pool.query(resQuery, [id]);
  if (resRows.length === 0) return null;

  const reservation = resRows[0];

  const payQuery = `
    SELECT 
      rp.*,
      u.username AS received_by_username
    FROM room_payments rp
    LEFT JOIN users u ON rp.received_by = u.id
    WHERE rp.reservation_id = $1
    ORDER BY rp.created_at ASC
  `;
  const { rows: payments } = await pool.query(payQuery, [id]);
  reservation.payments = payments;

  return reservation;
};

/**
 * Create a new reservation or walk-in check-in
 */
const createReservation = async (data, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      guest_name,
      guest_phone,
      guest_email,
      guest_id_number,
      room_id,
      check_in_date,
      check_out_date,
      adults = 1,
      children = 0,
      rate_per_night,
      initial_payment = 0,
      payment_method = "cash",
      transaction_reference,
      special_requests,
      is_walkin = false
    } = data;

    if (!guest_name || !room_id || !check_in_date || !check_out_date) {
      throw new Error("Guest name, room, check-in date, and check-out date are required.");
    }

    // Validate room existence and fetch room type base rate if not provided
    const roomRes = await client.query(
      `SELECT r.*, rt.base_rate FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id WHERE r.id = $1`,
      [room_id]
    );
    if (roomRes.rows.length === 0) {
      throw new Error("Selected room does not exist.");
    }
    const room = roomRes.rows[0];

    // Check date availability
    const available = await isRoomAvailable(room_id, check_in_date, check_out_date);
    if (!available) {
      throw new Error(`Room ${room.room_number} is already booked or occupied for the selected dates.`);
    }

    if (is_walkin && (room.status === "occupied" || room.status === "maintenance")) {
      throw new Error(`Room ${room.room_number} is currently ${room.status} and cannot be checked into.`);
    }

    const pricePerNight = rate_per_night !== undefined && rate_per_night !== null 
      ? Number(rate_per_night) 
      : Number(room.base_rate);
    const nights = calculateNights(check_in_date, check_out_date);
    const totalAmount = pricePerNight * nights;
    const paidAmount = Number(initial_payment) || 0;

    let paymentStatus = "unpaid";
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = "paid";
    } else if (paidAmount > 0) {
      paymentStatus = "partial";
    }

    const status = is_walkin ? "checked_in" : "confirmed";
    const actualCheckIn = is_walkin ? new Date() : null;

    const resCode = await generateReservationCode();

    const insertResQuery = `
      INSERT INTO room_reservations (
        reservation_code, guest_name, guest_phone, guest_email, guest_id_number,
        room_id, check_in_date, check_out_date, actual_check_in_at,
        adults, children, rate_per_night, total_nights, total_amount, paid_amount,
        payment_status, status, special_requests, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
    const { rows: resRows } = await client.query(insertResQuery, [
      resCode,
      guest_name.trim(),
      guest_phone || null,
      guest_email || null,
      guest_id_number || null,
      room_id,
      check_in_date,
      check_out_date,
      actualCheckIn,
      adults,
      children,
      pricePerNight,
      nights,
      totalAmount,
      paidAmount,
      paymentStatus,
      status,
      special_requests || null,
      userId || null
    ]);
    const reservation = resRows[0];

    // If initial payment was made, record it
    if (paidAmount > 0) {
      await client.query(
        `INSERT INTO room_payments (
          reservation_id, amount, payment_method, payment_type, transaction_reference, received_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reservation.id,
          paidAmount,
          payment_method,
          is_walkin ? "payment" : "deposit",
          transaction_reference || null,
          userId || null
        ]
      );
    }

    // Update room status
    if (is_walkin) {
      await client.query("UPDATE rooms SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [room_id]);
    } else {
      // If check-in is today, mark room as reserved
      const todayStr = new Date().toISOString().split("T")[0];
      if (check_in_date === todayStr && room.status === "available") {
        await client.query("UPDATE rooms SET status = 'reserved', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [room_id]);
      }
    }

    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Check-in an existing reservation
 */
const checkInReservation = async (id, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resResult = await client.query("SELECT * FROM room_reservations WHERE id = $1", [id]);
    if (resResult.rows.length === 0) {
      throw new Error("Reservation not found.");
    }
    const reservation = resResult.rows[0];
    if (reservation.status !== "confirmed") {
      throw new Error(`Cannot check in reservation with status '${reservation.status}'.`);
    }

    // Update reservation
    const updatedRes = await client.query(
      `UPDATE room_reservations 
       SET status = 'checked_in', actual_check_in_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );

    // Update room to occupied
    await client.query(
      "UPDATE rooms SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [reservation.room_id]
    );

    await client.query("COMMIT");
    return updatedRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Add a payment to a reservation
 */
const addPayment = async (id, { amount, payment_method, payment_type = "payment", transaction_reference, notes }, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resResult = await client.query("SELECT * FROM room_reservations WHERE id = $1", [id]);
    if (resResult.rows.length === 0) {
      throw new Error("Reservation not found.");
    }
    const reservation = resResult.rows[0];

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error("Payment amount must be greater than 0.");
    }

    await client.query(
      `INSERT INTO room_payments (
        reservation_id, amount, payment_method, payment_type, transaction_reference, notes, received_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        payAmount,
        payment_method,
        payment_type,
        transaction_reference || null,
        notes || null,
        userId || null
      ]
    );

    const newPaidAmount = Number(reservation.paid_amount) + payAmount;
    let paymentStatus = "partial";
    if (newPaidAmount >= Number(reservation.total_amount)) {
      paymentStatus = "paid";
    }

    const updatedRes = await client.query(
      `UPDATE room_reservations
       SET paid_amount = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [newPaidAmount, paymentStatus, id]
    );

    await client.query("COMMIT");
    return updatedRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Check-out a reservation (process final payment if any, set room to cleaning)
 */
const checkOutReservation = async (id, { payment_amount = 0, payment_method = "cash", notes }, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resResult = await client.query("SELECT * FROM room_reservations WHERE id = $1", [id]);
    if (resResult.rows.length === 0) {
      throw new Error("Reservation not found.");
    }
    const reservation = resResult.rows[0];
    if (reservation.status !== "checked_in") {
      throw new Error(`Cannot check out reservation with status '${reservation.status}'.`);
    }

    let currentPaid = Number(reservation.paid_amount);
    const finalPayment = Number(payment_amount) || 0;

    if (finalPayment > 0) {
      await client.query(
        `INSERT INTO room_payments (
          reservation_id, amount, payment_method, payment_type, notes, received_by
        ) VALUES ($1, $2, $3, 'settlement', $4, $5)`,
        [id, finalPayment, payment_method, notes || "Checkout settlement", userId || null]
      );
      currentPaid += finalPayment;
    }

    let paymentStatus = currentPaid >= Number(reservation.total_amount) ? "paid" : "partial";

    // Mark reservation as checked_out
    const updatedRes = await client.query(
      `UPDATE room_reservations 
       SET status = 'checked_out',
           actual_check_out_at = CURRENT_TIMESTAMP,
           paid_amount = $1,
           payment_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [currentPaid, paymentStatus, id]
    );

    // Release room and set status to 'cleaning'
    await client.query(
      "UPDATE rooms SET status = 'cleaning', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [reservation.room_id]
    );

    await client.query("COMMIT");
    return updatedRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancel a reservation
 */
const cancelReservation = async (id, reason, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resResult = await client.query("SELECT * FROM room_reservations WHERE id = $1", [id]);
    if (resResult.rows.length === 0) {
      throw new Error("Reservation not found.");
    }
    const reservation = resResult.rows[0];

    const updatedRes = await client.query(
      `UPDATE room_reservations 
       SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' [Cancelled: ', $1::text, ']'), updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [reason || "Customer cancelled", id]
    );

    // If room is currently 'reserved' for this reservation, free it up
    const roomCheck = await client.query("SELECT status FROM rooms WHERE id = $1", [reservation.room_id]);
    if (roomCheck.rows.length > 0 && roomCheck.rows[0].status === "reserved") {
      await client.query("UPDATE rooms SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [reservation.room_id]);
    }

    await client.query("COMMIT");
    return updatedRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  checkInReservation,
  addPayment,
  checkOutReservation,
  cancelReservation,
  isRoomAvailable
};
