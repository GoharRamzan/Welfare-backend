
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Cookie settings
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "development",
  sameSite: process.env.NODE_ENV === "development" ? "none" : "lax",
  maxAge: 60 * 60 * 1000,
  path: "/",
};

// SIGNUP
const signup = async (req, res) => {
  try {
    const { full_name, email, password, role = "staff" } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role`,
      [full_name.trim(), normalizedEmail, hashedPassword, role]
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: result.rows[0],
    });

  } catch (error) {
    console.log("Signup error:", error.message);

    res.status(500).json({
      success: false,
      message: "Signup failed",
    });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid  password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("accessToken", token, cookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.log("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// LOGOUT
const logout = (req, res) => {
  res.clearCookie("accessToken", {
   httpOnly: true,
  secure: process.env.NODE_ENV === "development",
  sameSite: process.env.NODE_ENV === "development" ? "none" : "lax",
  path: "/",
  });

  res.json({
    success: true,
    message: "Logout successful",
  });
};

// GET LOGGED-IN USER
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });

  } catch (error) {
    console.log("Get user error:", error.message);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getMe,
};
