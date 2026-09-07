const pool = require("../config/database");

const seedDatabase = async () => {
  try {
    // 1. Grant public permissions so phpPgAdmin / cPanel user never gets "permission denied"
    try {
      await pool.query(`
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO PUBLIC;
      `);
      console.log("✅ Granted public permissions on all tables and sequences");
    } catch (permErr) {
      console.warn("⚠️ Permission grant notice:", permErr.message);
    }

    // 2. Departments
    await pool.query(`
      INSERT INTO departments (name, description) VALUES
        ('Management', 'Executive Hotel & Restaurant Management'),
        ('Front Desk', 'Reception, Guest Check-In and Room Reservations'),
        ('Service', 'Restaurant and Dining Service Staff'),
        ('Kitchen', 'Main Kitchen Culinary Team'),
        ('Bar', 'Lounge, Cocktails, and Bar Service'),
        ('Finance', 'Accounting, Cashiering, and Financial Audits'),
        ('Human Resources', 'Personnel, Staffing, and Payroll'),
        ('Food & Beverage', 'F&B Cost Control and Stock Audit'),
        ('Purchasing', 'Procurement and Supplier Management'),
        ('Administration', 'General Hotel Operations and Facilities')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 3. Shifts
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_name ON shifts(name);
      INSERT INTO shifts (name, start_time, end_time, description) VALUES
        ('Morning Shift', '07:00', '15:30', 'Morning breakfast and day service'),
        ('Evening Shift', '15:00', '23:30', 'Dinner and evening lounge shift'),
        ('Night Shift', '23:00', '07:30', 'Overnight front desk and security')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 4. Restaurant Tables
    await pool.query(`
      INSERT INTO restaurant_tables (table_number, capacity, location, is_bar_seat, type, section, status) VALUES
        ('T-01', 2, 'Main Dining Hall', FALSE, 'dining', 'DINING', 'available'),
        ('T-02', 4, 'Main Dining Hall', FALSE, 'dining', 'DINING', 'available'),
        ('T-03', 4, 'Main Dining Hall', FALSE, 'dining', 'DINING', 'available'),
        ('T-04', 6, 'Garden Terrace', FALSE, 'dining', 'TERRACE', 'available'),
        ('T-05', 6, 'Garden Terrace', FALSE, 'dining', 'TERRACE', 'available'),
        ('VIP-01', 8, 'Private VIP Lounge', FALSE, 'vip', 'VIP', 'available'),
        ('VIP-02', 10, 'Executive Dining Room', FALSE, 'vip', 'VIP', 'available'),
        ('BAR-01', 1, 'Cocktail Bar Counter', TRUE, 'bar', 'BAR', 'available'),
        ('BAR-02', 1, 'Cocktail Bar Counter', TRUE, 'bar', 'BAR', 'available'),
        ('BAR-03', 1, 'Cocktail Bar Counter', TRUE, 'bar', 'BAR', 'available'),
        ('BAR-04', 1, 'Cocktail Bar Counter', TRUE, 'bar', 'BAR', 'available')
      ON CONFLICT (table_number) DO NOTHING;
    `);

    // 5. Product Categories
    await pool.query(`
      INSERT INTO product_categories (name, description, type) VALUES
        ('Traditional Dishes', 'Authentic Ethiopian breakfast and lunch delicacies', 'food'),
        ('Western & Grill', 'Burgers, sandwiches, steaks, and pizzas', 'food'),
        ('Hot Beverages', 'Traditional coffee ceremonies, espresso, and herbal teas', 'beverage'),
        ('Soft Drinks & Juices', 'Chilled sodas, mineral water, and fresh juices', 'beverage'),
        ('Beers & Ciders', 'Local craft beers, draughts, and premium bottles', 'liquor'),
        ('Wines & Champagnes', 'Rift Valley and imported red, white, and sparkling wines', 'liquor'),
        ('Premium Spirits', 'Single malt whiskeys, vodkas, gins, and rums', 'liquor')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 6. Products & Menu Items
    await pool.query(`
      INSERT INTO products (product_code, name, category_id, description, price, cost_price, unit, is_available, is_active, menu_type) VALUES
        ('FD-001', 'Special Tibs Firfir', (SELECT id FROM product_categories WHERE name = 'Traditional Dishes'), 'Tender spiced beef cubes tossed with fresh injera', 380.00, 180.00, 'plate', TRUE, TRUE, 'both'),
        ('FD-002', 'Doro Wat (Special)', (SELECT id FROM product_categories WHERE name = 'Traditional Dishes'), 'Traditional chicken stew with boiled egg and spiced butter', 520.00, 240.00, 'plate', TRUE, TRUE, 'both'),
        ('FD-003', 'Kasina Club Sandwich', (SELECT id FROM product_categories WHERE name = 'Western & Grill'), 'Triple-decker with grilled chicken, bacon, fried egg, lettuce, fries', 350.00, 150.00, 'portion', TRUE, TRUE, 'both'),
        ('FD-004', 'Kasina Special Burger', (SELECT id FROM product_categories WHERE name = 'Western & Grill'), '200g prime beef patty, cheddar, caramelized onions, fries', 420.00, 190.00, 'portion', TRUE, TRUE, 'both'),
        ('FD-005', 'Margherita Pizza', (SELECT id FROM product_categories WHERE name = 'Western & Grill'), 'Italian tomato sauce, mozzarella, fresh basil, olive oil', 390.00, 160.00, 'pcs', TRUE, TRUE, 'both'),
        
        ('BV-001', 'Ethiopian Single Origin Espresso', (SELECT id FROM product_categories WHERE name = 'Hot Beverages'), 'Double shot fresh Yirgacheffe roast', 60.00, 15.00, 'cup', TRUE, TRUE, 'both'),
        ('BV-002', 'Cappuccino / Cafe Latte', (SELECT id FROM product_categories WHERE name = 'Hot Beverages'), 'Fresh steamed milk with espresso and cinnamon', 90.00, 25.00, 'cup', TRUE, TRUE, 'both'),
        ('BV-003', 'Coca-Cola (330ml Glass)', (SELECT id FROM product_categories WHERE name = 'Soft Drinks & Juices'), 'Chilled Coca-Cola regular bottle', 50.00, 25.00, 'bottle', TRUE, TRUE, 'both'),
        ('BV-004', 'Ambo Mineral Water (500ml)', (SELECT id FROM product_categories WHERE name = 'Soft Drinks & Juices'), 'Sparkling natural mineral water', 45.00, 20.00, 'bottle', TRUE, TRUE, 'both'),
        
        ('LQ-001', 'Habesha Cold Gold Beer', (SELECT id FROM product_categories WHERE name = 'Beers & Ciders'), 'Premium Ethiopian lager 330ml', 90.00, 48.00, 'bottle', TRUE, TRUE, 'both'),
        ('LQ-002', 'St. George Draught Beer', (SELECT id FROM product_categories WHERE name = 'Beers & Ciders'), 'Crisp draught beer glass 500ml', 80.00, 40.00, 'glass', TRUE, TRUE, 'both'),
        ('LQ-003', 'Acacia Medium Sweet Red Wine', (SELECT id FROM product_categories WHERE name = 'Wines & Champagnes'), '750ml Rift Valley Valley vintage', 750.00, 400.00, 'bottle', TRUE, TRUE, 'both'),
        ('LQ-004', 'Jameson Irish Whiskey', (SELECT id FROM product_categories WHERE name = 'Premium Spirits'), 'Triple distilled Irish whiskey bottle 750ml', 3200.00, 1900.00, 'bottle', TRUE, TRUE, 'both'),
        ('LQ-005', 'Absolut Vodka Blue', (SELECT id FROM product_categories WHERE name = 'Premium Spirits'), 'Swedish wheat vodka 750ml', 2600.00, 1500.00, 'bottle', TRUE, TRUE, 'both')
      ON CONFLICT (product_code) DO NOTHING;
    `);

    // 7. Main Inventory
    await pool.query(`
      INSERT INTO inventory (product_id, quantity, minimum_stock, maximum_stock, unit)
      SELECT id, 100.000, 20.000, 500.000, unit FROM products
      ON CONFLICT (product_id) DO UPDATE SET quantity = 100.000;
    `);

    // 8. Department Inventory
    await pool.query(`
      INSERT INTO department_inventory (department, product_id, quantity, minimum_stock, maximum_stock, unit)
      SELECT 'kitchen', id, 25.000, 5.000, 100.000, unit FROM products WHERE product_code LIKE 'FD%'
      ON CONFLICT (department, product_id) DO NOTHING;

      INSERT INTO department_inventory (department, product_id, quantity, minimum_stock, maximum_stock, unit)
      SELECT 'bar', id, 40.000, 10.000, 150.000, unit FROM products WHERE product_code LIKE 'BV%' OR product_code LIKE 'LQ%'
      ON CONFLICT (department, product_id) DO NOTHING;
    `);

    // 9. Suppliers
    await pool.query(`
      INSERT INTO suppliers (supplier_code, name, contact_person, phone, email, address) VALUES
        ('SUP-001', 'East Africa Bottling S.C.', 'Alemayehu Tadesse', '+251911223344', 'sales@coca-cola.et', 'Addis Ababa, Lideta Subcity'),
        ('SUP-002', 'BGI Ethiopia Brewery', 'Binyam Haile', '+251911556677', 'orders@bgiethiopia.com', 'Mexico Square, Addis Ababa'),
        ('SUP-003', 'Awash Winery Share Company', 'Meseret Bekele', '+251911889900', 'distrib@awashwinery.com', 'Mekanisa, Addis Ababa'),
        ('SUP-004', 'Addis Fresh Poultry & Meats', 'Kassahun Zewde', '+251911334455', 'kassahun@addisfresh.et', 'Bole Bulbula, Addis Ababa')
      ON CONFLICT (supplier_code) DO NOTHING;
    `);

    // 10. VIP Customers
    await pool.query(`
      INSERT INTO vip_customers (name, phone, tier, credit_limit, current_debt, company, notes) VALUES
        ('Abdi Mohammed', '+251911010203', 'Platinum VIP', 50000.00, 0.00, 'Horizon Import & Export', 'Prefers Table VIP-01 and sparkling water'),
        ('Dr. Sara Solomon', '+251912040506', 'Gold VIP', 30000.00, 4200.00, 'St. Paul Hospital', 'Corporate billing account active'),
        ('Dawit Kebede', '+251913070809', 'Silver VIP', 15000.00, 0.00, 'Nile Consulting Group', 'Regular weekend executive guest')
      ON CONFLICT (phone) DO NOTHING;
    `);

    // 11. Expense Categories
    await pool.query(`
      INSERT INTO expense_categories (name, description) VALUES
        ('Food & Kitchen Purchases', 'Fresh vegetables, meat, dairy, spices and kitchen staples'),
        ('Beverage & Liquor Stock', 'Bar restock of wines, beers, and premium spirits'),
        ('Utilities & Electricity', 'Generator fuel, electricity, municipal water and waste'),
        ('Hotel Maintenance & Repairs', 'Plumbing, AC maintenance, electrical and carpentry'),
        ('Guest Amenities & Laundry', 'Bed linens, towels, soaps, shampoo, room cleaning chemicals')
      ON CONFLICT (name) DO NOTHING;
    `);

    // 12. Hotel Room Types
    await pool.query(`
      INSERT INTO room_types (name, base_rate, capacity, description, amenities) VALUES
        ('Standard Single Room', 1200.00, 1, 'Cozy single room with queen bed, high-speed Wi-Fi, work desk, and city view', '["Free Wi-Fi", "Queen Bed", "Smart TV", "Work Desk", "En-suite Shower"]'::jsonb),
        ('Deluxe King Room', 1950.00, 2, 'Spacious king bedroom with private balcony, mini-bar, luxury bath amenities', '["Free Wi-Fi", "King Bed", "Private Balcony", "Mini-Bar", "Air Conditioning", "Bathrobes"]'::jsonb),
        ('Executive Suite', 3400.00, 3, 'Luxury corner suite featuring separate living room, king bed, sofa lounge, Jacuzzi', '["High-Speed Wi-Fi", "King Bed", "Living Room", "Jacuzzi", "Mini-Bar", "2x 55inch 4K TV", "Espresso Machine"]'::jsonb),
        ('Presidential Royal Suite', 6800.00, 4, 'Elite panoramic suite with master bedroom, VIP lounge, dining room, and 24h butler', '["Dedicated Butler", "Master King Bed", "Private Dining Area", "Panoramic Balcony", "Jacuzzi", "Wine Bar", "Breakfast Included"]'::jsonb)
      ON CONFLICT (name) DO NOTHING;
    `);

    // 13. Hotel Rooms
    await pool.query(`
      INSERT INTO rooms (room_number, room_type_id, floor, status, notes) VALUES
        ('101', (SELECT id FROM room_types WHERE name = 'Standard Single Room'), 1, 'available', 'Garden facing, quiet room'),
        ('102', (SELECT id FROM room_types WHERE name = 'Standard Single Room'), 1, 'available', 'Recently refurbished bathroom'),
        ('103', (SELECT id FROM room_types WHERE name = 'Deluxe King Room'), 1, 'occupied', 'Guest checked in today'),
        ('104', (SELECT id FROM room_types WHERE name = 'Deluxe King Room'), 1, 'cleaning', 'Housekeeping scheduled for 10am'),
        
        ('201', (SELECT id FROM room_types WHERE name = 'Deluxe King Room'), 2, 'available', 'Pool view, extra pillows'),
        ('202', (SELECT id FROM room_types WHERE name = 'Deluxe King Room'), 2, 'available', 'King bed with reading lamps'),
        ('203', (SELECT id FROM room_types WHERE name = 'Executive Suite'), 2, 'available', 'Connecting door available'),
        ('204', (SELECT id FROM room_types WHERE name = 'Executive Suite'), 2, 'reserved', 'Advance booking arriving tomorrow'),
        
        ('301', (SELECT id FROM room_types WHERE name = 'Executive Suite'), 3, 'available', 'High floor quiet suite'),
        ('302', (SELECT id FROM room_types WHERE name = 'Presidential Royal Suite'), 3, 'available', 'Penthouse panoramic luxury suite')
      ON CONFLICT (room_number) DO NOTHING;
    `);

    // 14. Sample Reservation and Payment
    await pool.query(`
      INSERT INTO room_reservations (
        reservation_code, guest_name, guest_phone, guest_email, guest_id_number,
        room_id, check_in_date, check_out_date, actual_check_in_at,
        adults, children, rate_per_night, total_nights, total_amount, paid_amount,
        payment_status, status, special_requests
      ) VALUES (
        'RES-2026-001',
        'Samuel Berhanu',
        '+251911998877',
        'samuel.b@gmail.com',
        'ID-ETH-987654',
        (SELECT id FROM rooms WHERE room_number = '103'),
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '2 days',
        CURRENT_TIMESTAMP,
        2, 0, 1950.00, 2, 3900.00, 3900.00,
        'paid', 'checked_in', 'Late checkout requested on departure date'
      ) ON CONFLICT (reservation_code) DO NOTHING;

      INSERT INTO room_payments (
        reservation_id, amount, payment_method, payment_type, notes
      ) VALUES (
        (SELECT id FROM room_reservations WHERE reservation_code = 'RES-2026-001'),
        3900.00, 'telebirr', 'payment', 'Full stay paid via Telebirr'
      ) ON CONFLICT DO NOTHING;

      UPDATE rooms SET status = 'occupied' WHERE room_number = '103';
      UPDATE rooms SET status = 'cleaning' WHERE room_number = '104';
      UPDATE rooms SET status = 'reserved' WHERE room_number = '204';
    `);

    console.log("✅ Complete hotel sample data verified/seeded successfully");
  } catch (err) {
    console.warn("⚠️ Sample data seed notice:", err.message);
  }
};

module.exports = seedDatabase;
