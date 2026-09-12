const express = require("express");
const { requireVendorAuth } = require("../middleware/auth");
const {
  createOrder,
  verifyOrder,
  getOrderById,
  listVendorOrders,
  updateOrderStatus,
} = require("../controllers/orderController");

const router = express.Router();

// Customer-facing
router.post("/", createOrder);
router.post("/:id/verify", verifyOrder);
router.get("/:id", getOrderById);

// Vendor-only
router.get("/", requireVendorAuth, listVendorOrders);
router.patch("/:id/status", requireVendorAuth, updateOrderStatus);

module.exports = router;
