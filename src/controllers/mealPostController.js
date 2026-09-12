const prisma = require("../utils/prisma");

// GET /meals — public, only shows available meals to customers
async function listPublishedMeals(req, res) {
  try {
    const meals = await prisma.mealPost.findMany({
      where: { isAvailable: true },
      include: { images: true, vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(meals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch meal posts" });
  }
}

// GET /meals/mine — vendor's own posts, including unavailable ones
async function listVendorMeals(req, res) {
  try {
    const meals = await prisma.mealPost.findMany({
      where: { vendorId: req.vendorId },
      include: { images: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(meals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch your meal posts" });
  }
}

// GET /meals/:id
async function getMealById(req, res) {
  try {
    const meal = await prisma.mealPost.findUnique({
      where: { id: req.params.id },
      include: { images: true, vendor: { select: { id: true, name: true } } },
    });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    res.json(meal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch meal post" });
  }
}

// POST /meals — vendor creates a meal post; expects multipart form with "images" files
async function createMeal(req, res) {
  try {
    const { description, price } = req.body;

    if (!description || !price) {
      return res.status(400).json({ error: "description and price are required" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    const meal = await prisma.mealPost.create({
      data: {
        description,
        price: parseFloat(price),
        vendorId: req.vendorId,
        images: {
          create: req.files.map((file) => ({ imageUrl: `/uploads/${file.filename}` })),
        },
      },
      include: { images: true },
    });

    res.status(201).json(meal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create meal post" });
  }
}

// PUT /meals/:id — vendor updates description/price (and optionally adds more images)
async function updateMeal(req, res) {
  try {
    const meal = await prisma.mealPost.findUnique({ where: { id: req.params.id } });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (meal.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "You don't own this meal post" });
    }

    const { description, price } = req.body;
    const newImages = req.files && req.files.length > 0
      ? { create: req.files.map((file) => ({ imageUrl: `/uploads/${file.filename}` })) }
      : undefined;

    const updated = await prisma.mealPost.update({
      where: { id: req.params.id },
      data: {
        ...(description && { description }),
        ...(price && { price: parseFloat(price) }),
        ...(newImages && { images: newImages }),
      },
      include: { images: true },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update meal post" });
  }
}

// PATCH /meals/:id/availability — toggle available/unavailable
async function updateAvailability(req, res) {
  try {
    const meal = await prisma.mealPost.findUnique({ where: { id: req.params.id } });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (meal.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "You don't own this meal post" });
    }

    const { isAvailable } = req.body;
    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({ error: "isAvailable must be true or false" });
    }

    const updated = await prisma.mealPost.update({
      where: { id: req.params.id },
      data: { isAvailable },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update availability" });
  }
}

// DELETE /meals/:id
async function deleteMeal(req, res) {
  try {
    const meal = await prisma.mealPost.findUnique({ where: { id: req.params.id } });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (meal.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "You don't own this meal post" });
    }

    await prisma.mealPost.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete meal post" });
  }
}

module.exports = {
  listPublishedMeals,
  listVendorMeals,
  getMealById,
  createMeal,
  updateMeal,
  updateAvailability,
  deleteMeal,
};
