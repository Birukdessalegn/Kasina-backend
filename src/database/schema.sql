-- ============================================================
-- KASINA HOTEL MANAGEMENT SYSTEM (HMS)
-- Consolidated Master PostgreSQL Database Schema
-- Single Source of Truth
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
        CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'on_leave', 'terminated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('present', 'late', 'absent', 'on_leave');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
        CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'partial', 'refunded', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
        CREATE TYPE expense_status AS ENUM ('pending', 'paid', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_status') THEN
        CREATE TYPE purchase_status AS ENUM ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
    END IF;
END $$;


-- ============================================================
-- 1. ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    parent_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 2. DEPARTMENTS & HIERARCHY
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE,
    parent_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    manager_employee_id INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 3. OUTLETS / OPERATIONAL LOCATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS outlets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'pos', -- 'pos', 'kitchen', 'bar', 'store', 'frontdesk'
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outlets_code ON outlets(code);
CREATE INDEX IF NOT EXISTS idx_outlets_type ON outlets(type);


-- ============================================================
-- 4. POSITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    default_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_positions_code ON positions(code);
CREATE INDEX IF NOT EXISTS idx_positions_dept ON positions(department_id);


-- ============================================================
-- 5. PERMISSIONS & ROLE PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);


-- ============================================================
-- 6. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    status user_status DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_outlet ON users(outlet_id);


-- ============================================================
-- 7. EMPLOYEES & REPORTING HIERARCHY
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    role_id INTEGER REFERENCES roles(id),
    department_id INTEGER REFERENCES departments(id),
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
    reports_to_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    user_id UUID UNIQUE REFERENCES users(id),
    hire_date DATE,
    salary NUMERIC(12,2) DEFAULT 0,
    status employee_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role_id);
CREATE INDEX IF NOT EXISTS idx_employees_outlet ON employees(outlet_id);
CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_reports_to ON employees(reports_to_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);


-- ============================================================
-- 8. SHIFTS & ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_shifts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, shift_date)
);

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status attendance_status NOT NULL DEFAULT 'absent',
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);


-- ============================================================
-- 9. LEAVE MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    max_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id INTEGER REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT,
    status leave_status DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    manager_comment TEXT,
    CHECK (end_date >= start_date),
    CHECK (total_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);


-- ============================================================
-- 9B. PAYROLL MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_runs (
    id SERIAL PRIMARY KEY,
    period_month VARCHAR(7) UNIQUE NOT NULL, -- e.g. '2026-09'
    total_employees INTEGER NOT NULL DEFAULT 0,
    total_gross NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'preview', -- 'preview', 'approved', 'paid', 'cancelled'
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month ON payroll_runs(period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

CREATE TABLE IF NOT EXISTS payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    overtime NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    bonuses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    days_worked NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    days_absent NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    income_tax NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- backward-compat alias for total_deductions
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'bank_transfer',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_emp ON payroll_items(employee_id);


-- ============================================================
-- 10. PRODUCT CATEGORIES & PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(30) DEFAULT 'food', -- 'food', 'bar', 'beverage', 'supply', 'other'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    category_id INTEGER REFERENCES product_categories(id),
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(12,2) DEFAULT 0,
    staff_price NUMERIC(12,2) DEFAULT 0,
    unit VARCHAR(30) DEFAULT 'pcs',
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    menu_type VARCHAR(30) DEFAULT 'both',
    is_todays_special BOOLEAN DEFAULT FALSE,
    item_type VARCHAR(30) DEFAULT 'menu_item', -- 'menu_item', 'raw_material', 'beverage', 'supply'
    preparation_outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    parent_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    portion_ratio NUMERIC(10,4) DEFAULT 1.0000,
    serving_size VARCHAR(50) DEFAULT 'unit',
    shots_capacity INTEGER DEFAULT 0,
    is_shot_item BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_menu_type ON products(menu_type);
CREATE INDEX IF NOT EXISTS idx_products_item_type ON products(item_type);
CREATE INDEX IF NOT EXISTS idx_products_prep_outlet ON products(preparation_outlet_id);


-- ============================================================
-- 11. RECIPES & BILL OF MATERIALS (BOM)
-- ============================================================

CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    yield_quantity NUMERIC(10,2) DEFAULT 1.00,
    preparation_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    notes TEXT,
    UNIQUE(recipe_id, ingredient_product_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON recipe_ingredients(ingredient_product_id);


-- ============================================================
-- 12. MASTER INVENTORY (CENTRAL STORE)
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) DEFAULT 0,
    minimum_stock NUMERIC(12,3) DEFAULT 0,
    maximum_stock NUMERIC(12,3),
    unit VARCHAR(30),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    transaction_type VARCHAR(50) NOT NULL,
    quantity NUMERIC(12,3) NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 13. MULTI-STORE OUTLET INVENTORY & STOCK TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS department_inventory (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(12,3) NOT NULL DEFAULT 5,
    maximum_stock NUMERIC(12,3),
    unit VARCHAR(30) DEFAULT 'pcs',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department, product_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_inv_dept ON department_inventory(department);
CREATE INDEX IF NOT EXISTS idx_dept_inv_outlet ON department_inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_dept_inv_product ON department_inventory(product_id);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    to_outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    from_location VARCHAR(50) NOT NULL DEFAULT 'main',
    to_location VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    requested_by UUID REFERENCES users(id),
    dispatched_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_locations ON stock_transfers(from_location, to_location);
CREATE INDEX IF NOT EXISTS idx_transfers_outlets ON stock_transfers(from_outlet_id, to_outlet_id);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,3) NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON stock_transfer_items(transfer_id);

CREATE TABLE IF NOT EXISTS department_inventory_transactions (
    id SERIAL PRIMARY KEY,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    department VARCHAR(50) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    transaction_type VARCHAR(50) NOT NULL,
    quantity NUMERIC(12,3) NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_tx_dept_prod ON department_inventory_transactions(department, product_id);

CREATE TABLE IF NOT EXISTS kitchen_stock_audits (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL DEFAULT 'kitchen',
    action VARCHAR(50) NOT NULL, -- 'approved_depleted', 'rejected_stock_found', 'verified_in_stock'
    physical_count_found NUMERIC(12,3) DEFAULT 0,
    verified_by UUID REFERENCES users(id),
    verifier_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stock_audits_product ON kitchen_stock_audits(product_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_audits_action ON kitchen_stock_audits(action);
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_audits_created ON kitchen_stock_audits(created_at DESC);


-- ============================================================
-- 14. SUPPLIERS & PURCHASING WORKFLOW
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    tax_number VARCHAR(100),
    status VARCHAR(30) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    outlet_id INTEGER REFERENCES outlets(id),
    requested_by UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'ordered'
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'urgent'
    notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_dept ON purchase_requests(department_id);

CREATE TABLE IF NOT EXISTS purchase_request_items (
    id SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(30),
    estimated_price NUMERIC(12,2) DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_purchase_request_items_req ON purchase_request_items(purchase_request_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    purchase_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
    destination_outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    status purchase_status DEFAULT 'draft',
    payment_status VARCHAR(30) DEFAULT 'credit',
    payment_method VARCHAR(50) DEFAULT 'cash',
    paid_amount NUMERIC(12,2) DEFAULT 0,
    paid_at TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,3) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    received_quantity NUMERIC(12,3) DEFAULT 0
);


-- ============================================================
-- 15. RESTAURANT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id SERIAL PRIMARY KEY,
    table_number VARCHAR(30) UNIQUE NOT NULL,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    capacity INTEGER DEFAULT 2,
    location VARCHAR(100),
    is_bar_seat BOOLEAN DEFAULT FALSE,
    type VARCHAR(50) DEFAULT 'dining',
    section VARCHAR(50) DEFAULT 'DINING',
    status VARCHAR(30) DEFAULT 'available',
    current_waiter_id INTEGER REFERENCES employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_outlet ON restaurant_tables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_bar_seat ON restaurant_tables(is_bar_seat);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_type ON restaurant_tables(type);


-- ============================================================
-- 16. CUSTOMERS & VIP / CREDIT CLIENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vip_customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    tier VARCHAR(50) DEFAULT 'Gold VIP',
    credit_limit NUMERIC(12, 2) DEFAULT 10000.00,
    current_debt NUMERIC(12, 2) DEFAULT 0.00,
    company VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 17. HOTEL ROOMS & RESERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS room_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    base_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    capacity INTEGER DEFAULT 2,
    description TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(30) UNIQUE NOT NULL,
    room_type_id INTEGER NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    floor INTEGER DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'available', -- 'available', 'occupied', 'reserved', 'cleaning', 'maintenance'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type_id);

CREATE TABLE IF NOT EXISTS room_reservations (
    id SERIAL PRIMARY KEY,
    reservation_code VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    vip_customer_id INTEGER REFERENCES vip_customers(id) ON DELETE SET NULL,
    guest_name VARCHAR(150) NOT NULL,
    guest_phone VARCHAR(50),
    guest_email VARCHAR(150),
    guest_id_number VARCHAR(100),
    id_image_url TEXT,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in_at TIMESTAMP,
    actual_check_out_at TIMESTAMP,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    rate_per_night NUMERIC(12,2) NOT NULL,
    total_nights INTEGER NOT NULL DEFAULT 1,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
    special_requests TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_res_code ON room_reservations(reservation_code);
CREATE INDEX IF NOT EXISTS idx_room_res_room ON room_reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_res_status ON room_reservations(status);
CREATE INDEX IF NOT EXISTS idx_room_res_dates ON room_reservations(check_in_date, check_out_date);

CREATE TABLE IF NOT EXISTS room_payments (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES room_reservations(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_type VARCHAR(50) NOT NULL DEFAULT 'payment',
    transaction_reference VARCHAR(100),
    notes TEXT,
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_payments_res ON room_payments(reservation_id);

CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    reservation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    table_id INTEGER REFERENCES restaurant_tables(id),
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    guest_count INTEGER NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 17B. HOUSEKEEPING & LINEN MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    task_type VARCHAR(50) DEFAULT 'standard_clean', -- 'standard_clean', 'deep_clean', 'inspection', 'turn_down'
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'urgent'
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'inspected'
    checklist JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_room ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned ON housekeeping_tasks(assigned_employee_id);

CREATE TABLE IF NOT EXISTS linen_inventory (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) UNIQUE NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    in_use INTEGER NOT NULL DEFAULT 0,
    in_laundry INTEGER NOT NULL DEFAULT 0,
    clean_available INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(30) DEFAULT 'pcs',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 18. POS ORDERS & SERVICE TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id),
    table_id INTEGER REFERENCES restaurant_tables(id),
    waiter_id INTEGER REFERENCES employees(id),
    order_type VARCHAR(30) DEFAULT 'dine_in',
    subtotal NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    vip_customer_id INTEGER,
    is_bar_order BOOLEAN DEFAULT FALSE,
    bartender_id INTEGER REFERENCES employees(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_outlet ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_bar_order ON orders(is_bar_order);
CREATE INDEX IF NOT EXISTS idx_orders_bartender_id ON orders(bartender_id);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(12,3) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    notes TEXT,
    status order_status DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);


-- ============================================================
-- 19. KITCHEN ORDERS (KDS) & BAR TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS kitchen_orders (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kitchen_outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    status order_status DEFAULT 'pending',
    started_at TIMESTAMP,
    ready_at TIMESTAMP,
    chef_id INTEGER REFERENCES employees(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kitchen_orders_outlet ON kitchen_orders(kitchen_outlet_id);

CREATE TABLE IF NOT EXISTS kitchen_order_items (
    id SERIAL PRIMARY KEY,
    kitchen_order_id INTEGER NOT NULL REFERENCES kitchen_orders(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL,
    status order_status DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS bar_orders (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    bartender_id INTEGER REFERENCES employees(id),
    status order_status DEFAULT 'pending',
    started_at TIMESTAMP,
    ready_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bar_orders_outlet ON bar_orders(outlet_id);

CREATE TABLE IF NOT EXISTS bar_order_items (
    id SERIAL PRIMARY KEY,
    bar_order_id INTEGER NOT NULL REFERENCES bar_orders(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,3) NOT NULL,
    status order_status DEFAULT 'pending'
);


-- ============================================================
-- 20. CASHIER SHIFTS, PAYMENTS & REPAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS cashier_shifts (
    id SERIAL PRIMARY KEY,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cashier_name VARCHAR(150),
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    terminal_id INTEGER DEFAULT 1,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    opening_cash NUMERIC(12,2) DEFAULT 0.00,
    expected_cash NUMERIC(12,2) DEFAULT 0.00,
    actual_cash NUMERIC(12,2) DEFAULT 0.00,
    shortage_overage NUMERIC(12,2) DEFAULT 0.00,
    total_card_sales NUMERIC(12,2) DEFAULT 0.00,
    total_mobile_sales NUMERIC(12,2) DEFAULT 0.00,
    total_credit_sales NUMERIC(12,2) DEFAULT 0.00,
    total_repayments_cash NUMERIC(12,2) DEFAULT 0.00,
    total_expenses_cash NUMERIC(12,2) DEFAULT 0.00,
    total_refunds_cash NUMERIC(12,2) DEFAULT 0.00,
    total_sales NUMERIC(12,2) DEFAULT 0.00,
    total_orders_count INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'open',
    cashier_notes TEXT,
    verified_by UUID REFERENCES users(id),
    verified_by_name VARCHAR(150),
    verified_at TIMESTAMP,
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status ON cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier ON cashier_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier_status ON cashier_shifts(cashier_id, status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_outlet ON cashier_shifts(outlet_id);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    status payment_status DEFAULT 'paid',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_by UUID REFERENCES users(id),
    image_url TEXT,
    receipt_image TEXT,
    vip_customer_id INTEGER,
    cashier_shift_id INTEGER REFERENCES cashier_shifts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_outlet ON payments(outlet_id);

CREATE TABLE IF NOT EXISTS customer_repayments (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES vip_customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    reference VARCHAR(255),
    notes TEXT,
    received_by UUID REFERENCES users(id),
    cashier_shift_id INTEGER REFERENCES cashier_shifts(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 21. EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    expense_number VARCHAR(50) UNIQUE,
    description VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id),
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status expense_status DEFAULT 'pending',
    reference VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);


-- ============================================================
-- 21B. BASIC PAYROLL ARCHIVES
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_runs (
    id SERIAL PRIMARY KEY,
    period_month VARCHAR(7) NOT NULL UNIQUE, -- 'YYYY-MM'
    total_employees INTEGER NOT NULL DEFAULT 0,
    total_gross NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_net NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'draft', -- 'draft', 'approved', 'paid'
    processed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    base_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    days_worked NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    days_absent NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'bank_transfer',
    notes TEXT,
    UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_emp ON payroll_items(employee_id);


-- ============================================================
-- 22. NOTIFICATIONS & AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 23. SEED DATA (CORE ROLES & HIERARCHY)
-- ============================================================

INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system administrator'),
    ('hotel_manager', 'General Hotel Manager overseeing all divisions'),
    ('accountant_manager', 'Head of Finance, Accounting, Store and Purchasing'),
    ('cooperative_manager', 'Operations Manager for Cafe, Bar, Restaurant, and Reception'),
    ('kitchen_manager', 'Executive Kitchen Manager supervising Cafe & Restaurant Kitchens'),
    ('hr_manager', 'Human Resources Manager'),
    ('housekeeping_manager', 'Housekeeping and Facilities Manager'),
    ('fnb_manager', 'Food & Beverage Cost Controller and Menu Manager'),
    ('store_manager', 'Central Store and Warehouse Manager'),
    ('purchasing_manager', 'Procurement and Supplier Relationship Manager'),
    ('cafe_supervisor', 'Supervisor of Cafe Operations and Staff'),
    ('bar_restaurant_supervisor', 'Supervisor of Bar and Restaurant Operations'),
    ('cafe_chef', 'Head Chef for Cafe Kitchen'),
    ('barista', 'Cafe Barista & Specialty Drinks Maker'),
    ('cafe_waiter', 'Waiter dedicated to Cafe Section'),
    ('chef', 'Main Restaurant Line Chef'),
    ('bartender', 'Bartender & Mixologist'),
    ('waiter', 'Restaurant Floor Waiter'),
    ('receptionist', 'Front Desk and Guest Check-In Agent'),
    ('cashier', 'POS Point of Sale Cashier'),
    ('fb_controller', 'Legacy Food & Beverage Controller'),
    ('finance', 'Legacy Finance Officer'),
    ('manager', 'Legacy General Manager')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 24. SEED DATA (DEPARTMENTS & HIERARCHY)
-- ============================================================

INSERT INTO departments (name, code, description) VALUES
    ('Management', 'MGMT', 'Executive Hotel & Restaurant Management'),
    ('Finance', 'FIN', 'Finance, Accounting, Cashiering, and Financial Audits'),
    ('Human Resources', 'HR', 'Personnel, Staffing, and Payroll'),
    ('Food & Beverage', 'FB', 'F&B Cost Control, Menu Management and Quality Assurance'),
    ('Store & Warehouse', 'STORE', 'Central stock, physical receiving, and internal dispatch'),
    ('Purchasing', 'PURCHASING', 'Procurement, Supplier Sourcing and Purchase Orders'),
    ('Cooperative Operations', 'COOPERATIVE', 'Operational management of Cafe, Bar, Restaurant, and Front Desk'),
    ('Service', 'SERVICE', 'Restaurant, Cafe, and Dining Service Staff'),
    ('Kitchen', 'KITCHEN', 'Culinary Operations and Food Preparation'),
    ('Bar', 'BAR', 'Lounge, Cocktails, and Beverage Service'),
    ('Front Desk', 'FRONTDESK', 'Reception, Guest Check-In, Concierge and Reservations'),
    ('Housekeeping', 'HOUSEKEEPING', 'Room cleaning, linen management, and guest supplies'),
    ('Administration', 'ADMIN', 'General Hotel Operations and Facilities')
ON CONFLICT (name) DO UPDATE SET 
    code = EXCLUDED.code, 
    description = COALESCE(departments.description, EXCLUDED.description);

-- Set Department Reporting Hierarchy
UPDATE departments SET parent_department_id = (SELECT id FROM departments WHERE code = 'MGMT') 
WHERE code IN ('FIN', 'COOPERATIVE', 'KITCHEN', 'HOUSEKEEPING', 'HR', 'ADMIN') 
  AND parent_department_id IS NULL;

UPDATE departments SET parent_department_id = (SELECT id FROM departments WHERE code = 'FIN') 
WHERE code IN ('FB', 'STORE', 'PURCHASING') 
  AND parent_department_id IS NULL;

UPDATE departments SET parent_department_id = (SELECT id FROM departments WHERE code = 'COOPERATIVE') 
WHERE code IN ('SERVICE', 'BAR', 'FRONTDESK') 
  AND parent_department_id IS NULL;


-- ============================================================
-- 25. SEED DATA (INITIAL 7 OUTLETS)
-- ============================================================

INSERT INTO outlets (name, code, type, department_id) VALUES
    ('Front Desk Reception', 'RECEPTION', 'frontdesk', (SELECT id FROM departments WHERE code = 'FRONTDESK')),
    ('Cafe', 'CAFE', 'pos', (SELECT id FROM departments WHERE code = 'SERVICE')),
    ('Main Bar', 'BAR', 'bar', (SELECT id FROM departments WHERE code = 'BAR')),
    ('Main Restaurant', 'RESTAURANT', 'pos', (SELECT id FROM departments WHERE code = 'SERVICE')),
    ('Cafe Kitchen', 'CAFE_KITCHEN', 'kitchen', (SELECT id FROM departments WHERE code = 'KITCHEN')),
    ('Restaurant Kitchen', 'RESTAURANT_KITCHEN', 'kitchen', (SELECT id FROM departments WHERE code = 'KITCHEN')),
    ('Central Store', 'CENTRAL_STORE', 'store', (SELECT id FROM departments WHERE code = 'STORE'))
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type,
    department_id = COALESCE(outlets.department_id, EXCLUDED.department_id);


-- ============================================================
-- 26. SEED DATA (JOB POSITIONS)
-- ============================================================

INSERT INTO positions (title, code, department_id, default_role_id, description) VALUES
    ('Hotel Manager', 'POS_HOTEL_MGR', (SELECT id FROM departments WHERE code = 'MGMT'), (SELECT id FROM roles WHERE name = 'hotel_manager'), 'General Manager'),
    ('Accountant Manager', 'POS_ACC_MGR', (SELECT id FROM departments WHERE code = 'FIN'), (SELECT id FROM roles WHERE name = 'accountant_manager'), 'Finance & Stores Head'),
    ('Cooperative Manager', 'POS_COOP_MGR', (SELECT id FROM departments WHERE code = 'COOPERATIVE'), (SELECT id FROM roles WHERE name = 'cooperative_manager'), 'Service Operations Head'),
    ('Kitchen Manager', 'POS_KIT_MGR', (SELECT id FROM departments WHERE code = 'KITCHEN'), (SELECT id FROM roles WHERE name = 'kitchen_manager'), 'Executive Chef & Kitchen Head'),
    ('HR Manager', 'POS_HR_MGR', (SELECT id FROM departments WHERE code = 'HR'), (SELECT id FROM roles WHERE name = 'hr_manager'), 'Human Resources Head'),
    ('Housekeeping Manager', 'POS_HK_MGR', (SELECT id FROM departments WHERE code = 'HOUSEKEEPING'), (SELECT id FROM roles WHERE name = 'housekeeping_manager'), 'Housekeeping Head'),
    ('F&B Manager', 'POS_FB_MGR', (SELECT id FROM departments WHERE code = 'FB'), (SELECT id FROM roles WHERE name = 'fnb_manager'), 'Food & Beverage Controller'),
    ('Store Manager', 'POS_STORE_MGR', (SELECT id FROM departments WHERE code = 'STORE'), (SELECT id FROM roles WHERE name = 'store_manager'), 'Warehouse & Receiving Head'),
    ('Purchasing Manager', 'POS_PURCH_MGR', (SELECT id FROM departments WHERE code = 'PURCHASING'), (SELECT id FROM roles WHERE name = 'purchasing_manager'), 'Procurement Officer'),
    ('Cafe Supervisor', 'POS_CAFE_SUP', (SELECT id FROM departments WHERE code = 'SERVICE'), (SELECT id FROM roles WHERE name = 'cafe_supervisor'), 'Cafe Floor Supervisor'),
    ('Bar & Restaurant Supervisor', 'POS_BAR_REST_SUP', (SELECT id FROM departments WHERE code = 'SERVICE'), (SELECT id FROM roles WHERE name = 'bar_restaurant_supervisor'), 'Dining Room & Bar Supervisor'),
    ('Cafe Chef', 'POS_CAFE_CHEF', (SELECT id FROM departments WHERE code = 'KITCHEN'), (SELECT id FROM roles WHERE name = 'cafe_chef'), 'Cafe Culinary Chef'),
    ('Barista', 'POS_BARISTA', (SELECT id FROM departments WHERE code = 'SERVICE'), (SELECT id FROM roles WHERE name = 'barista'), 'Cafe Barista'),
    ('Cafe Waiter', 'POS_CAFE_WAITER', (SELECT id FROM departments WHERE code = 'SERVICE'), (SELECT id FROM roles WHERE name = 'cafe_waiter'), 'Cafe Waiter/Waitress'),
    ('Line Chef', 'POS_CHEF', (SELECT id FROM departments WHERE code = 'KITCHEN'), (SELECT id FROM roles WHERE name = 'chef'), 'Restaurant Cook'),
    ('Bartender', 'POS_BARTENDER', (SELECT id FROM departments WHERE code = 'BAR'), (SELECT id FROM roles WHERE name = 'bartender'), 'Bar & Beverage Server'),
    ('Restaurant Waiter', 'POS_WAITER', (SELECT id FROM departments WHERE code = 'SERVICE'), (SELECT id FROM roles WHERE name = 'waiter'), 'Dining Floor Waiter'),
    ('Receptionist / Cashier', 'POS_RECEPTIONIST', (SELECT id FROM departments WHERE code = 'FRONTDESK'), (SELECT id FROM roles WHERE name = 'receptionist'), 'Front Desk Receptionist'),
    ('POS Cashier', 'POS_CASHIER', (SELECT id FROM departments WHERE code = 'FIN'), (SELECT id FROM roles WHERE name = 'cashier'), 'Cashier')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 27. SEED DATA (PERMISSIONS & SYSTEM PERMISSION MAPPING)
-- ============================================================

INSERT INTO permissions (name, code, module, description) VALUES
    ('All System Permissions', '*', 'system', 'Full superuser access'),
    ('View Dashboard', 'dashboard.view', 'dashboard', 'Access executive dashboard'),
    ('Access POS Terminal', 'pos.access', 'pos', 'Access point of sale terminal'),
    ('Create POS Orders', 'pos.orders.create', 'pos', 'Take guest orders'),
    ('Cancel POS Orders', 'pos.orders.cancel', 'pos', 'Cancel orders with reason'),
    ('Apply Discounts', 'pos.discount.apply', 'pos', 'Apply discounts to orders'),
    ('Manage Cashier Shift', 'pos.shifts.manage', 'pos', 'Open, close, and reconcile drawer shifts'),
    ('Access Kitchen Display', 'kitchen.access', 'kitchen', 'View kitchen KDS tickets'),
    ('Update Kitchen Status', 'kitchen.status.update', 'kitchen', 'Mark food preparing/ready/served'),
    ('Access Bar Display', 'bar.access', 'bar', 'View bar order queue'),
    ('Update Bar Status', 'bar.status.update', 'bar', 'Mark drinks preparing/ready/served'),
    ('View Central Store Inventory', 'inventory.store.view', 'inventory', 'View warehouse stock quantities'),
    ('Verify & Receive Stock', 'inventory.receive', 'inventory', 'Verify and acknowledge physical stock deliveries'),
    ('Issue & Transfer Stock', 'inventory.transfer', 'inventory', 'Approve and dispatch internal stock transfers'),
    ('Perform Stock Audits', 'inventory.audit', 'inventory', 'Perform physical inventory counts and adjustments'),
    ('Create Purchase Requests', 'purchasing.request.create', 'purchasing', 'Submit department requisitions'),
    ('Approve Purchase Requests', 'purchasing.request.approve', 'purchasing', 'Approve departmental requisitions'),
    ('Manage Purchase Orders', 'purchasing.po.manage', 'purchasing', 'Create, send, and edit purchase orders'),
    ('Manage Suppliers', 'purchasing.suppliers.manage', 'purchasing', 'Add and edit supplier profiles'),
    ('Access Front Desk', 'frontdesk.access', 'frontdesk', 'Check-in guests and manage room status'),
    ('Manage Room Reservations', 'reservations.manage', 'frontdesk', 'Create and modify room bookings'),
    ('Access Finance & Audits', 'finance.access', 'finance', 'Review cashier shifts, sales, and payments'),
    ('Manage Expenses', 'expenses.manage', 'finance', 'Record and approve operational expenses'),
    ('Manage Recipes', 'recipes.manage', 'kitchen', 'Manage bill of materials (BOM) recipes'),
    ('Manage Menu & Pricing', 'menu.manage', 'products', 'Add/edit products, menu types and prices'),
    ('Manage Employees & HR', 'employees.manage', 'hr', 'Manage staff profiles, shifts, and attendance'),
    ('View Reporting Hierarchy', 'employees.hierarchy.view', 'hr', 'Inspect organizational tree')
ON CONFLICT (code) DO NOTHING;

-- Grant Admin All Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = '*'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 28. DEFAULT OPERATIONAL SEEDS (SHIFTS, LEAVE, CATEGORIES)
-- ============================================================

INSERT INTO shifts (name, start_time, end_time, description) VALUES
    ('Morning Shift', '08:00', '16:00', 'Morning working shift'),
    ('Day Shift', '09:00', '17:00', 'Day working shift'),
    ('Evening Shift', '16:00', '00:00', 'Evening working shift'),
    ('Night Shift', '18:00', '02:00', 'Night working shift')
ON CONFLICT DO NOTHING;

INSERT INTO leave_types (name, description, max_days) VALUES
    ('Annual Leave', 'Regular annual employee leave', 30),
    ('Sick Leave', 'Leave due to illness', 30),
    ('Emergency Leave', 'Emergency personal leave', 10),
    ('Maternity Leave', 'Maternity leave', 90),
    ('Paternity Leave', 'Paternity leave', 10),
    ('Unpaid Leave', 'Leave without salary', 30)
ON CONFLICT (name) DO NOTHING;

INSERT INTO product_categories (name, description, type) VALUES
    ('Food', 'Restaurant food items', 'food'),
    ('Beverages', 'Non-alcoholic beverages', 'beverage'),
    ('Bar', 'Bar products', 'bar'),
    ('Kitchen Supplies', 'Kitchen supplies', 'supply'),
    ('Other', 'Other products', 'other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name, description) VALUES
    ('Utilities', 'Electricity, water and utility bills'),
    ('Salaries & Wages', 'Employee salaries and wages'),
    ('Cleaning & Supplies', 'Cleaning materials and supplies'),
    ('Maintenance', 'Equipment and building maintenance'),
    ('Transportation', 'Transportation expenses'),
    ('Marketing', 'Marketing and advertising'),
    ('Rent', 'Property rent'),
    ('Taxes & Fees', 'Taxes and government fees'),
    ('Kitchen', 'Kitchen-related expenses'),
    ('Bar', 'Bar-related expenses'),
    ('Other', 'Other business expenses')
ON CONFLICT (name) DO NOTHING;

INSERT INTO linen_inventory (item_name, total_quantity, in_use, in_laundry, clean_available) VALUES
    ('King Bedsheet', 120, 45, 15, 60),
    ('Queen Bedsheet', 100, 35, 10, 55),
    ('Bath Towel', 250, 90, 40, 120),
    ('Hand Towel', 200, 70, 30, 100),
    ('Pillowcase', 300, 110, 40, 150),
    ('Duvet Cover', 110, 40, 15, 55)
ON CONFLICT (item_name) DO NOTHING;


-- ============================================================
-- FINISHED
-- ============================================================

SELECT 'Kasina Hotel consolidated master database schema initialized successfully!' AS message;
