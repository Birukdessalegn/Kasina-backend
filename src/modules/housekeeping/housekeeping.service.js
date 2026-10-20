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
 * Get Housekeeping & Reception Cross-Check Report with flexible date range & last cleaning history
 */
const getHousekeepingReport = async (filter = {}) => {
  let dateParam = typeof filter === "string" ? filter : filter.date;
  let startDate = filter.startDate || (dateParam !== "all" ? dateParam : null);
  let endDate = filter.endDate || (dateParam !== "all" ? dateParam : null);

  const isAllDates = dateParam === "all";

  if (!isAllDates && !startDate && !endDate) {
    const today = new Date().toISOString().split("T")[0];
    startDate = today;
    endDate = today;
  }

  // Conditions for completed tasks in the period
  let periodWhereClause = "WHERE ht.status IN ('completed', 'inspected')";
  let periodParams = [];

  if (!isAllDates && startDate && endDate) {
    periodWhereClause += " AND DATE(COALESCE(ht.completed_at, ht.created_at)) BETWEEN $1::date AND $2::date";
    periodParams = [startDate, endDate];
  }

  // Lateral condition for period task in matrix
  let periodLateralCondition = "";
  let matrixParams = [];

  if (!isAllDates && startDate && endDate) {
    periodLateralCondition = "AND DATE(COALESCE(p_ht.completed_at, p_ht.created_at)) BETWEEN $1::date AND $2::date";
    matrixParams = [startDate, endDate];
  }

  const roomsMatrixQuery = `
    SELECT 
      r.id AS room_id,
      r.room_number,
      r.floor,
      r.status AS reception_status,
      rt.name AS room_type_name,
      rt.base_rate,
      
      -- Period cleaning task (if cleaned in selected date/range)
      period_task.id AS period_task_id,
      period_task.task_type AS period_task_type,
      period_task.priority AS period_priority,
      period_task.status AS period_task_status,
      period_task.notes AS period_task_notes,
      period_task.completed_at AS period_completed_at,
      period_task.cleaner_id AS period_cleaner_id,
      period_task.cleaner_name AS period_cleaner_name,
      period_task.cleaner_position AS period_cleaner_position,

      -- Latest cleaning ever recorded on this room
      last_clean.id AS last_task_id,
      last_clean.task_type AS last_task_type,
      last_clean.status AS last_task_status,
      last_clean.completed_at AS last_completed_at,
      last_clean.cleaner_name AS last_cleaner_name,
      last_clean.cleaner_position AS last_cleaner_position

    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id

    -- Lateral join for period task
    LEFT JOIN LATERAL (
      SELECT 
        p_ht.id,
        p_ht.task_type,
        p_ht.priority,
        p_ht.status,
        p_ht.notes,
        p_ht.completed_at,
        p_emp.id AS cleaner_id,
        CONCAT(p_emp.first_name, ' ', p_emp.last_name) AS cleaner_name,
        p_pos.title AS cleaner_position
      FROM housekeeping_tasks p_ht
      LEFT JOIN employees p_emp ON p_ht.assigned_employee_id = p_emp.id
      LEFT JOIN positions p_pos ON p_emp.position_id = p_pos.id
      WHERE p_ht.room_id = r.id
        AND p_ht.status IN ('completed', 'inspected')
        ${periodLateralCondition}
      ORDER BY p_ht.completed_at DESC NULLS LAST, p_ht.created_at DESC
      LIMIT 1
    ) period_task ON true

    -- Lateral join for most recent cleaning ever
    LEFT JOIN LATERAL (
      SELECT 
        l_ht.id,
        l_ht.task_type,
        l_ht.status,
        l_ht.completed_at,
        CONCAT(l_emp.first_name, ' ', l_emp.last_name) AS cleaner_name,
        l_pos.title AS cleaner_position
      FROM housekeeping_tasks l_ht
      LEFT JOIN employees l_emp ON l_ht.assigned_employee_id = l_emp.id
      LEFT JOIN positions l_pos ON l_emp.position_id = l_pos.id
      WHERE l_ht.room_id = r.id
        AND l_ht.status IN ('completed', 'inspected')
      ORDER BY l_ht.completed_at DESC NULLS LAST, l_ht.created_at DESC
      LIMIT 1
    ) last_clean ON true

    ORDER BY r.floor ASC, r.room_number ASC
  `;

  const { rows: roomMatrix } = await pool.query(roomsMatrixQuery, matrixParams);

  // 2. All completed cleaning tasks in selected period
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
    ${periodWhereClause}
    ORDER BY ht.completed_at DESC NULLS LAST, ht.created_at DESC
  `;
  const { rows: completedTasks } = await pool.query(completedTasksQuery, periodParams);

  // 3. Cleaners productivity breakdown for the period
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
    ${periodWhereClause}
    GROUP BY e.id, e.first_name, e.last_name, p.title
    ORDER BY cleaned_count DESC
  `;
  const { rows: cleanerBreakdown } = await pool.query(cleanerStatsQuery, periodParams);

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
    period: {
      startDate: isAllDates ? "All" : startDate,
      endDate: isAllDates ? "All" : endDate,
      isAllDates
    },
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
