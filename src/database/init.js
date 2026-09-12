const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

const initializeDatabase = async () => {
  try {
    console.log("🔄 Auditing and migrating database schema columns...");

    // =========================================================================
    // PHASE 1: SAFE COLUMN RECONCILIATION FOR ALL LEGACY TABLES
    // Uses ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...
    // to guarantee all columns exist before indexes, constraints, and seeds run.
    // =========================================================================
    await pool.query(`
      -- 1. ROLES
      ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS parent_role_id INTEGER;
      ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS description TEXT;

      -- 2. DEPARTMENTS
      ALTER TABLE IF EXISTS departments ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE IF EXISTS departments ADD COLUMN IF NOT EXISTS parent_department_id INTEGER;
      ALTER TABLE IF EXISTS departments ADD COLUMN IF NOT EXISTS manager_employee_id INTEGER;
      ALTER TABLE IF EXISTS departments ADD COLUMN IF NOT EXISTS description TEXT;

      -- 3. OUTLETS
      ALTER TABLE IF EXISTS outlets ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE IF EXISTS outlets ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'pos';
      ALTER TABLE IF EXISTS outlets ADD COLUMN IF NOT EXISTS department_id INTEGER;
      ALTER TABLE IF EXISTS outlets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      -- 4. POSITIONS
      ALTER TABLE IF EXISTS positions ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE IF EXISTS positions ADD COLUMN IF NOT EXISTS department_id INTEGER;
      ALTER TABLE IF EXISTS positions ADD COLUMN IF NOT EXISTS default_role_id INTEGER;
      ALTER TABLE IF EXISTS positions ADD COLUMN IF NOT EXISTS description TEXT;

      -- 5. PERMISSIONS
      ALTER TABLE IF EXISTS permissions ADD COLUMN IF NOT EXISTS code VARCHAR(100);
      ALTER TABLE IF EXISTS permissions ADD COLUMN IF NOT EXISTS module VARCHAR(50);
      ALTER TABLE IF EXISTS permissions ADD COLUMN IF NOT EXISTS description TEXT;

      -- 6. USERS
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role_id INTEGER;
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

      -- 7. EMPLOYEES
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS role_id INTEGER;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS department_id INTEGER;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS position_id INTEGER;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS reports_to_employee_id INTEGER;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS user_id UUID;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS hire_date DATE;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';

      -- 8. SHIFTS & ATTENDANCE
      ALTER TABLE IF EXISTS shifts ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS recorded_by UUID;

      -- 9. LEAVE
      ALTER TABLE IF EXISTS leave_types ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS leave_types ADD COLUMN IF NOT EXISTS max_days INTEGER;
      ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS reason TEXT;
      ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
      ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
      ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS manager_comment TEXT;

      -- 10. PAYROLL
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS total_employees INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS total_gross NUMERIC(14,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(14,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS total_net NUMERIC(14,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'preview';
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS processed_by UUID;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS approved_by UUID;
      ALTER TABLE IF EXISTS payroll_runs ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS overtime NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS bonuses NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS days_worked NUMERIC(6,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS days_absent NUMERIC(6,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS absence_deduction NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS pension_employee NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS pension_employer NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS income_tax NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS deductions NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending';
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';
      ALTER TABLE IF EXISTS payroll_items ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 11. PRODUCTS & CATEGORIES
      ALTER TABLE IF EXISTS product_categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS product_categories ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'food';

      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS category_id INTEGER;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS staff_price NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'pcs';
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS menu_type VARCHAR(30) DEFAULT 'both';
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_todays_special BOOLEAN DEFAULT FALSE;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS item_type VARCHAR(30) DEFAULT 'menu_item';
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS preparation_outlet_id INTEGER;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS parent_product_id INTEGER;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS portion_ratio NUMERIC(10,4) DEFAULT 1.0000;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS serving_size VARCHAR(50) DEFAULT 'unit';
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS shots_capacity INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_shot_item BOOLEAN DEFAULT FALSE;

      -- 12. RECIPES
      ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS yield_quantity NUMERIC(10,2) DEFAULT 1.00;
      ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
      ALTER TABLE IF EXISTS recipes ADD COLUMN IF NOT EXISTS created_by UUID;
      ALTER TABLE IF EXISTS recipe_ingredients ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'pcs';
      ALTER TABLE IF EXISTS recipe_ingredients ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 13. INVENTORY & MULTI-OUTLET STOCK
      ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC(12,3) DEFAULT 0;
      ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS maximum_stock NUMERIC(12,3);
      ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(30);

      ALTER TABLE IF EXISTS department_inventory ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS department_inventory ADD COLUMN IF NOT EXISTS minimum_stock NUMERIC(12,3) DEFAULT 5;
      ALTER TABLE IF EXISTS department_inventory ADD COLUMN IF NOT EXISTS maximum_stock NUMERIC(12,3);
      ALTER TABLE IF EXISTS department_inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'pcs';

      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS from_outlet_id INTEGER;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS to_outlet_id INTEGER;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS from_location VARCHAR(50) DEFAULT 'main';
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS to_location VARCHAR(50) DEFAULT 'bar';
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed';
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS requested_by UUID;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS dispatched_by UUID;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS received_by UUID;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS approved_by UUID;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE IF EXISTS stock_transfers ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS department_inventory_transactions ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS department_inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS department_inventory_transactions ADD COLUMN IF NOT EXISTS created_by UUID;

      ALTER TABLE IF EXISTS kitchen_stock_audits ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'kitchen';
      ALTER TABLE IF EXISTS kitchen_stock_audits ADD COLUMN IF NOT EXISTS physical_count_found NUMERIC(12,3) DEFAULT 0;
      ALTER TABLE IF EXISTS kitchen_stock_audits ADD COLUMN IF NOT EXISTS verified_by UUID;
      ALTER TABLE IF EXISTS kitchen_stock_audits ADD COLUMN IF NOT EXISTS verifier_name VARCHAR(150);
      ALTER TABLE IF EXISTS kitchen_stock_audits ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 14. SUPPLIERS & PURCHASING
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(50);
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150);
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100);
      ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';

      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
      ALTER TABLE IF EXISTS purchase_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS purchase_request_id INTEGER;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS destination_outlet_id INTEGER;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS expected_date DATE;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS tax NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'credit';
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS verified_by UUID;
      ALTER TABLE IF EXISTS purchase_orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

      ALTER TABLE IF EXISTS purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12,3) DEFAULT 0;

      -- 15. RESTAURANT TABLES
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 2;
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS location VARCHAR(100);
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS is_bar_seat BOOLEAN DEFAULT FALSE;
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'dining';
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS section VARCHAR(50) DEFAULT 'DINING';
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available';
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS current_waiter_id INTEGER;
      ALTER TABLE IF EXISTS restaurant_tables ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      -- 16. CUSTOMERS & VIP
      ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);
      ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
      ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'Gold VIP';
      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2) DEFAULT 10000.00;
      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS current_debt NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS company VARCHAR(255);
      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS vip_customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      -- 17. ROOMS & RESERVATIONS
      ALTER TABLE IF EXISTS room_types ADD COLUMN IF NOT EXISTS base_rate NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS room_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 2;
      ALTER TABLE IF EXISTS room_types ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS room_types ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE IF EXISTS room_types ADD COLUMN IF NOT EXISTS image_url TEXT;

      ALTER TABLE IF EXISTS rooms ADD COLUMN IF NOT EXISTS floor INTEGER DEFAULT 1;
      ALTER TABLE IF EXISTS rooms ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available';
      ALTER TABLE IF EXISTS rooms ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS customer_id INTEGER;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS vip_customer_id INTEGER;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150);
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS guest_id_number VARCHAR(100);
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS id_image_url TEXT;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS actual_check_in_at TIMESTAMP;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS actual_check_out_at TIMESTAMP;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 1;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS children INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS rate_per_night NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS total_nights INTEGER DEFAULT 1;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid';
      ALTER TABLE IF EXISTS room_reservations ADD COLUMN IF NOT EXISTS special_requests TEXT;

      ALTER TABLE IF EXISTS room_payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'payment';
      ALTER TABLE IF EXISTS room_payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100);
      ALTER TABLE IF EXISTS room_payments ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS room_payments ADD COLUMN IF NOT EXISTS received_by UUID;

      -- 18. HOUSEKEEPING & LINEN
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS assigned_employee_id INTEGER;
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'standard_clean';
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS housekeeping_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

      ALTER TABLE IF EXISTS linen_inventory ADD COLUMN IF NOT EXISTS in_use INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS linen_inventory ADD COLUMN IF NOT EXISTS in_laundry INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS linen_inventory ADD COLUMN IF NOT EXISTS clean_available INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS linen_inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(30) DEFAULT 'pcs';

      -- 19. ORDERS & ITEMS
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS table_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS waiter_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'dine_in';
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tax NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS vip_customer_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS is_bar_order BOOLEAN DEFAULT FALSE;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS bartender_id INTEGER;
      ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 20. KITCHEN & BAR ORDERS
      ALTER TABLE IF EXISTS kitchen_orders ADD COLUMN IF NOT EXISTS kitchen_outlet_id INTEGER;
      ALTER TABLE IF EXISTS kitchen_orders ADD COLUMN IF NOT EXISTS chef_id INTEGER;
      ALTER TABLE IF EXISTS kitchen_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
      ALTER TABLE IF EXISTS kitchen_orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
      ALTER TABLE IF EXISTS kitchen_orders ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE IF EXISTS bar_orders ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS bar_orders ADD COLUMN IF NOT EXISTS bartender_id INTEGER;
      ALTER TABLE IF EXISTS bar_orders ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
      ALTER TABLE IF EXISTS bar_orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
      ALTER TABLE IF EXISTS bar_orders ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 21. CASHIER SHIFTS & PAYMENTS
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(150);
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS terminal_id INTEGER DEFAULT 1;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS opening_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS actual_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS shortage_overage NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_card_sales NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_mobile_sales NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_credit_sales NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_repayments_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_expenses_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_refunds_cash NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_sales NUMERIC(12,2) DEFAULT 0.00;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS total_orders_count INTEGER DEFAULT 0;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS cashier_notes TEXT;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS verified_by UUID;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS verified_by_name VARCHAR(150);
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
      ALTER TABLE IF EXISTS cashier_shifts ADD COLUMN IF NOT EXISTS verification_notes TEXT;

      ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS outlet_id INTEGER;
      ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS receipt_image TEXT;
      ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS vip_customer_id INTEGER;
      ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS cashier_shift_id INTEGER;

      ALTER TABLE IF EXISTS customer_repayments ADD COLUMN IF NOT EXISTS cashier_shift_id INTEGER;
      ALTER TABLE IF EXISTS customer_repayments ADD COLUMN IF NOT EXISTS notes TEXT;

      -- 22. EXPENSES
      ALTER TABLE IF EXISTS expense_categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS expense_number VARCHAR(50);
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS category_id INTEGER;
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS created_by UUID;
      ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS approved_by UUID;

      -- 23. NOTIFICATIONS & AUDIT LOGS
      ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50);
      ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
      ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS reference_id INTEGER;
      ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

      ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS old_data JSONB;
      ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS new_data JSONB;
      ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
    `);

    // =========================================================================
    // PHASE 2: LEGACY DATA NORMALIZATION BEFORE INDEXES & SEEDING
    // Backfills default codes and unique constraints so ON CONFLICT targets work.
    // =========================================================================
    await pool.query(`
      DO $$
      BEGIN
        -- Populate department codes for known departments if null
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
          UPDATE departments SET code = 'MGMT' WHERE LOWER(name) = 'management' AND code IS NULL;
          UPDATE departments SET code = 'FIN' WHERE LOWER(name) = 'finance' AND code IS NULL;
          UPDATE departments SET code = 'HR' WHERE LOWER(name) = 'human resources' AND code IS NULL;
          UPDATE departments SET code = 'FB' WHERE (LOWER(name) = 'food & beverage' OR LOWER(name) = 'food and beverage') AND code IS NULL;
          UPDATE departments SET code = 'STORE' WHERE (LOWER(name) = 'store & warehouse' OR LOWER(name) = 'store and warehouse' OR LOWER(name) = 'store') AND code IS NULL;
          UPDATE departments SET code = 'PURCHASING' WHERE LOWER(name) = 'purchasing' AND code IS NULL;
          UPDATE departments SET code = 'COOPERATIVE' WHERE (LOWER(name) = 'cooperative operations' OR LOWER(name) = 'cooperative') AND code IS NULL;
          UPDATE departments SET code = 'SERVICE' WHERE LOWER(name) = 'service' AND code IS NULL;
          UPDATE departments SET code = 'KITCHEN' WHERE LOWER(name) = 'kitchen' AND code IS NULL;
          UPDATE departments SET code = 'BAR' WHERE LOWER(name) = 'bar' AND code IS NULL;
          UPDATE departments SET code = 'FRONTDESK' WHERE (LOWER(name) = 'front desk' OR LOWER(name) = 'reception') AND code IS NULL;
          UPDATE departments SET code = 'HOUSEKEEPING' WHERE LOWER(name) = 'housekeeping' AND code IS NULL;
          UPDATE departments SET code = 'ADMIN' WHERE LOWER(name) = 'administration' AND code IS NULL;

          -- Generate unique fallback code for any custom un-coded departments
          UPDATE departments 
          SET code = UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 10), '[^a-zA-Z0-9]', '_', 'g')) || '_' || id 
          WHERE code IS NULL;

          -- Ensure unique index on departments(code)
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_departments_code_uq') THEN
            CREATE UNIQUE INDEX idx_departments_code_uq ON departments(code);
          END IF;
        END IF;

        -- Populate outlet codes if null
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlets') THEN
          UPDATE outlets SET code = 'RECEPTION' WHERE LOWER(name) LIKE '%reception%' AND code IS NULL;
          UPDATE outlets SET code = 'CAFE' WHERE LOWER(name) = 'cafe' AND code IS NULL;
          UPDATE outlets SET code = 'BAR' WHERE LOWER(name) LIKE '%bar%' AND code IS NULL;
          UPDATE outlets SET code = 'RESTAURANT' WHERE LOWER(name) LIKE '%restaurant%' AND code IS NULL;
          UPDATE outlets SET code = 'CAFE_KITCHEN' WHERE LOWER(name) LIKE '%cafe kitchen%' AND code IS NULL;
          UPDATE outlets SET code = 'RESTAURANT_KITCHEN' WHERE LOWER(name) LIKE '%restaurant kitchen%' AND code IS NULL;
          UPDATE outlets SET code = 'CENTRAL_STORE' WHERE LOWER(name) LIKE '%store%' AND code IS NULL;

          UPDATE outlets 
          SET code = UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 10), '[^a-zA-Z0-9]', '_', 'g')) || '_' || id 
          WHERE code IS NULL;

          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_code_uq') THEN
            CREATE UNIQUE INDEX idx_outlets_code_uq ON outlets(code);
          END IF;
        END IF;

        -- Populate positions code if null
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'positions') THEN
          UPDATE positions 
          SET code = UPPER(REGEXP_REPLACE(SUBSTRING(title FROM 1 FOR 12), '[^a-zA-Z0-9]', '_', 'g')) || '_' || id 
          WHERE code IS NULL;

          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_positions_code_uq') THEN
            CREATE UNIQUE INDEX idx_positions_code_uq ON positions(code);
          END IF;
        END IF;

        -- Populate permissions code if null
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
          UPDATE permissions 
          SET code = UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 15), '[^a-zA-Z0-9]', '_', 'g')) || '_' || id 
          WHERE code IS NULL;

          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_permissions_code_uq') THEN
            CREATE UNIQUE INDEX idx_permissions_code_uq ON permissions(code);
          END IF;
        END IF;

        -- Normalize shifts table to prevent duplicate shifts on startup
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shifts_name_uq') THEN
            DELETE FROM shifts a USING shifts b WHERE a.name = b.name AND a.id > b.id;
            CREATE UNIQUE INDEX idx_shifts_name_uq ON shifts(name);
          END IF;
        END IF;
      END $$;
    `);

    // =========================================================================
    // PHASE 3: EXECUTE CONSOLIDATED MASTER SCHEMA
    // =========================================================================
    console.log("🔄 Executing master schema.sql...");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schema);

    // =========================================================================
    // PHASE 4: POST-MIGRATION SYNCS & NORMALIZATIONS
    // =========================================================================
    // 1. Auto-link missing user_id on employees table
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

    // 2. Sync employee role_id with user role_id if they differ
    await pool.query(`
      UPDATE employees e
      SET role_id = u.role_id
      FROM users u
      WHERE e.user_id = u.id AND e.role_id IS DISTINCT FROM u.role_id;
    `);

    // 3. Normalize finance role ID from 480 to 8 and reset sequence if legacy entry exists
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