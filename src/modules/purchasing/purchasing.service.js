const pool = require("../../config/database");

// ============================================================
// SUPPLIERS
// ============================================================

// Get all suppliers
const getAllSuppliers = async () => {
  const result = await pool.query(`
    SELECT
      id,
      supplier_code,
      name,
      contact_person,
      phone,
      email,
      address,
      tax_number,
      status,
      created_at,
      updated_at
    FROM suppliers
    ORDER BY name ASC
  `);

  return result.rows;
};


// Get supplier by ID
const getSupplierById = async (id) => {
  const result = await pool.query(
    `
    SELECT *
    FROM suppliers
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0];
};


// Create supplier
const createSupplier = async (data) => {
  const {
    supplierCode,
    name,
    contactPerson,
    phone,
    email,
    address,
    taxNumber,
    status,
  } = data;

  const result = await pool.query(
    `
    INSERT INTO suppliers (
      supplier_code,
      name,
      contact_person,
      phone,
      email,
      address,
      tax_number,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
    `,
    [
      supplierCode || null,
      name,
      contactPerson || null,
      phone || null,
      email || null,
      address || null,
      taxNumber || null,
      status || "active",
    ]
  );

  return result.rows[0];
};


// ============================================================
// PURCHASE ORDERS
// ============================================================

// Get all purchase orders
const getAllPurchases = async () => {
  const result = await pool.query(`
    SELECT
      po.id,
      po.purchase_number,
      po.supplier_id,
      po.purchase_date,
      po.expected_date,
      po.subtotal,
      po.tax,
      po.discount,
      po.total,
      po.status,
      po.payment_status,
      po.payment_method,
      po.paid_amount,
      po.paid_at,
      po.notes,
      po.created_at,
      po.updated_at,

      s.name AS supplier_name,

      COALESCE(
        json_agg(
          json_build_object(
            'id', poi.id,
            'productId', poi.product_id,
            'product_id', poi.product_id,
            'name', p.name,
            'product_name', p.name,
            'quantity', poi.quantity,
            'unit_price', poi.unit_price,
            'total', poi.total,
            'unit', p.unit,
            'received_quantity', poi.received_quantity,
            'category_name', pc.name,
            'category_type', pc.type
          )
        ) FILTER (WHERE poi.id IS NOT NULL),
        '[]'
      ) AS items,

      COALESCE(SUM(poi.quantity), 0) AS total_items,
      COALESCE(COUNT(poi.id), 0) AS items_count

    FROM purchase_orders po

    LEFT JOIN suppliers s
      ON po.supplier_id = s.id

    LEFT JOIN purchase_order_items poi
      ON po.id = poi.purchase_order_id

    LEFT JOIN products p
      ON poi.product_id = p.id

    LEFT JOIN product_categories pc
      ON p.category_id = pc.id

    GROUP BY po.id, s.name

    ORDER BY po.created_at DESC
  `);

  return result.rows;
};


// Get purchase order with items
const getPurchaseById = async (id) => {
  const purchaseResult = await pool.query(
    `
    SELECT
      po.*,
      s.name AS supplier_name,
      s.phone AS supplier_phone,
      s.email AS supplier_email

    FROM purchase_orders po

    LEFT JOIN suppliers s
      ON po.supplier_id = s.id

    WHERE po.id = $1
    `,
    [id]
  );

  if (purchaseResult.rows.length === 0) {
    return null;
  }

  const itemsResult = await pool.query(
    `
    SELECT
      poi.id,
      poi.purchase_order_id,
      poi.product_id,
      poi.quantity,
      poi.unit_price,
      poi.total,
      poi.received_quantity,

      p.name AS product_name,
      p.product_code,
      p.unit

    FROM purchase_order_items poi

    INNER JOIN products p
      ON poi.product_id = p.id

    WHERE poi.purchase_order_id = $1

    ORDER BY poi.id ASC
    `,
    [id]
  );

  return {
    ...purchaseResult.rows[0],
    items: itemsResult.rows,
  };
};


// ============================================================
// CREATE PURCHASE ORDER
// ============================================================

const createPurchase = async (data) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      purchaseNumber,
      supplierId,
      purchaseDate,
      expectedDate,
      tax,
      discount,
      notes,
      createdBy,
      paymentStatus,
      paymentMethod,
      items,
    } = data;

    if (!items || items.length === 0) {
      throw new Error("Purchase order must contain at least one item");
    }

    let subtotal = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (quantity <= 0 || unitPrice < 0) {
        throw new Error("Invalid purchase item quantity or price");
      }

      subtotal += quantity * unitPrice;
    }

    const taxAmount = Number(tax || 0);
    const discountAmount = Number(discount || 0);

    const total =
      subtotal +
      taxAmount -
      discountAmount;

    const isPaid = paymentStatus === "paid";

    const purchaseResult = await client.query(
      `
      INSERT INTO purchase_orders (
        purchase_number,
        supplier_id,
        purchase_date,
        expected_date,
        subtotal,
        tax,
        discount,
        total,
        status,
        payment_status,
        payment_method,
        paid_amount,
        paid_at,
        notes,
        created_by
      )
      VALUES (
        $1,$2,
        COALESCE($3,CURRENT_DATE),
        $4,$5,$6,$7,$8,
        'ordered',
        $9,$10,$11,$12,$13,$14
      )
      RETURNING *
      `,
      [
        purchaseNumber,
        supplierId || null,
        purchaseDate || null,
        expectedDate || null,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        paymentStatus || "credit",
        paymentMethod || "cash",
        isPaid ? total : 0,
        isPaid ? new Date() : null,
        notes || null,
        createdBy || null,
      ]
    );

    const purchase = purchaseResult.rows[0];

    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const itemTotal = quantity * unitPrice;

      await client.query(
        `
        INSERT INTO purchase_order_items (
          purchase_order_id,
          product_id,
          quantity,
          unit_price,
          total,
          received_quantity
        )
        VALUES ($1,$2,$3,$4,$5,0)
        `,
        [
          purchase.id,
          item.productId,
          quantity,
          unitPrice,
          itemTotal,
        ]
      );
    }

    await client.query("COMMIT");

    return getPurchaseById(purchase.id);

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
};


// ============================================================
// UPDATE PURCHASE ORDER
// ============================================================

const updatePurchase = async (id, data) => {
  const {
    supplierId,
    expectedDate,
    tax,
    discount,
    notes,
    status,
    paymentStatus,
    paymentMethod,
  } = data;

  const result = await pool.query(
    `
    UPDATE purchase_orders
    SET
      supplier_id = COALESCE($1, supplier_id),
      expected_date = COALESCE($2, expected_date),
      tax = COALESCE($3, tax),
      discount = COALESCE($4, discount),
      notes = COALESCE($5, notes),
      status = COALESCE($6, status),
      payment_status = COALESCE($7, payment_status),
      payment_method = COALESCE($8, payment_method),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
    `,
    [
      supplierId,
      expectedDate,
      tax,
      discount,
      notes,
      status,
      paymentStatus,
      paymentMethod,
      id,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return getPurchaseById(id);
};


// ============================================================
// RECEIVE PURCHASE
// ============================================================

const receivePurchase = async (purchaseId, userId, options = {}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock purchase order
    const purchaseResult = await client.query(
      `
      SELECT *
      FROM purchase_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [purchaseId]
    );

    if (purchaseResult.rows.length === 0) {
      throw new Error("Purchase order not found");
    }

    const purchase = purchaseResult.rows[0];

    if (purchase.status === "received") {
      throw new Error("Purchase order has already been received");
    }

    if (purchase.status === "cancelled") {
      throw new Error("Cancelled purchase cannot be received");
    }

    // Get items
    const itemsResult = await client.query(
      `
      SELECT *
      FROM purchase_order_items
      WHERE purchase_order_id = $1
      FOR UPDATE
      `,
      [purchaseId]
    );

    if (itemsResult.rows.length === 0) {
      throw new Error("Purchase order has no items");
    }

    let allFulfilled = true;

    for (const item of itemsResult.rows) {
      const remainingQuantity =
        Number(item.quantity) -
        Number(item.received_quantity || 0);

      if (remainingQuantity <= 0) {
        continue;
      }

      // Check if partial quantity specified in options
      let qtyToReceive = remainingQuantity;
      if (options.receivedItems && Array.isArray(options.receivedItems)) {
        const itemOption = options.receivedItems.find(
          (r) => Number(r.productId || r.product_id) === Number(item.product_id)
        );
        if (itemOption && itemOption.quantity !== undefined) {
          qtyToReceive = Math.min(Number(itemOption.quantity), remainingQuantity);
        }
      }

      if (qtyToReceive <= 0) {
        allFulfilled = false;
        continue;
      }

      if (qtyToReceive < remainingQuantity) {
        allFulfilled = false;
      }

      // Make sure inventory exists
      const inventoryResult = await client.query(
        `
        SELECT *
        FROM inventory
        WHERE product_id = $1
        FOR UPDATE
        `,
        [item.product_id]
      );

      if (inventoryResult.rows.length === 0) {
        // Create inventory automatically
        await client.query(
          `
          INSERT INTO inventory (
            product_id,
            quantity,
            minimum_stock,
            unit
          )
          VALUES ($1,$2,0,'pcs')
          `,
          [
            item.product_id,
            qtyToReceive,
          ]
        );

      } else {
        // Increase existing inventory
        await client.query(
          `
          UPDATE inventory
          SET
            quantity = quantity + $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE product_id = $2
          `,
          [
            qtyToReceive,
            item.product_id,
          ]
        );
      }

      // Inventory transaction
      await client.query(
        `
        INSERT INTO inventory_transactions (
          product_id,
          transaction_type,
          quantity,
          reference_type,
          reference_id,
          notes,
          created_by
        )
        VALUES (
          $1,
          'stock_in',
          $2,
          'purchase',
          $3,
          $4,
          $5
        )
        `,
        [
          item.product_id,
          qtyToReceive,
          purchaseId,
          options.notes || 'Stock received from purchase order',
          userId || null,
        ]
      );

      // Update received quantity on purchase order item
      await client.query(
        `
        UPDATE purchase_order_items
        SET received_quantity = received_quantity + $1
        WHERE id = $2
        `,
        [qtyToReceive, item.id]
      );
    }

    // Determine target status
    const finalStatus = allFulfilled ? 'received' : 'partially_received';

    // Update verified_by, verified_at and status
    const updatedPurchase = await client.query(
      `
      UPDATE purchase_orders
      SET
        status = $1,
        verified_by = $2,
        verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
      `,
      [finalStatus, userId || null, purchaseId]
    );

    await client.query("COMMIT");

    return updatedPurchase.rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
};


  // ============================================================
  // DELETE / CANCEL PURCHASE
  // ============================================================

  const cancelPurchase = async (id) => {
    const result = await pool.query(
      `
      UPDATE purchase_orders
      SET
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status NOT IN ('received', 'cancelled')
      RETURNING *
      `,
      [id]
    );

    return result.rows[0];
  };


  // ============================================================
  // PAY / MARK AS PAID PURCHASE ORDER
  // ============================================================

  const payPurchase = async (id, paymentMethod = "cash") => {
    const result = await pool.query(
      `
      UPDATE purchase_orders
      SET
        payment_status = 'paid',
        payment_method = COALESCE($1, payment_method, 'cash'),
        paid_amount = total,
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [paymentMethod, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return getPurchaseById(id);
  };


  // ============================================================
  // PURCHASE REQUESTS (DEPARTMENT / OUTLET REQUISITIONS)
  // ============================================================

  const getAllPurchaseRequests = async (filters = {}) => {
    let query = `
      SELECT 
        pr.*,
        d.name AS department_name,
        d.code AS department_code,
        o.name AS outlet_name,
        o.code AS outlet_code,
        u.username AS requested_by_username,
        CONCAT(e.first_name, ' ', e.last_name) AS requested_by_name,
        ru.username AS reviewed_by_username,
        (SELECT COUNT(*)::int FROM purchase_request_items pri WHERE pri.purchase_request_id = pr.id) AS items_count,
        (SELECT COALESCE(SUM(pri.quantity * pri.estimated_price), 0) FROM purchase_request_items pri WHERE pri.purchase_request_id = pr.id) AS estimated_total
      FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN outlets o ON pr.outlet_id = o.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN users ru ON pr.reviewed_by = ru.id
    `;

    const conditions = [];
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`pr.status = $${params.length}`);
    }

    if (filters.departmentId) {
      params.push(Number(filters.departmentId));
      conditions.push(`pr.department_id = $${params.length}`);
    }

    if (filters.outletId) {
      params.push(Number(filters.outletId));
      conditions.push(`pr.outlet_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY pr.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  };

  const getPurchaseRequestById = async (id) => {
    const prResult = await pool.query(
      `
      SELECT 
        pr.*,
        d.name AS department_name,
        d.code AS department_code,
        o.name AS outlet_name,
        o.code AS outlet_code,
        u.username AS requested_by_username,
        CONCAT(e.first_name, ' ', e.last_name) AS requested_by_name,
        ru.username AS reviewed_by_username
      FROM purchase_requests pr
      LEFT JOIN departments d ON pr.department_id = d.id
      LEFT JOIN outlets o ON pr.outlet_id = o.id
      LEFT JOIN users u ON pr.requested_by = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN users ru ON pr.reviewed_by = ru.id
      WHERE pr.id = $1
      `,
      [id]
    );

    if (prResult.rows.length === 0) return null;

    const itemsResult = await pool.query(
      `
      SELECT 
        pri.*,
        p.name AS product_name,
        p.product_code,
        p.price,
        p.cost_price
      FROM purchase_request_items pri
      JOIN products p ON pri.product_id = p.id
      WHERE pri.purchase_request_id = $1
      ORDER BY pri.id ASC
      `,
      [id]
    );

    return {
      ...prResult.rows[0],
      items: itemsResult.rows,
    };
  };

  const createPurchaseRequest = async (data, userId) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { departmentId, outletId, priority, notes, items } = data;

      if (!items || items.length === 0) {
        throw new Error("Purchase request must include at least one item");
      }

      // Generate request number: PR-YYYYMMDD-XXXX
      const countRes = await client.query("SELECT COUNT(*) FROM purchase_requests");
      const count = parseInt(countRes.rows[0].count, 10) + 1;
      const requestNumber = `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count).padStart(3, "0")}`;

      const prResult = await client.query(
        `
        INSERT INTO purchase_requests (
          request_number,
          department_id,
          outlet_id,
          requested_by,
          priority,
          notes,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *
        `,
        [
          requestNumber,
          departmentId || null,
          outletId || null,
          userId || null,
          priority || "normal",
          notes || null,
        ]
      );

      const request = prResult.rows[0];

      for (const item of items) {
        await client.query(
          `
          INSERT INTO purchase_request_items (
            purchase_request_id,
            product_id,
            quantity,
            unit,
            estimated_price,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            request.id,
            item.productId || item.product_id,
            Number(item.quantity),
            item.unit || "pcs",
            Number(item.estimatedPrice || item.estimated_price || 0),
            item.notes || null,
          ]
        );
      }

      await client.query("COMMIT");
      return getPurchaseRequestById(request.id);

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const reviewPurchaseRequest = async (id, reviewData, userId) => {
    const { status, rejectionReason } = reviewData;

    if (!["approved", "rejected"].includes(status)) {
      throw new Error("Invalid status. Allowed values: 'approved', 'rejected'");
    }

    const result = await pool.query(
      `
      UPDATE purchase_requests
      SET 
        status = $1,
        reviewed_by = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
      `,
      [status, userId || null, rejectionReason || null, id]
    );

    if (result.rows.length === 0) {
      throw new Error("Purchase request not found");
    }

    return getPurchaseRequestById(id);
  };

  module.exports = {
    getAllSuppliers,
    getSupplierById,
    createSupplier,

    getAllPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    receivePurchase,
    cancelPurchase,
    payPurchase,

    getAllPurchaseRequests,
    getPurchaseRequestById,
    createPurchaseRequest,
    reviewPurchaseRequest,
  };
