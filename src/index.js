require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const vendorRoutes = require("./routes/vendorRoutes");
const mealRoutes = require("./routes/mealRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded meal images statically, e.g. http://localhost:4000/uploads/<file>
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/vendors", vendorRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/orders", orderRoutes);

// Catch-all error handler (e.g. multer file-type errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
