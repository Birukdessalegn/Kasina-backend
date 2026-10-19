const pool = require("../../config/database");

/**
 * Get comprehensive Housekeeping Dashboard data
 */
const getHousekeepingDashboard = async () => {
  // 1. Room Status Counts
  const roomStatsQuery = `
    SELECT 
      COUNT(*) AS total_rooms,
      COUNT(CASE WHEN status = 'available' THEN 1 END) AS available_count,
      COUNT(CASE WHEN status = 'occupied' THEN 1 END) AS occupied_count,
      COUNT(CASE WHEN status = 'cleaning' THEN 1 END) AS cleaning_count,
      COUNT(CASE WHEN status = 'maintenance' THEN 1 END) AS maintenance_count
    FROM rooms
  `;
  const { rows: [roomStats] } = await pool.query(roomStatsQuery);

  // 2. All Rooms with current active cleaning task (if any)
  const roomsQuery = `
    SELECT 
      r.id,
      r.room_number,
      r.floor,
      r.status,
      r.notes,
      rt.name AS room_type_name,
      ht.id AS active_task_id,
      ht.task_type,
      ht.priority,
      ht.status AS task_status,
      ht.assigned_employee_id,
      e.first_name AS cleaner_first_name,
      e.last_name AS cleaner_last_name
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN LATERAL (
      SELECT * FROM housekeeping_tasks
      WHERE room_id = r.id AND status != 'completed' AND status != 'inspected'
      ORDER BY created_at DESC
      LIMIT 1
    ) ht ON TRUE
    LEFT JOIN employees e ON ht.assigned_employee_id = e.id
    ORDER BY r.floor ASC, r.room_number ASC
  `;
  const { rows: rooms } = await pool.query(roomsQuery);

  // 3. Linen Inventory
  const { rows: linens } = await pool.query(`SELECT * FROM linen_inventory ORDER BY id ASC`);

  // 4. Housekeeping Cleaners list for assignment dropdown (only housekeeping / cleaner staff)
  const { rows: cleaners } = await pool.query(`
    SELECT 
      e.id, 
      e.employee_code, 
      e.first_name, 
      e.last_name, 
      COALESCE(p.title, r.name, 'Cleaner') AS position_title
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN roles r ON e.role_id = r.id
    WHERE e.status = 'active'
      AND (
        LOWER(d.code) = 'housekeeping'
        OR LOWER(d.name) LIKE '%housekeep%'
        OR LOWER(d.name) LIKE '%clean%'
        OR LOWER(p.code) LIKE '%clean%'
        OR LOWER(p.code) LIKE '%housekeep%'
        OR LOWER(p.code) LIKE '%janitor%'
        OR LOWER(p.title) LIKE '%clean%'
        OR LOWER(p.title) LIKE '%housekeep%'
        OR LOWER(p.title) LIKE '%janitor%'
        OR LOWER(r.name) LIKE '%clean%'
        OR LOWER(r.name) LIKE '%housekeep%'
        OR LOWER(r.name) LIKE '%janitor%'
      )
    ORDER BY e.first_name ASC
  `);

  return {
    stats: {
      totalRooms: Number(roomStats?.total_rooms || 0),
      available: Number(roomStats?.available_count || 0),
      occupied: Number(roomStats?.occupied_count || 0),
      cleaning: Number(roomStats?.cleaning_count || 0),
      maintenance: Number(roomStats?.maintenance_count || 0)
    },
    rooms,
    linens,
    cleaners
  };
};

/**
 * Get tasks with filters
 */
const getTasks = async ({ status, roomId, cleanerId } = {}) => {
  let query = `
    SELECT 
      ht.*,
      r.room_number,
      r.floor,
      r.status AS room_status,
      rt.name AS room_type_name,
      e.first_name AS cleaner_first_name,
      e.last_name AS cleaner_last_name,
      e.employee_code AS cleaner_code
    FROM housekeeping_tasks ht
    JOIN rooms r ON ht.room_id = r.id
    JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN employees e ON ht.assigned_employee_id = e.id
    WHERE 1=1
  `;
  const values = [];
  let paramIdx = 1;

  if (status) {
    values.push(status);
    query += ` AND ht.status = $${paramIdx++}`;
  }
  if (roomId) {
    values.push(roomId);
    query += ` AND ht.room_id = $${paramIdx++}`;
  }
  if (cleanerId) {
    values.push(cleanerId);
    query += ` AND ht.assigned_employee_id = $${paramIdx++}`;
  }

  query += ` ORDER BY ht.created_at DESC`;
  const { rows } = await pool.query(query, values);
  return rows;
};

/**
 * Create a new cleaning task
 */
const createTask = async ({ roomId, assignedEmployeeId, taskType = "standard_clean", priority = "normal", notes = "", checklist = [] }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskQuery = `
      INSERT INTO housekeeping_tasks (room_id, assigned_employee_id, task_type, priority, checklist, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows: [newTask] } = await client.query(taskQuery, [
      roomId,
      assignedEmployeeId || null,
      taskType,
      priority,
      JSON.stringify(checklist || []),
      notes
    ]);

    // Automatically transition room status to cleaning
    await client.query(`UPDATE rooms SET status = 'cleaning', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [roomId]);

    await client.query("COMMIT");
    return newTask;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update task status (e.g. in_progress, completed, inspected)
 */
const updateTaskStatus = async (id, { status, notes }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateQuery = `
      UPDATE housekeeping_tasks
      SET 
        status = $1::varchar,
        notes = COALESCE($2::text, notes),
        completed_at = (CASE WHEN $1::varchar IN ('completed', 'inspected') THEN CURRENT_TIMESTAMP ELSE completed_at END)
      WHERE id = $3
      RETURNING *
    `;
    const { rows } = await client.query(updateQuery, [status, notes || null, id]);
    if (rows.length === 0) {
      throw new Error("Task not found");
    }

    const task = rows[0];

    // If task is completed or inspected, mark the room as available (preserving maintenance and occupied)!
    if (status === "completed" || status === "inspected") {
      await client.query(
        `UPDATE rooms SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('maintenance', 'occupied')`,
        [task.room_id]
      );
    } else if (status === "in_progress") {
      await client.query(
        `UPDATE rooms SET status = 'cleaning', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('maintenance', 'occupied')`,
        [task.room_id]
      );
    }

    await client.query("COMMIT");
    return task;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update Linen counts
 */
const updateLinen = async (id, { inUse, inLaundry, cleanAvailable }) => {
  const total = (Number(inUse) || 0) + (Number(inLaundry) || 0) + (Number(cleanAvailable) || 0);
  const query = `
    UPDATE linen_inventory
    SET 
      in_use = COALESCE($1, in_use),
      in_laundry = COALESCE($2, in_laundry),
      clean_available = COALESCE($3, clean_available),
      total_quantity = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;
  const { rows } = await pool.query(query, [inUse, inLaundry, cleanAvailable, total, id]);
  return rows[0];
};


/**
 * Get Housekeeping & Reception Cross-Check Report for a specific date
 */
const getHousekeepingReport = async (date) => {
  const targetDate = date || new Date().toISOString().split("T")[0];

  // 1. All rooms with current reception status + latest housekeeping task on targetDate
  const roomsMatrixQuery = `
    SELECT 
      r.id AS room_id,
      r.room_number,
      r.floor,
      r.status AS reception_status,
      rt.name AS room_type_name,
      rt.base_rate,
      latest_task.id AS task_id,
      latest_task.task_type,
      latest_task.priority,
      latest_task.status AS task_status,
      latest_task.notes AS task_notes,
      latest_task.completed_at,
      latest_task.cleaner_id,
      latest_task.cleaner_name,
      latest_task.cleaner_position
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN LATERAL (
      SELECT 
        ht.id,
        ht.task_type,
        ht.priority,
        ht.status,
        ht.notes,
        ht.completed_at,
        e.id AS cleaner_id,
        CONCAT(e.first_name, ' ', e.last_name) AS cleaner_name,
        p.title AS cleaner_position
      FROM housekeeping_tasks ht
      LEFT JOIN employees e ON ht.assigned_employee_id = e.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE ht.room_id = r.id
        AND (
          (DATE(ht.completed_at) = $1::date AND ht.status IN ('completed', 'inspected'))
          OR (DATE(ht.created_at) = $1::date)
        )
      ORDER BY 
        CASE WHEN ht.status IN ('completed', 'inspected') THEN 1 ELSE 2 END,
        ht.completed_at DESC NULLS LAST, 
        ht.created_at DESC
      LIMIT 1
    ) latest_task ON true
    ORDER BY r.floor ASC, r.room_number ASC
  `;

  const { rows: roomMatrix } = await pool.query(roomsMatrixQuery, [targetDate]);

  // 2. All cleaning tasks completed on this date
  const completedTasksQuery = `
    SELECT 
      ht.id AS task_id,
      ht.room_id,
      r.room_number,
      rt.name AS room_type_name,
      r.floor,
      r.status AS current_room_status,
      ht.task_type,
      ht.priority,
      ht.status AS task_status,
      ht.notes AS task_notes,
      ht.checklist,
      ht.created_at,
      ht.completed_at,
      e.id AS cleaner_id,
      CONCAT(e.first_name, ' ', e.last_name) AS cleaner_name,
      p.title AS cleaner_position
    FROM housekeeping_tasks ht
    JOIN rooms r ON ht.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN employees e ON ht.assigned_employee_id = e.id
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE DATE(ht.completed_at) = $1::date 
      AND ht.status IN ('completed', 'inspected')
    ORDER BY ht.completed_at DESC
  `;
  const { rows: completedTasks } = await pool.query(completedTasksQuery, [targetDate]);

  // 3. Cleaners productivity breakdown for the date
  const cleanerStatsQuery = `
    SELECT 
      e.id AS cleaner_id,
      CONCAT(e.first_name, ' ', e.last_name) AS cleaner_name,
      p.title AS cleaner_position,
      COUNT(ht.id) AS cleaned_count,
      COUNT(DISTINCT ht.room_id) AS distinct_rooms_cleaned
    FROM housekeeping_tasks ht
    JOIN employees e ON ht.assigned_employee_id = e.id
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE DATE(ht.completed_at) = $1::date
      AND ht.status IN ('completed', 'inspected')
    GROUP BY e.id, e.first_name, e.last_name, p.title
    ORDER BY cleaned_count DESC
  `;
  const { rows: cleanerBreakdown } = await pool.query(cleanerStatsQuery, [targetDate]);

  // 4. Room status overall counts (Reception perspective)
  const roomStatsQuery = `
    SELECT 
      COUNT(*) AS total_rooms,
      COUNT(*) FILTER (WHERE status = 'available') AS available_count,
      COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_count,
      COUNT(*) FILTER (WHERE status = 'cleaning') AS cleaning_count,
      COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_count,
      COUNT(*) FILTER (WHERE status = 'reserved') AS reserved_count
    FROM rooms
  `;
  const { rows: [roomStats] } = await pool.query(roomStatsQuery);

  const distinctRoomsCleaned = new Set(completedTasks.map(t => t.room_id)).size;

  return {
    date: targetDate,
    stats: {
      totalRooms: Number(roomStats?.total_rooms || 0),
      cleanedOnDate: distinctRoomsCleaned,
      totalCleanedTasks: completedTasks.length,
      availableReady: Number(roomStats?.available_count || 0),
      occupiedNow: Number(roomStats?.occupied_count || 0),
      cleaningNow: Number(roomStats?.cleaning_count || 0),
      maintenanceNow: Number(roomStats?.maintenance_count || 0),
      reservedNow: Number(roomStats?.reserved_count || 0)
    },
    cleanerBreakdown,
    completedTasks,
    roomMatrix
  };
};

module.exports = {
  getHousekeepingReport,
  getHousekeepingDashboard,
  getTasks,
  createTask,
  updateTaskStatus,
  updateLinen
};
