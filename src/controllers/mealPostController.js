const prisma = require("../utils/prisma");
const { uploadFiles, deleteImage } = require("../utils/cloudinary");

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
    const { title, description, price, isAvailable, dietaryTags, customTags } = req.body;

    if (!title || !description || !price) {
      return res.status(400).json({ error: "title, description, and price are required" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    const uploaded = await uploadFiles(req.files);

    try {
      const meal = await prisma.mealPost.create({
        data: {
          title,
          description,
          price: parseFloat(price),
          isAvailable: isAvailable === "true",
          dietaryTags: dietaryTags ? JSON.parse(dietaryTags) : [],
          customTags: customTags ? JSON.parse(customTags) : [],
          vendorId: req.vendorId,
          images: { create: uploaded },
        },
        include: { images: true },
      });
      res.status(201).json(meal);
    } catch (err) {
      // the database write failed, so don't leave orphaned uploads in Cloudinary
      await Promise.all(uploaded.map((i) => deleteImage(i.publicId)));
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create meal post" });
  }
}

// PUT /meals/:id — vendor updates fields, optionally removes existing images, optionally adds new ones
async function updateMeal(req, res) {
  try {
    const meal = await prisma.mealPost.findUnique({
      where: { id: req.params.id },
      include: { images: true },
    });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (meal.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "You don't own this meal post" });
    }

    const { title, description, price, isAvailable, dietaryTags, customTags, removedImageIds } = req.body;

    const idsToRemove = removedImageIds ? JSON.parse(removedImageIds) : [];
    const imagesToDelete = meal.images.filter((img) => idsToRemove.includes(img.id));
    const uploaded = req.files && req.files.length > 0 ? await uploadFiles(req.files) : [];

    const imagesOp = {};
    if (idsToRemove.length > 0) imagesOp.deleteMany = { id: { in: idsToRemove } };
    if (uploaded.length > 0) imagesOp.create = uploaded;

    try {
      const updated = await prisma.mealPost.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(description && { description }),
          ...(price && { price: parseFloat(price) }),
          ...(isAvailable !== undefined && { isAvailable: isAvailable === "true" }),
          ...(dietaryTags && { dietaryTags: JSON.parse(dietaryTags) }),
          ...(customTags && { customTags: JSON.parse(customTags) }),
          ...(Object.keys(imagesOp).length > 0 && { images: imagesOp }),
        },
        include: { images: true },
      });

      // only delete the old images from Cloudinary once the database update succeeded
      await Promise.all(imagesToDelete.map((img) => deleteImage(img.publicId)));
      res.json(updated);
    } catch (err) {
      await Promise.all(uploaded.map((i) => deleteImage(i.publicId)));
      throw err;
    }
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
    const meal = await prisma.mealPost.findUnique({ 
      where: { id: req.params.id }, 
      include: { images: true },
    });

    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (meal.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "You don't own this meal post" });
    }

    
    const orderCount = await prisma.order.count({ where: { mealPostId: req.params.id } });
    if (orderCount > 0) {
      return res.status(409).json({
        error: "This meal has orders and can't be deleted. Mark it unavailable instead.",
      });
    }
    
    await prisma.mealPost.delete({ where: { id: req.params.id } });
    // delete image file from disk    
    await Promise.all(meal.images.map((img) => deleteImage(img.publicId)));
    
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
