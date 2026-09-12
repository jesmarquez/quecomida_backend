const express = require("express");
const { requireVendorAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  listPublishedMeals,
  listVendorMeals,
  getMealById,
  createMeal,
  updateMeal,
  updateAvailability,
  deleteMeal,
} = require("../controllers/mealPostController");

const router = express.Router();

// Public — customer-facing "Published Meal Posts" page
router.get("/", listPublishedMeals);

// Vendor-only — must come before "/:id" so "mine" isn't treated as an id param
router.get("/mine", requireVendorAuth, listVendorMeals);

router.get("/:id", getMealById);

router.post("/", requireVendorAuth, upload.array("images", 5), createMeal);
router.put("/:id", requireVendorAuth, upload.array("images", 5), updateMeal);
router.patch("/:id/availability", requireVendorAuth, updateAvailability);
router.delete("/:id", requireVendorAuth, deleteMeal);

module.exports = router;
