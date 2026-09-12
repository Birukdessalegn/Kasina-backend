const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

const initializeDatabase = async () => {
  try {
    // Ensure critical columns exist on legacy tables before index creation in schema.sql
    await pool.query(`
      DO $$
      BEGIN
        -- USERS table columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'outlet_id') THEN
            ALTER TABLE users ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;

        -- EMPLOYEES table columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'outlet_id') THEN
            ALTER TABLE employees ADD COLUMN outlet_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'position_id') THEN
            ALTER TABLE employees ADD COLUMN position_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'reports_to_employee_id') THEN
            ALTER TABLE employees ADD COLUMN reports_to_employee_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'user_id') THEN
            ALTER TABLE employees ADD COLUMN user_id UUID UNIQUE;
          END IF;
        END IF;

        -- PRODUCTS table columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'item_type') THEN
            ALTER TABLE products ADD COLUMN item_type VARCHAR(30) DEFAULT 'menu_item';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'preparation_outlet_id') THEN
            ALTER TABLE products ADD COLUMN preparation_outlet_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'shots_capacity') THEN
            ALTER TABLE products ADD COLUMN shots_capacity NUMERIC(10,2) DEFAULT 30;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_shot_item') THEN
            ALTER TABLE products ADD COLUMN is_shot_item BOOLEAN DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'menu_type') THEN
            ALTER TABLE products ADD COLUMN menu_type VARCHAR(30) DEFAULT 'both';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'parent_product_id') THEN
            ALTER TABLE products ADD COLUMN parent_product_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'portion_ratio') THEN
            ALTER TABLE products ADD COLUMN portion_ratio NUMERIC(10,4) DEFAULT 1.0000;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'serving_size') THEN
            ALTER TABLE products ADD COLUMN serving_size VARCHAR(50) DEFAULT 'unit';
          END IF;
        END IF;

        -- ORDERS table columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'outlet_id') THEN
            ALTER TABLE orders ADD COLUMN outlet_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_bar_order') THEN
            ALTER TABLE orders ADD COLUMN is_bar_order BOOLEAN DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'bartender_id') THEN
            ALTER TABLE orders ADD COLUMN bartender_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'vip_customer_id') THEN
            ALTER TABLE orders ADD COLUMN vip_customer_id INTEGER;
          END IF;
        END IF;

        -- RESTAURANT_TABLES columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_tables') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'outlet_id') THEN
            ALTER TABLE restaurant_tables ADD COLUMN outlet_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'is_bar_seat') THEN
            ALTER TABLE restaurant_tables ADD COLUMN is_bar_seat BOOLEAN DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'type') THEN
            ALTER TABLE restaurant_tables ADD COLUMN type VARCHAR(50) DEFAULT 'dining';
          END IF;
        END IF;

        -- DEPARTMENT_INVENTORY columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department_inventory') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'department_inventory' AND column_name = 'outlet_id') THEN
            ALTER TABLE department_inventory ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;

        -- STOCK_TRANSFERS columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_transfers') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_transfers' AND column_name = 'from_outlet_id') THEN
            ALTER TABLE stock_transfers ADD COLUMN from_outlet_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_transfers' AND column_name = 'to_outlet_id') THEN
            ALTER TABLE stock_transfers ADD COLUMN to_outlet_id INTEGER;
          END IF;
        END IF;

        -- KITCHEN_ORDERS columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kitchen_orders') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kitchen_orders' AND column_name = 'kitchen_outlet_id') THEN
            ALTER TABLE kitchen_orders ADD COLUMN kitchen_outlet_id INTEGER;
          END IF;
        END IF;

        -- BAR_ORDERS columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bar_orders') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bar_orders' AND column_name = 'outlet_id') THEN
            ALTER TABLE bar_orders ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;

        -- CASHIER_SHIFTS columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cashier_shifts') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashier_shifts' AND column_name = 'outlet_id') THEN
            ALTER TABLE cashier_shifts ADD COLUMN outlet_id INTEGER;
          END IF;
        END IF;

        -- PAYMENTS columns
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'outlet_id') THEN
            ALTER TABLE payments ADD COLUMN outlet_id INTEGER;
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