const pool = require("../../config/database");

// =========================================================
// GET ALL CASHIER SHIFTS
// =========================================================

const getCashierShifts = async () => {
  const result = await pool.query(`
    SELECT 
      cs.id,
      cs.cashier_id,
      COALESCE(cs.cashier_name, e.first_name || ' ' || e.last_name, u.username) AS cashier_name,
      cs.terminal_id,
      cs.outlet_id,
      o.name AS outlet_name,
      o.code AS outlet_code,
      p.title AS position_title,
      p.code AS position_code,
      TRIM(CONCAT(sup.first_name, ' ', sup.last_name)) AS supervisor_name,
      cs.start_time,
      cs.end_time,
      cs.opening_cash,
      cs.expected_cash,
      cs.actual_cash,
      cs.shortage_overage,
      cs.total_card_sales,
      cs.total_mobile_sales,
      cs.total_credit_sales,
      cs.total_repayments_cash,
      cs.total_expenses_cash,
      cs.total_refunds_cash,
      cs.total_sales,
      cs.total_orders_count,
      cs.status,
      cs.cashier_notes,
      cs.verified_by,
      COALESCE(cs.verified_by_name, ve.first_name || ' ' || ve.last_name, vu.username) AS verified_by_name,
      cs.verified_at,
      cs.verification_notes,
      cs.created_at,
      cs.updated_at
    FROM cashier_shifts cs
    LEFT JOIN users u ON cs.cashier_id = u.id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN outlets o ON COALESCE(cs.outlet_id, e.outlet_id) = o.id
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN employees sup ON e.reports_to_employee_id = sup.id
    LEFT JOIN users vu ON cs.verified_by = vu.id
    LEFT JOIN employees ve ON ve.user_id = vu.id
    ORDER BY cs.start_time DESC
  `);

  return result.rows.map((row) => ({
    ...row,
    opening_cash: parseFloat(row.opening_cash || 0),
    expected_cash: parseFloat(row.expected_cash || 0),
    actual_cash: parseFloat(row.actual_cash || 0),
    shortage_overage: parseFloat(row.shortage_overage || 0),
    total_card_sales: parseFloat(row.total_card_sales || 0),
    total_mobile_sales: parseFloat(row.total_mobile_sales || 0),
    total_credit_sales: parseFloat(row.total_credit_sales || 0),
    total_repayments_cash: parseFloat(row.total_repayments_cash || 0),
    total_expenses_cash: parseFloat(row.total_expenses_cash || 0),
    total_refunds_cash: parseFloat(row.total_refunds_cash || 0),
    total_sales: parseFloat(row.total_sales || 0),
    total_orders_count: parseInt(row.total_orders_count || 0, 10),
  }));
};


// =========================================================
// GET CASHIER SHIFT BY ID
// =========================================================

const getCashierShiftById = async (id) => {
  const result = await pool.query(
    `
    SELECT 
      cs.id,
      cs.cashier_id,
      COALESCE(cs.cashier_name, e.first_name || ' ' || e.last_name, u.username) AS cashier_name,
      cs.terminal_id,
      cs.outlet_id,
      o.name AS outlet_name,
      o.code AS outlet_code,
      p.title AS position_title,
      p.code AS position_code,
      TRIM(CONCAT(sup.first_name, ' ', sup.last_name)) AS supervisor_name,
      cs.start_time,
      cs.end_time,
      cs.opening_cash,
      cs.expected_cash,
      cs.actual_cash,
      cs.shortage_overage,
      cs.total_card_sales,
      cs.total_mobile_sales,
      cs.total_credit_sales,
      cs.total_repayments_cash,
      cs.total_expenses_cash,
      cs.total_refunds_cash,
      cs.total_sales,
      cs.total_orders_count,
      cs.status,
      cs.cashier_notes,
      cs.verified_by,
      COALESCE(cs.verified_by_name, ve.first_name || ' ' || ve.last_name, vu.username) AS verified_by_name,
      cs.verified_at,
      cs.verification_notes,
      cs.created_at,
      cs.updated_at
    FROM cashier_shifts cs
    LEFT JOIN users u ON cs.cashier_id = u.id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN users vu ON cs.verified_by = vu.id
    LEFT JOIN employees ve ON ve.user_id = vu.id
    WHERE cs.id = $1
    `,
    [id]
  );

  const shift = result.rows[0];
  if (!shift) return null;

  // Fetch payments breakdown for this shift
  const breakdownResult = await pool.query(
    `
    SELECT 
      payment_method, 
      COUNT(*) AS transactions_count, 
      COALESCE(SUM(amount), 0) AS total_amount
    FROM payments
    WHERE (received_by = $1 OR cashier_shift_id = $4)
      AND status = 'paid'
      AND paid_at >= $2
      AND ($3::timestamp IS NULL OR paid_at <= $3::timestamp)
    GROUP BY payment_method
    ORDER BY total_amount DESC
    `,
    [shift.cashier_id, shift.start_time, shift.end_time, shift.id]
  );

  return {
    ...shift,
    opening_cash: parseFloat(shift.opening_cash || 0),
    expected_cash: parseFloat(shift.expected_cash || 0),
    actual_cash: parseFloat(shift.actual_cash || 0),
    shortage_overage: parseFloat(shift.shortage_overage || 0),
    total_card_sales: parseFloat(shift.total_card_sales || 0),
    total_mobile_sales: parseFloat(shift.total_mobile_sales || 0),
    total_credit_sales: parseFloat(shift.total_credit_sales || 0),
    total_repayments_cash: parseFloat(shift.total_repayments_cash || 0),
    total_expenses_cash: parseFloat(shift.total_expenses_cash || 0),
    total_refunds_cash: parseFloat(shift.total_refunds_cash || 0),
    total_sales: parseFloat(shift.total_sales || 0),
    total_orders_count: parseInt(shift.total_orders_count || 0, 10),
    payments_breakdown: breakdownResult.rows.map((b) => ({
      paymentMethod: b.payment_method,
      transactionsCount: parseInt(b.transactions_count, 10),
      totalAmount: parseFloat(b.total_amount),
    })),
  };
};


// =========================================================
// VERIFY / RECONCILE CASHIER SHIFT
// =========================================================

const verifyCashierShift = async (id, status, notes, verifiedBy, verifiedByName = null) => {
  const result = await pool.query(
    `
    UPDATE cashier_shifts
    SET 
      status = $1,
      verification_notes = $2,
      verified_by = $3,
      verified_by_name = COALESCE($4, verified_by_name),
      verified_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
    `,
    [status, notes || null, verifiedBy || null, verifiedByName || null, id]
  );

  return result.rows[0];
};


// =========================================================
// GET UNIFIED HOTEL FINANCE OVERVIEW (P&L, REVENUE, EXPENSES)
// =========================================================

const getFinanceOverview = async (filters = {}) => {
  const { timeframe = "all", startDate, endDate } = filters;

  // Build SQL date condition generator
  const buildDateCondition = (dateCol, paramOffset = 1) => {
    if (startDate && endDate) {
      return {
        clause: ` AND ${dateCol}::date >= $${paramOffset} AND ${dateCol}::date <= $${paramOffset + 1}`,
        params: [startDate, endDate],
      };
    } else if (timeframe === "today") {
      return {
        clause: ` AND ${dateCol}::date = CURRENT_DATE`,
        params: [],
      };
    } else if (timeframe === "week") {
      return {
        clause: ` AND ${dateCol}::date >= CURRENT_DATE - INTERVAL '7 days'`,
        params: [],
      };
    } else if (timeframe === "month") {
      return {
        clause: ` AND ${dateCol}::date >= CURRENT_DATE - INTERVAL '30 days'`,
        params: [],
      };
    }
    return { clause: "", params: [] };
  };

  // 1. Room Revenue Aggregation (from room_reservations)
  const roomDate = buildDateCondition("COALESCE(actual_check_in_at, check_in_date, created_at)");
  const roomSql = `
    SELECT 
      COALESCE(SUM(paid_amount), 0)::float AS total_paid,
      COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE GREATEST(0, total_amount - paid_amount) END), 0)::float AS total_unpaid,
      COUNT(id)::int AS total_reservations,
      COUNT(CASE WHEN status = 'checked_in' THEN 1 END)::int AS active_checked_in
    FROM room_reservations
    WHERE status != 'cancelled' ${roomDate.clause}
  `;
  const roomRes = await pool.query(roomSql, roomDate.params).catch((err) => {
    console.error("Error aggregating rooms in financial overview:", err.message);
    return { rows: [{ total_paid: 0, total_unpaid: 0, total_reservations: 0, active_checked_in: 0 }] };
  });
  const roomData = roomRes.rows[0] || {};

  // 2. F&B / POS Orders Revenue Aggregation (from orders - column is "total")
  const orderDate = buildDateCondition("created_at");
  const orderSql = `
    SELECT 
      COALESCE(SUM(CASE WHEN payment_status::text = 'paid' THEN total ELSE 0 END), 0)::float AS total_paid,
      COALESCE(SUM(CASE WHEN payment_status::text != 'paid' THEN total ELSE 0 END), 0)::float AS total_unpaid,
      COUNT(id)::int AS total_orders
    FROM orders
    WHERE status::text != 'cancelled' ${orderDate.clause}
  `;
  const orderRes = await pool.query(orderSql, orderDate.params).catch((err) => {
    console.error("Error aggregating orders in financial overview:", err.message);
    return { rows: [{ total_paid: 0, total_unpaid: 0, total_orders: 0 }] };
  });
  const orderData = orderRes.rows[0] || {};

  // 2b. Room Payments Breakdown (from room_payments table)
  const roomPayDate = buildDateCondition("created_at");
  const roomPaySql = `
    SELECT 
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, 'cash')) = 'cash' THEN amount ELSE 0 END), 0)::float AS cash_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('telebirr', 'tele_birr') THEN amount ELSE 0 END), 0)::float AS telebirr_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('cbe_birr', 'cbebirr', 'cbe') THEN amount ELSE 0 END), 0)::float AS cbe_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('card', 'pos', 'visa', 'mastercard') THEN amount ELSE 0 END), 0)::float AS card_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('bank_transfer', 'bank', 'transfer') THEN amount ELSE 0 END), 0)::float AS bank_paid
    FROM room_payments
    WHERE 1=1 ${roomPayDate.clause}
  `;
  const roomPayRes = await pool.query(roomPaySql, roomPayDate.params).catch(() => ({ rows: [{}] }));
  const roomPayData = roomPayRes.rows[0] || {};

  // 2c. Order / POS Payments Breakdown (from payments table)
  const posPayDate = buildDateCondition("COALESCE(paid_at, created_at)");
  const posPaySql = `
    SELECT 
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, 'cash')) = 'cash' THEN amount ELSE 0 END), 0)::float AS cash_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('telebirr', 'tele_birr') THEN amount ELSE 0 END), 0)::float AS telebirr_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('cbe_birr', 'cbebirr', 'cbe') THEN amount ELSE 0 END), 0)::float AS cbe_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('card', 'pos', 'visa') THEN amount ELSE 0 END), 0)::float AS card_paid,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_method, '')) IN ('bank_transfer', 'bank') THEN amount ELSE 0 END), 0)::float AS bank_paid
    FROM payments
    WHERE status = 'paid' ${posPayDate.clause}
  `;
  const posPayRes = await pool.query(posPaySql, posPayDate.params).catch(() => ({ rows: [{}] }));
  const posPayData = posPayRes.rows[0] || {};

  // 3. Expenses Aggregation
  const expDate = buildDateCondition("COALESCE(expense_date, created_at)");
  const expSql = `
    SELECT 
      COALESCE(SUM(amount), 0)::float AS total_expenses,
      COUNT(id)::int AS count_expenses
    FROM expenses
    WHERE 1=1 ${expDate.clause}
  `;
  const expRes = await pool.query(expSql, expDate.params).catch(() => ({ rows: [{ total_expenses: 0, count_expenses: 0 }] }));
  const expData = expRes.rows[0] || {};

  // 4. Expenses by Category
  const expCatSql = `
    SELECT 
      COALESCE(ec.name, 'Uncategorized') AS category_name,
      COALESCE(SUM(e.amount), 0)::float AS total_amount
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    WHERE 1=1 ${expDate.clause}
    GROUP BY ec.name
    ORDER BY total_amount DESC
    LIMIT 6
  `;
  const expCatRes = await pool.query(expCatSql, expDate.params).catch(() => ({ rows: [] }));

  // 5. Purchases Aggregation
  const purDate = buildDateCondition("COALESCE(purchase_date, created_at)");
  const purSql = `
    SELECT 
      COALESCE(SUM(COALESCE(paid_amount, total)), 0)::float AS total_purchases,
      COUNT(id)::int AS count_purchases
    FROM purchase_orders
    WHERE status != 'cancelled' ${purDate.clause}
  `;
  const purRes = await pool.query(purSql, purDate.params).catch(() => ({ rows: [{ total_purchases: 0, count_purchases: 0 }] }));
  const purData = purRes.rows[0] || {};

  // Totals & P&L calculations
  const roomRevenue = parseFloat(roomData.total_paid || 0);
  const posRevenue = parseFloat(orderData.total_paid || 0);
  const totalRevenue = roomRevenue + posRevenue;

  const totalExpenses = parseFloat(expData.total_expenses || 0);
  const totalPurchases = parseFloat(purData.total_purchases || 0);
  const totalOutflows = totalExpenses + totalPurchases;

  const netOperatingIncome = totalRevenue - totalOutflows;
  const profitMargin = totalRevenue > 0 ? parseFloat(((netOperatingIncome / totalRevenue) * 100).toFixed(1)) : 0;

  const paymentMethods = {
    cash: (roomPayData.cash_paid || 0) + (posPayData.cash_paid || 0),
    telebirr: (roomPayData.telebirr_paid || 0) + (posPayData.telebirr_paid || 0),
    cbeBirr: (roomPayData.cbe_paid || 0) + (posPayData.cbe_paid || 0),
    card: (roomPayData.card_paid || 0) + (posPayData.card_paid || 0),
    bankTransfer: (roomPayData.bank_paid || 0) + (posPayData.bank_paid || 0),
  };

  return {
    timeframe,
    startDate: startDate || null,
    endDate: endDate || null,
    summary: {
      totalRevenue,
      roomRevenue,
      posRevenue,
      totalExpenses,
      totalPurchases,
      totalOutflows,
      netOperatingIncome,
      profitMargin,
    },
    paymentMethods,
    channels: {
      rooms: {
        totalPaid: roomRevenue,
        totalUnpaid: parseFloat(roomData.total_unpaid || 0),
        reservationsCount: parseInt(roomData.total_reservations || 0, 10),
        activeCheckedIn: parseInt(roomData.active_checked_in || 0, 10),
      },
      pos: {
        totalPaid: posRevenue,
        totalUnpaid: parseFloat(orderData.total_unpaid || 0),
        ordersCount: parseInt(orderData.total_orders || 0, 10),
      },
    },
    expensesByCategory: expCatRes.rows,
  };
};

// =========================================================
// EXPORT
// =========================================================

module.exports = {
  getCashierShifts,
  getCashierShiftById,
  verifyCashierShift,
  getFinanceOverview,
};
