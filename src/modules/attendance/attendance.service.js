const pool = require("../../config/database");

// Get attendance records with filtering & pagination
const getAllAttendance = async (filters = {}) => {
  const { startDate, endDate, employeeId, page = 1, limit = 50 } = filters;

  let query = `
    SELECT
      a.id,
      a.employee_id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.phone,
      d.name AS department,
      r.name AS role,
      e.shift_start_time,
      e.shift_end_time,
      e.work_hours,
      a.attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.notes,
      a.recorded_by,
      ROUND((EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600.0)::numeric, 2) AS total_hours,
      a.created_at,
      a.updated_at
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN roles r ON e.role_id = r.id
    WHERE 1=1
  `;
  const queryParams = [];

  if (startDate) {
    queryParams.push(startDate);
    query += ` AND a.attendance_date >= $${queryParams.length}`;
  }
  if (endDate) {
    queryParams.push(endDate);
    query += ` AND a.attendance_date <= $${queryParams.length}`;
  }
  if (employeeId) {
    queryParams.push(employeeId);
    query += ` AND a.employee_id = $${queryParams.length}`;
  }

  query += ` ORDER BY a.attendance_date DESC, a.check_in DESC`;

  if (limit) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    queryParams.push(limitNum);
    query += ` LIMIT $${queryParams.length}`;
    queryParams.push(offset);
    query += ` OFFSET $${queryParams.length}`;
  }

  const result = await pool.query(query, queryParams);
  return result.rows;
};

// Get attendance by employee
const getEmployeeAttendance = async (employeeId) => {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.employee_id,
      e.employee_code,
      e.first_name,
      e.last_name,
      a.attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.notes,
      ROUND((EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600.0)::numeric, 2) AS total_hours
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.employee_id = $1
    ORDER BY a.attendance_date DESC
    `,
    [employeeId]
  );

  return result.rows;
};

// Get current shift attendance (today or overnight shift starting yesterday)
const getTodayAttendance = async () => {
  const result = await pool.query(`
    SELECT
      a.id,
      a.employee_id,
      e.employee_code,
      e.first_name,
      e.last_name,
      d.name AS department,
      r.name AS role,
      e.shift_start_time,
      e.shift_end_time,
      e.work_hours,
      a.attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.notes,
      CASE
        WHEN a.check_out IS NOT NULL AND a.check_in IS NOT NULL THEN
          ROUND((EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600.0)::numeric, 2)
        ELSE 0
      END AS total_hours
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN roles r ON e.role_id = r.id
    WHERE (
      a.attendance_date = CURRENT_DATE
      OR (a.attendance_date = (CURRENT_DATE - INTERVAL '1 day')::date AND (a.check_out IS NULL OR a.check_in >= NOW() - INTERVAL '18 hours'))
    )
    ORDER BY a.check_in ASC
  `);

  return result.rows;
};

// Check in employee with club night shift & grace period rules:
// - Shift start: 6:00 PM (18:00)
// - Early check-in starts: 5:50 PM (17:50)
// - Grace period until: 6:20 PM (18:20) -> 'present'
// - After 6:20 PM (18:20) up to 7:00 AM -> 'late'
// - Shift date between 00:00 and 07:00 AM -> assigned to yesterday's date
const checkIn = async (employeeId, notes = null) => {
  // 1. Fetch employee's assigned shift working hours
  const empRes = await pool.query(
    "SELECT id, shift_start_time, shift_end_time, work_hours FROM employees WHERE id = $1",
    [employeeId]
  );

  if (empRes.rows.length === 0) {
    throw new Error("Employee not found");
  }

  const emp = empRes.rows[0];
  const shiftStartStr = emp.shift_start_time || "18:00:00";
  const shiftEndStr = emp.shift_end_time || "07:00:00";

  // Parse shift times (HH:MM)
  const [startH, startM] = shiftStartStr.split(":").map(Number);
  const [endH, endM] = shiftEndStr.split(":").map(Number);

  const isOvernight = (startH > endH) || (startH === endH && startM > endM);

  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  const currentTotalMins = currentH * 60 + currentM;
  const shiftStartMins = startH * 60 + startM;
  const gracePeriodMins = 20; // 20-minute punctuality grace period

  let attendanceDateStr;
  let status = "present";

  if (isOvernight) {
    // Overnight shift (e.g. 18:00 to 07:00)
    const shiftEndMins = endH * 60 + endM;
    if (currentTotalMins <= shiftEndMins) {
      // Checked in past midnight between 00:00 and shift end (assigned to shift starting yesterday)
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      attendanceDateStr = yesterday.toISOString().slice(0, 10);
      status = "late";
    } else {
      // Checked in before midnight
      attendanceDateStr = now.toISOString().slice(0, 10);
      if (currentTotalMins > shiftStartMins + gracePeriodMins) {
        status = "late";
      } else {
        status = "present";
      }
    }
  } else {
    // Daytime shift (e.g. 07:00 to 18:00, 08:00 to 17:00)
    attendanceDateStr = now.toISOString().slice(0, 10);
    if (currentTotalMins > shiftStartMins + gracePeriodMins) {
      status = "late";
    } else {
      status = "present";
    }
  }

  const result = await pool.query(
    `
    INSERT INTO attendance (
      employee_id,
      attendance_date,
      check_in,
      status,
      notes
    )
    VALUES ($1, $2, CURRENT_TIMESTAMP, $3::attendance_status, $4)
    ON CONFLICT (employee_id, attendance_date)
    DO UPDATE SET
      check_in = COALESCE(attendance.check_in, CURRENT_TIMESTAMP),
      check_out = NULL,
      status = EXCLUDED.status,
      notes = COALESCE(EXCLUDED.notes, attendance.notes),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [employeeId, attendanceDateStr, status, notes]
  );

  return result.rows[0];
};

// Check out employee from their latest active check-in (open session)
const checkOut = async (employeeId) => {
  const result = await pool.query(
    `
    UPDATE attendance
    SET
      check_out = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM attendance
      WHERE employee_id = $1 AND check_out IS NULL
      ORDER BY check_in DESC
      LIMIT 1
    )
    RETURNING *,
      ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in))/3600.0)::numeric, 2) AS total_hours
    `,
    [employeeId]
  );

  return result.rows[0];
};

// Create attendance manually
const createAttendance = async (data) => {
  const {
    employeeId,
    attendanceDate,
    checkIn,
    checkOut,
    status,
    notes,
    recordedBy,
  } = data;

  const result = await pool.query(
    `
    INSERT INTO attendance (
      employee_id,
      attendance_date,
      check_in,
      check_out,
      status,
      notes,
      recorded_by
    )
    VALUES ($1, $2, $3, $4, $5::attendance_status, $6, $7)
    RETURNING *
    `,
    [
      employeeId,
      attendanceDate,
      checkIn || null,
      checkOut || null,
      status || "present",
      notes || null,
      recordedBy || null,
    ]
  );

  return result.rows[0];
};

module.exports = {
  getAllAttendance,
  getEmployeeAttendance,
  getTodayAttendance,
  checkIn,
  checkOut,
  createAttendance,
};