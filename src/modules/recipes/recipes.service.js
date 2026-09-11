const pool = require("../../config/database");

/**
 * Get all recipes with product details, calculated ingredient cost, and margins
 */
const getAllRecipes = async () => {
  const query = `
    SELECT 
      r.id,
      r.product_id,
      r.name,
      r.yield_quantity,
      r.preparation_notes,
      r.created_at,
      r.updated_at,
      p.name AS product_name,
      p.product_code,
      p.price AS selling_price,
      p.cost_price AS product_cost_price,
      pc.name AS category_name,
      COUNT(ri.id) AS ingredient_count,
      COALESCE(SUM(ri.quantity * COALESCE(ing.cost_price, ing.price, 0)), 0) AS total_recipe_cost,
      CASE 
        WHEN r.yield_quantity > 0 THEN 
          ROUND(COALESCE(SUM(ri.quantity * COALESCE(ing.cost_price, ing.price, 0)), 0) / r.yield_quantity, 2)
        ELSE 0 
      END AS cost_per_portion,
      CASE 
        WHEN p.price > 0 AND r.yield_quantity > 0 THEN
          ROUND((((COALESCE(SUM(ri.quantity * COALESCE(ing.cost_price, ing.price, 0)), 0) / r.yield_quantity) / p.price) * 100), 1)
        ELSE 0
      END AS food_cost_percentage
    FROM recipes r
    JOIN products p ON r.product_id = p.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN products ing ON ri.ingredient_product_id = ing.id
    GROUP BY r.id, p.id, pc.name
    ORDER BY r.name ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Get recipe details by ID including full ingredient lines
 */
const getRecipeById = async (id) => {
  const recipeQuery = `
    SELECT 
      r.*,
      p.name AS product_name,
      p.product_code,
      p.price AS selling_price,
      p.cost_price AS product_cost_price,
      pc.name AS category_name
    FROM recipes r
    JOIN products p ON r.product_id = p.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE r.id = $1
  `;
  const { rows: recipeRows } = await pool.query(recipeQuery, [id]);
  if (recipeRows.length === 0) return null;

  const recipe = recipeRows[0];

  const ingredientsQuery = `
    SELECT 
      ri.id,
      ri.recipe_id,
      ri.ingredient_product_id,
      ri.quantity,
      ri.unit,
      ri.notes,
      ing.name AS ingredient_name,
      ing.product_code AS ingredient_code,
      ing.cost_price AS ingredient_cost_price,
      ROUND(ri.quantity * COALESCE(ing.cost_price, ing.price, 0), 2) AS subtotal_cost
    FROM recipe_ingredients ri
    JOIN products ing ON ri.ingredient_product_id = ing.id
    WHERE ri.recipe_id = $1
    ORDER BY ri.id ASC
  `;
  const { rows: ingredients } = await pool.query(ingredientsQuery, [id]);
  recipe.ingredients = ingredients;

  // Calculate totals
  const totalCost = ingredients.reduce((sum, item) => sum + Number(item.subtotal_cost || 0), 0);
  recipe.total_recipe_cost = totalCost;
  recipe.cost_per_portion = recipe.yield_quantity > 0 ? Number((totalCost / recipe.yield_quantity).toFixed(2)) : 0;
  recipe.food_cost_percentage = (recipe.selling_price > 0 && recipe.cost_per_portion > 0)
    ? Number(((recipe.cost_per_portion / recipe.selling_price) * 100).toFixed(1))
    : 0;

  return recipe;
};

/**
 * Create a new recipe and its ingredients in a transaction
 */
const createRecipe = async ({ productId, name, yieldQuantity = 1.00, preparationNotes = "", createdBy = null, ingredients = [] }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if recipe for this product already exists
    const existing = await client.query("SELECT id FROM recipes WHERE product_id = $1", [productId]);
    if (existing.rows.length > 0) {
      throw new Error("A recipe for this product already exists. Please update the existing recipe.");
    }

    const recipeInsertQuery = `
      INSERT INTO recipes (product_id, name, yield_quantity, preparation_notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows: [newRecipe] } = await client.query(recipeInsertQuery, [
      productId,
      name,
      yieldQuantity,
      preparationNotes,
      createdBy
    ]);

    // Insert ingredient lines
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      for (const ing of ingredients) {
        if (!ing.ingredientProductId || !ing.quantity) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_product_id, quantity, unit, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [newRecipe.id, ing.ingredientProductId, ing.quantity, ing.unit || "pcs", ing.notes || null]
        );
      }
    }

    await client.query("COMMIT");
    return await getRecipeById(newRecipe.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update an existing recipe
 */
const updateRecipe = async (id, { name, yieldQuantity, preparationNotes, ingredients }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRecipeQuery = `
      UPDATE recipes 
      SET 
        name = COALESCE($1, name),
        yield_quantity = COALESCE($2, yield_quantity),
        preparation_notes = COALESCE($3, preparation_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const { rows } = await client.query(updateRecipeQuery, [name, yieldQuantity, preparationNotes, id]);
    if (rows.length === 0) {
      throw new Error("Recipe not found");
    }

    // If ingredients array provided, replace them
    if (Array.isArray(ingredients)) {
      await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [id]);
      for (const ing of ingredients) {
        if (!ing.ingredientProductId || !ing.quantity) continue;
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_product_id, quantity, unit, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, ing.ingredientProductId, ing.quantity, ing.unit || "pcs", ing.notes || null]
        );
      }
    }

    await client.query("COMMIT");
    return await getRecipeById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete recipe
 */
const deleteRecipe = async (id) => {
  const res = await pool.query("DELETE FROM recipes WHERE id = $1 RETURNING id", [id]);
  return res.rowCount > 0;
};

module.exports = {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe
};
