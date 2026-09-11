const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");

const registerUser = async ({
  username,
  email,
  password,
  roleId,
}) => {
  // Check if username already exists
  const existingUser = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [username]
  );

  if (existingUser.rows.length > 0) {
    throw new Error("Username already exists");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await pool.query(
    `INSERT INTO users
      (username, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role_id, status, created_at`,
    [username, email || null, passwordHash, roleId || null]
  );

  return result.rows[0];
};

const loginUser = async (username, password) => {
  const result = await pool.query(
    `SELECT
      u.id,
      u.username,
      u.email,
      u.password_hash,
      u.role_id,
      u.status,
      u.outlet_id AS user_outlet_id,
      r.name AS role,
      e.id AS employee_id,
      e.employee_code,
      e.first_name,
      e.last_name,
      e.status AS employee_status,
      e.department_id,
      d.name AS department_name,
      d.code AS department_code,
      COALESCE(e.outlet_id, u.outlet_id) AS outlet_id,
      o.name AS outlet_name,
      o.code AS outlet_code,
      o.type AS outlet_type,
      e.position_id,
      pos.title AS position_title,
      e.reports_to_employee_id,
      CONCAT(sup.first_name, ' ', sup.last_name) AS reports_to_name
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN outlets o ON o.id = COALESCE(e.outlet_id, u.outlet_id)
     LEFT JOIN positions pos ON e.position_id = pos.id
     LEFT JOIN employees sup ON e.reports_to_employee_id = sup.id
     WHERE LOWER(TRIM(u.username)) = LOWER(TRIM($1))`,
    [username]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid username or password");
  }

  const user = result.rows[0];

  // Check account status and linked employee status
  if (user.status !== "active" || (user.employee_status && user.employee_status !== "active")) {
    throw new Error("Your account has been deactivated. Please contact management.");
  }

  // Compare password
  const passwordMatch = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatch) {
    throw new Error("Invalid username or password");
  }

  // Enforce attendance check-in for Waiters, Baristas and Bartenders
  const roleName = user.role?.toLowerCase();
  const shiftAttendanceRoles = ["waiter", "cafe_waiter", "bartender", "barista"];
  if (shiftAttendanceRoles.includes(roleName)) {
    const employeeId = user.employee_id;

    if (!employeeId) {
      throw new Error(
        "No employee record associated with this account. Please contact management."
      );
    }

    // Check if there is an active check-in record for current shift
    const attendanceCheck = await pool.query(
      `
      SELECT id FROM attendance
      WHERE employee_id = $1
        AND attendance_date = (
          CASE
            WHEN EXTRACT(HOUR FROM CURRENT_TIME) < 7 THEN CURRENT_DATE - 1
            ELSE CURRENT_DATE
          END
        )
        AND check_in IS NOT NULL
      `,
      [employeeId]
    );

    if (attendanceCheck.rows.length === 0) {
      throw new Error(
        "Attendance check-in required before logging in. Please ask HR or Management to check you in first."
      );
    }
  }

  // Create JWT with organizational scope
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      roleId: user.role_id,
      role: user.role,
      employeeId: user.employee_id,
      outletId: user.outlet_id,
      outletCode: user.outlet_code,
      departmentId: user.department_id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  // Update last login
  await pool.query(
    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
    [user.id]
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roleId: user.role_id,
      role: user.role,
      employeeId: user.employee_id,
      employeeCode: user.employee_code,
      firstName: user.first_name,
      lastName: user.last_name,
      departmentId: user.department_id,
      departmentName: user.department_name,
      departmentCode: user.department_code,
      outletId: user.outlet_id,
      outletName: user.outlet_name,
      outletCode: user.outlet_code,
      outletType: user.outlet_type,
      positionId: user.position_id,
      positionTitle: user.position_title,
      reportsToEmployeeId: user.reports_to_employee_id,
      reportsToName: user.reports_to_name,
    },
  };
};

module.exports = {
  registerUser,
  loginUser,
};