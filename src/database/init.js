const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

const initializeDatabase = async () => {
  try {
    // Ensure critical columns exist on legacy tables before index creation in schema.sql
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'outlet_id') THEN
            ALTER TABLE users ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'outlet_id') THEN
            ALTER TABLE employees ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;
      END $$;
    `);

    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Execute master consolidated schema
    await pool.query(schema);

    // Auto-link missing user_id on employees table
    await pool.query(`
      UPDATE employees e
      SET user_id = u.id
      FROM users u
      WHERE e.user_id IS NULL AND u.id = (
        SELECT u2.id FROM users u2 
        WHERE (LOWER(u2.email) = LOWER(e.email) AND e.email IS NOT NULL AND e.email != '')
           OR (LOWER(u2.username) = LOWER(e.employee_code) AND e.employee_code IS NOT NULL AND e.employee_code != '')
        LIMIT 1
      );
    `);

    // Sync employee role_id with user role_id if they differ
    await pool.query(`
      UPDATE employees e
      SET role_id = u.role_id
      FROM users u
      WHERE e.user_id = u.id AND e.role_id IS DISTINCT FROM u.role_id;
    `);

    // Normalize finance role ID from 480 to 8 and reset roles_id_seq if legacy entry exists
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM roles WHERE name = 'finance' AND id = 480) THEN
          UPDATE users SET role_id = 8 WHERE role_id = 480;
          UPDATE employees SET role_id = 8 WHERE role_id = 480;
          UPDATE roles SET id = 8 WHERE name = 'finance' AND id = 480;
          PERFORM setval('roles_id_seq', (SELECT MAX(id) FROM roles));
        END IF;
      END $$;
    `);

    console.log("✅ Consolidated master database schema initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database schema");
    console.error(error);
    throw error;
  }
};

module.exports = initializeDatabase;