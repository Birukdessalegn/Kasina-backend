const pool = require("../config/database");

const initializeDatabase = async () => {
  try {
    // 1. Verify database connectivity
    await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1;");

    // 2. Safe, idempotent column backfills for existing database tables
    // Wrapped so any single table difference will log a warning without killing the server
    try {
      await pool.query(`
        DO $$
        BEGIN
          -- Ensure essential columns exist in departments
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS code VARCHAR(50);
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id INTEGER;
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS manager_employee_id INTEGER;
            ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT;
            
            -- Backfill default code if null
            UPDATE departments SET code = 'MGMT' WHERE LOWER(name) = 'management' AND code IS NULL;
            UPDATE departments SET code = 'FIN' WHERE LOWER(name) = 'finance' AND code IS NULL;
            UPDATE departments SET code = 'HR' WHERE LOWER(name) = 'human resources' AND code IS NULL;
            UPDATE departments SET code = 'FB' WHERE (LOWER(name) = 'food & beverage' OR LOWER(name) = 'food and beverage') AND code IS NULL;
            UPDATE departments SET code = 'STORE' WHERE LOWER(name) LIKE '%store%' AND code IS NULL;
            UPDATE departments SET code = 'PURCHASING' WHERE LOWER(name) = 'purchasing' AND code IS NULL;
            UPDATE departments SET code = 'KITCHEN' WHERE LOWER(name) = 'kitchen' AND code IS NULL;
            UPDATE departments SET code = 'BAR' WHERE LOWER(name) = 'bar' AND code IS NULL;
            UPDATE departments SET code = 'FRONTDESK' WHERE (LOWER(name) = 'front desk' OR LOWER(name) = 'reception') AND code IS NULL;
            UPDATE departments SET code = 'HOUSEKEEPING' WHERE LOWER(name) = 'housekeeping' AND code IS NULL;
            UPDATE departments SET code = UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 8), '[^a-zA-Z0-9]', '_', 'g')) || '_' || id WHERE code IS NULL;
          END IF;

          -- Ensure essential columns exist in products
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
            ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type VARCHAR(30) DEFAULT 'menu_item';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);
            ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS staff_price NUMERIC(12,2) DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_type VARCHAR(30) DEFAULT 'both';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS preparation_outlet_id INTEGER;
          END IF;

          -- Ensure essential columns exist in outlets
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlets') THEN
            ALTER TABLE outlets ADD COLUMN IF NOT EXISTS code VARCHAR(50);
            ALTER TABLE outlets ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'pos';
            ALTER TABLE outlets ADD COLUMN IF NOT EXISTS department_id INTEGER;
            ALTER TABLE outlets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
          END IF;

          -- Ensure essential columns exist in positions
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'positions') THEN
            ALTER TABLE positions ADD COLUMN IF NOT EXISTS code VARCHAR(50);
            ALTER TABLE positions ADD COLUMN IF NOT EXISTS department_id INTEGER;
            ALTER TABLE positions ADD COLUMN IF NOT EXISTS default_role_id INTEGER;
            ALTER TABLE positions ADD COLUMN IF NOT EXISTS description TEXT;
            UPDATE positions SET title = 'Receptionist' WHERE LOWER(title) LIKE '%receptionist%cashier%' OR code = 'POS_RECEPTIONIST';
          END IF;

          -- Ensure essential columns exist in employees
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id INTEGER;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_id INTEGER;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id INTEGER;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS reports_to_employee_id INTEGER;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(150);
            ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
          END IF;

          -- Ensure essential columns exist in users
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            ALTER TABLE users ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
          END IF;

          -- Ensure essential columns exist in room_reservations
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_reservations') THEN
            ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_url TEXT;
            ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_back_url TEXT;
          END IF;
        END $$;
      `);
      console.log("✅ Database schema verified and legacy table columns synchronized");
    } catch (colErr) {
      console.warn("⚠️ Non-critical schema sync warning (server will continue running):", colErr.message);
    }
  } catch (error) {
    console.error("❌ Failed to verify database schema connectivity");
    console.error(error);
    throw error;
  }
};

module.exports = initializeDatabase;