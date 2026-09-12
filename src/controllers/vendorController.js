const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");

async function register(req, res) {
  try {
    const { name, email, phone, address, password } = req.body;

    if (!name || !email || !phone || !address || !password) {
      return res.status(400).json({ error: "name, email, phone, address, and password are all required" });
    }

    const existing = await prisma.vendor.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "A vendor with that email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const vendor = await prisma.vendor.create({
      data: { name, email, phone, address, password: hashedPassword },
    });

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    const { password: _omit, ...vendorSafe } = vendor;
    res.status(201).json({ vendor: vendorSafe, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register vendor" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const vendor = await prisma.vendor.findUnique({ where: { email } });
    if (!vendor) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, vendor.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    const { password: _omit, ...vendorSafe } = vendor;
    res.json({ vendor: vendorSafe, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in" });
  }
}

module.exports = { register, login };
