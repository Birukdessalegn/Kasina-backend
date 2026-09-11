const recipesService = require("./recipes.service");

const getRecipes = async (req, res) => {
  try {
    const recipes = await recipesService.getAllRecipes();
    res.json({ success: true, data: recipes });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRecipe = async (req, res) => {
  try {
    const recipe = await recipesService.getRecipeById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }
    res.json({ success: true, data: recipe });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createRecipe = async (req, res) => {
  try {
    const { productId, name, yieldQuantity, preparationNotes, ingredients } = req.body;
    if (!productId || !name) {
      return res.status(400).json({ success: false, message: "Product ID and recipe name are required" });
    }
    const createdBy = req.user?.id || null;
    const newRecipe = await recipesService.createRecipe({
      productId,
      name,
      yieldQuantity,
      preparationNotes,
      createdBy,
      ingredients
    });
    res.status(201).json({ success: true, data: newRecipe });
  } catch (error) {
    console.error("Error creating recipe:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateRecipe = async (req, res) => {
  try {
    const updated = await recipesService.updateRecipe(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating recipe:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    const success = await recipesService.deleteRecipe(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: "Recipe not found" });
    }
    res.json({ success: true, message: "Recipe deleted successfully" });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe
};
