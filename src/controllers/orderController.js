const prisma = require("../utils/prisma");
const { sendVerificationEmail, generateVerificationCode } = require("../utils/mailer");

// POST /orders — customer places an order; creates it unverified and emails a code
async function createOrder(req, res) {
  try {
    const { mealPostId, customerEmail, quantity } = req.body;

    if (!mealPostId || !customerEmail || !quantity) {
      return res.status(400).json({ error: "mealPostId, customerEmail, and quantity are required" });
    }

    const meal = await prisma.mealPost.findUnique({ where: { id: mealPostId } });
    if (!meal) return res.status(404).json({ error: "Meal post not found" });
    if (!meal.isAvailable) return res.status(400).json({ error: "This meal is not currently available" });

    const verificationCode = generateVerificationCode();

    const order = await prisma.order.create({
      data: {
        mealPostId,
        customerEmail,
        quantity: parseInt(quantity, 10),
        verificationCode,
        isVerified: false,
      },
    });

    try {
      await sendVerificationEmail(customerEmail, verificationCode);
    } catch (emailErr) {
      // Order is still created — the customer can potentially request a resend later.
      // Don't fail the whole request just because the email provider hiccuped.
      console.error("Failed to send verification email:", emailErr);
    }

    res.status(201).json({ orderId: order.id, message: "Order created. Check your email for a verification code." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
}

// POST /orders/:id/verify — customer confirms the order with the emailed code
async function verifyOrder(req, res) {
  try {
    const { code } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.isVerified) return res.status(400).json({ error: "Order is already verified" });
    if (order.verificationCode !== code) {
      return res.status(400).json({ error: "Incorrect verification code" });
    }

    const verified = await prisma.order.update({
      where: { id: req.params.id },
      data: { isVerified: true },
    });

    res.json(verified);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify order" });
  }
}

// GET /orders/:id — order status/details lookup (used by the customer-facing status page)
async function getOrderById(req, res) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { mealPost: { select: { description: true, price: true } } },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
}

// GET /orders?mealPostId=&status= — vendor views orders for their meals
async function listVendorOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      where: {
        mealPost: { vendorId: req.vendorId },
        ...(req.query.status && { status: req.query.status }),
        ...(req.query.mealPostId && { mealPostId: req.query.mealPostId }),
      },
      include: { mealPost: { select: { id: true, description: true, price: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

// PATCH /orders/:id/status — vendor moves an order through Ordered -> Ready for pickup -> Handed over
async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ["ORDERED", "READY_FOR_PICKUP", "HANDED_OVER"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { mealPost: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.mealPost.vendorId !== req.vendorId) {
      return res.status(403).json({ error: "This order doesn't belong to one of your meal posts" });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order status" });
  }
}

module.exports = { createOrder, verifyOrder, getOrderById, listVendorOrders, updateOrderStatus };
