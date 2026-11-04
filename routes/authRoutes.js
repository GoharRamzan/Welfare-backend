const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  logout,
  getMe,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

// Login
router.post("/login", login);

// Signup - only logged-in admin
router.post("/signup", authMiddleware, (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Only admin can create accounts",
    });
  }

  next();
}, signup);

// Logout
router.post("/logout", authMiddleware, logout);

// Current user
router.get("/me", authMiddleware, getMe);

module.exports = router;