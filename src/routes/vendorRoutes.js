const express = require("express");
const { register, confirmVendor, login, getVendor, forgetPassword, resetPassword } = require("../controllers/vendorController");
const { requireVendorAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.get("/confirm/:token", confirmVendor);
router.post("/login", login);
router.get("/me",requireVendorAuth, getVendor);
router.post("/forget-password", forgetPassword );
router.post("/reset-password", resetPassword );

module.exports = router;
