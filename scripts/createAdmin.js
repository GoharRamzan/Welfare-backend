require("dotenv").config();

const pool = require("../config/db");
const bcrypt = require("bcryptjs");

async function createAdmin() {
  try {
    const name = "System Admin";
    const email = "admin@example.com";
    const password = "Admin@12345";

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [name, email, hashedPassword]
    );

    console.log(
      result.rows.length
        ? "Admin created successfully"
        : "Admin already exists"
    );

  } catch (error) {
    console.log(error.message);
  } finally {
    await pool.end();
  }
}

createAdmin();