const express = require("express");
const router = express.Router();
const recipesController = require("./recipes.controller");
const authMiddleware = require("../../middleware/auth.middleware");

router.use(authMiddleware);

router.get("/", recipesController.getRecipes);
router.get("/:id", recipesController.getRecipe);
router.post("/", recipesController.createRecipe);
router.put("/:id", recipesController.updateRecipe);
router.delete("/:id", recipesController.deleteRecipe);

module.exports = router;
