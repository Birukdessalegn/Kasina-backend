const pool = require("../../config/database");

/**
 * Get all rooms with optional filtering (status, floor, type)
 * Also includes current active reservation details if occupied/reserved
 */
const getAllRooms = async ({ status, floor, typeId } = {}) => {
  let query = `
    SELECT 
      r.id,
      r.room_number,
      r.floor,
      r.status,
      r.notes,
      r.created_at,
      r.updated_at,
      rt.id AS room_type_id,
      rt.name AS type_name,
      rt.base_rate,
      rt.capacity,
      rt.description AS type_description,
      rt.amenities,
      rt.image_url,
      res.id AS current_reservation_id,
      res.reservation_code,
      res.guest_name,
      res.guest_phone,
      res.guest_id_number,
      res.id_image_url,
      res.special_requests,
      res.check_in_date,
      res.check_out_date,
      res.actual_check_in_at,
      res.total_amount,
      res.paid_amount,
      res.payment_status,
      res.status AS reservation_status
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN LATERAL (
      SELECT *
      FROM room_reservations rr
      WHERE rr.room_id = r.id
        AND rr.status IN ('checked_in', 'confirmed')
      ORDER BY 
        CASE WHEN rr.status = 'checked_in' THEN 1 ELSE 2 END,
        rr.check_in_date ASC
      LIMIT 1
    ) res ON TRUE
    WHERE 1=1
  `;

  const values = [];
  let paramIndex = 1;

  if (status && status !== "all") {
    query += ` AND r.status = $${paramIndex++}`;
    values.push(status.toLowerCase());
  }

  if (floor && floor !== "all") {
    query += ` AND r.floor = $${paramIndex++}`;
    values.push(Number(floor));
  }

  if (typeId && typeId !== "all") {
    query += ` AND r.room_type_id = $${paramIndex++}`;
    values.push(Number(typeId));
  }

  query += ` ORDER BY r.floor ASC, r.room_number ASC`;

  const { rows } = await pool.query(query, values);
  return rows;
};

const getRoomById = async (id) => {
  const query = `
    SELECT 
      r.id,
      r.room_number,
      r.floor,
      r.status,
      r.notes,
      r.created_at,
      r.updated_at,
      rt.id AS room_type_id,
      rt.name AS type_name,
      rt.base_rate,
      rt.capacity,
      rt.description AS type_description,
      rt.amenities,
      rt.image_url
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const createRoom = async ({ room_number, room_type_id, floor, notes, status = "available" }) => {
  const existing = await pool.query("SELECT id FROM rooms WHERE LOWER(room_number) = LOWER($1)", [room_number]);
  if (existing.rows.length > 0) {
    throw new Error(`Room number '${room_number}' already exists.`);
  }

  const query = `
    INSERT INTO rooms (room_number, room_type_id, floor, status, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    room_number.trim(),
    room_type_id,
    floor || 1,
    status,
    notes || null
  ]);
  return rows[0];
};

const updateRoom = async (id, { room_number, room_type_id, floor, status, notes }) => {
  if (room_number) {
    const existing = await pool.query(
      "SELECT id FROM rooms WHERE LOWER(room_number) = LOWER($1) AND id != $2",
      [room_number, id]
    );
    if (existing.rows.length > 0) {
      throw new Error(`Room number '${room_number}' is already taken.`);
    }
  }

  const query = `
    UPDATE rooms
    SET 
      room_number = COALESCE($1, room_number),
      room_type_id = COALESCE($2, room_type_id),
      floor = COALESCE($3, floor),
      status = COALESCE($4, status),
      notes = COALESCE($5, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    room_number ? room_number.trim() : null,
    room_type_id || null,
    floor || null,
    status || null,
    notes !== undefined ? notes : null,
    id
  ]);
  return rows[0];
};

const updateRoomStatus = async (id, status, notes) => {
  const validStatuses = ["available", "occupied", "reserved", "cleaning", "maintenance"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid room status: ${status}. Must be one of ${validStatuses.join(", ")}`);
  }

  const query = `
    UPDATE rooms
    SET 
      status = $1,
      notes = COALESCE($2, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  const { rows } = await pool.query(query, [status, notes || null, id]);
  return rows[0];
};

const deleteRoom = async (id) => {
  // Check if room has active reservations
  const activeRes = await pool.query(
    "SELECT id FROM room_reservations WHERE room_id = $1 AND status IN ('confirmed', 'checked_in') LIMIT 1",
    [id]
  );
  if (activeRes.rows.length > 0) {
    throw new Error("Cannot delete room with active or upcoming reservations.");
  }

  const result = await pool.query("DELETE FROM rooms WHERE id = $1 RETURNING id", [id]);
  return result.rowCount > 0;
};

// =================== ROOM TYPES ===================

const getAllRoomTypes = async () => {
  const query = `
    SELECT 
      rt.*,
      COUNT(r.id)::int AS total_rooms,
      COUNT(r.id) FILTER (WHERE r.status = 'available')::int AS available_rooms
    FROM room_types rt
    LEFT JOIN rooms r ON rt.id = r.room_type_id
    GROUP BY rt.id
    ORDER BY rt.base_rate ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

const getRoomTypeById = async (id) => {
  const query = `SELECT * FROM room_types WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const createRoomType = async ({ name, base_rate, capacity, description, amenities, image_url }) => {
  const query = `
    INSERT INTO room_types (name, base_rate, capacity, description, amenities, image_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    name.trim(),
    base_rate,
    capacity || 2,
    description || null,
    JSON.stringify(amenities || []),
    image_url || null
  ]);
  return rows[0];
};

const updateRoomType = async (id, { name, base_rate, capacity, description, amenities, image_url }) => {
  const query = `
    UPDATE room_types
    SET 
      name = COALESCE($1, name),
      base_rate = COALESCE($2, base_rate),
      capacity = COALESCE($3, capacity),
      description = COALESCE($4, description),
      amenities = COALESCE($5, amenities),
      image_url = COALESCE($6, image_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    name ? name.trim() : null,
    base_rate || null,
    capacity || null,
    description !== undefined ? description : null,
    amenities ? JSON.stringify(amenities) : null,
    image_url !== undefined ? image_url : null,
    id
  ]);
  return rows[0];
};

const deleteRoomType = async (id) => {
  const roomsCount = await pool.query("SELECT COUNT(*) FROM rooms WHERE room_type_id = $1", [id]);
  if (parseInt(roomsCount.rows[0].count, 10) > 0) {
    throw new Error("Cannot delete room type that has associated rooms.");
  }
  const result = await pool.query("DELETE FROM room_types WHERE id = $1 RETURNING id", [id]);
  return result.rowCount > 0;
};

const getRoomStats = async () => {
  const query = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'available')::int AS available,
      COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied,
      COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
      COUNT(*) FILTER (WHERE status = 'cleaning')::int AS cleaning,
      COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance
    FROM rooms
  `;
  const { rows } = await pool.query(query);
  const stats = rows[0] || { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
  return { ...stats, occupancyRate };
};

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  getAllRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  getRoomStats
};
