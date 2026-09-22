const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const { sendConfirmationEmail, sendForgetPassword } = require("../utils/mailer");

const CONFIRMATION_EXPIRY_MINUTES = parseInt(process.env.CONFIRMATION_TOKEN_EXPIRY_MINUTES, 10) || 30;

// POST /api/vendors/register
// Step 1-2 of the flow: validate input, stash the signup as "pending",
// and email a confirmation link. No Vendor row is created yet.
async function register(req, res) {
  try {
    const { name, email, phone, address, password } = req.body;

    if (!name || !email || !phone || !address || !password) {
      return res.status(400).json({ error: "name, email, phone, address, and password are all required" });
    }

    const existingVendor = await prisma.vendor.findUnique({ where: { email } });
    if (existingVendor) {
      return res.status(409).json({ error: "A vendor with that email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CONFIRMATION_EXPIRY_MINUTES * 60 * 1000);

    // If they already started signing up with this email, replace the old
    // pending attempt (new token, new expiry) instead of erroring out.
    await prisma.pendingVendor.upsert({
      where: { email },
      update: { name, phone, address, password: hashedPassword, confirmationToken, expiresAt },
      create: { name, email, phone, address, password: hashedPassword, confirmationToken, expiresAt },
    });

    const confirmUrl = `${process.env.BACKEND_URL}/api/vendors/confirm/${confirmationToken}`;

    try {
      await sendConfirmationEmail(email, confirmUrl);
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
      return res.status(502).json({ error: "Could not send confirmation email. Please try again." });
    }

    res.status(202).json({ message: "Check your email to confirm your account." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register vendor" });
  }
}

// GET /api/vendors/confirm/:token
// Step 3-5 of the flow: validate the token, create the real Vendor record,
// drop the pending row, and redirect to the frontend dashboard with a session token.
async function confirmVendor(req, res) {
  const { token } = req.params;
  const failureUrl = `${process.env.FRONTEND_URL}/signup-error`;

  try {
    const pending = await prisma.pendingVendor.findUnique({ where: { confirmationToken: token } });

    if (!pending) {
      return res.redirect(`${failureUrl}?reason=invalid_token`);
    }
    if (pending.expiresAt < new Date()) {
      await prisma.pendingVendor.delete({ where: { id: pending.id } });
      return res.redirect(`${failureUrl}?reason=expired`);
    }

    // Someone could theoretically register the same email twice before confirming;
    // guard against a duplicate Vendor slipping in between register and confirm.
    const existingVendor = await prisma.vendor.findUnique({ where: { email: pending.email } });
    if (existingVendor) {
      await prisma.pendingVendor.delete({ where: { id: pending.id } });
      return res.redirect(`${failureUrl}?reason=already_confirmed`);
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
        address: pending.address,
        password: pending.password,
      },
    });

    await prisma.pendingVendor.delete({ where: { id: pending.id } });

    const sessionToken = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${sessionToken}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${failureUrl}?reason=server_error`);
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

async function getVendor(req, res) {
  const { token } = req.params;

  try {

    const vendor = await prisma.vendor.findUnique({ where: { id: req.vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    
    res.json({ 
      id: vendor.id,
      name: vendor.name,
      email : vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      createdAt: vendor.createdAt,
      updateCreated: vendor.updatedAt
    });

  } catch(error) {
    console.log(error);
    res.status('Failed to check getVendor');
  }
}

async function forgetPassword( req, res) {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }
    
    const vendor = await prisma.vendor.findUnique({ where: { email: email } });
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const changePasswordUrl = `${process.env.FRONTEND_URL}/auth/change-password?token_security=${confirmationToken}&email=${email}`;

    await sendForgetPassword(email, changePasswordUrl);

    return res.status(200).json({
      'message': 'We sent an email to change your password'
    });
  } catch(error) {
    console.log(error);
    res.status('Failes send email forget password');
  }
}
module.exports = { register, login, confirmVendor, getVendor, forgetPassword };
