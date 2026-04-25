require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const shopRoutes = require("./routes/shops");
const requestRoutes = require("./routes/requests");
const responseRoutes = require("./routes/responses");
const reviewRoutes = require("./routes/reviews");
const messageRoutes = require("./routes/messages");
const adminRoutes = require("./routes/admin");

// Initialize app
const app = express();

// ===============================
// 🔐 MIDDLEWARE
// ===============================

// Security headers
app.use(helmet());

// Body parser
app.use(express.json());

// ===============================
// 🌐 CORS CONFIG (FIXED)
// ===============================

const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  process.env.FRONTEND_URL // production frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS not allowed: " + origin));
      }
    },
    credentials: true
  })
);

// ===============================
// 📌 ROUTES
// ===============================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);

// ===============================
// 🏠 ROOT ROUTE
// ===============================

app.get("/", (req, res) => {
  res.send("FixBit API is running...");
});

// ===============================
// ❌ GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

// ===============================
// 🚀 START SERVER
// ===============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});