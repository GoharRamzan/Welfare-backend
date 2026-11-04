const pool = require("../config/db");

// GET: All donors with donation summary

const getDonors = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.donor_no,
        d.name,
        d.phone,
        d.cnic,
        d.email,
        d.address,
        d.status,
        d.created_at,
        COALESCE(SUM(dn.amount), 0) AS total_donated,
        COUNT(dn.id)::INTEGER AS donation_count,
        MAX(dn.donation_date) AS last_donation,

        COALESCE(
          SUM(dn.amount) FILTER (
            WHERE EXTRACT(MONTH FROM dn.donation_date) =
                  EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM dn.donation_date) =
                EXTRACT(YEAR FROM CURRENT_DATE)
          ), 0
        ) AS monthly_total,

        COUNT(dn.id) FILTER (
          WHERE EXTRACT(MONTH FROM dn.donation_date) =
                EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM dn.donation_date) =
              EXTRACT(YEAR FROM CURRENT_DATE)
        )::INTEGER AS monthly_donation_count

      FROM donors d
      LEFT JOIN donations dn ON dn.donor_id = d.id
      GROUP BY d.id
      ORDER BY d.id DESC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      donors: result.rows,
    });
  } catch (error) {
    console.error("Get donors error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch donors",
    });
  }
};

// GET: Single donor profile with donation history
const getDonorById = async (req, res) => {
  try {
    const { id } = req.params;

    const donorResult = await pool.query(
      `SELECT
        d.*,
        COALESCE(SUM(dn.amount), 0) AS total_donated,
        COUNT(dn.id)::INTEGER AS donation_count,
        MAX(dn.donation_date) AS last_donation
       FROM donors d
       LEFT JOIN donations dn ON dn.donor_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (donorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    const donationsResult = await pool.query(
      `SELECT id, donor_id, donation_date, amount,
              payment_method, remarks, created_at
       FROM donations
       WHERE donor_id = $1
       ORDER BY donation_date DESC, id DESC`,
      [id]
    );

    res.status(200).json({
      success: true,
      donor: donorResult.rows[0],
      donations: donationsResult.rows,
    });
  } catch (error) {
    console.error("Get donor details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch donor details",
    });
  }
};

// POST: Create new donor
const createDonor = async (req, res) => {
  try {
    const { name, phone, cnic, email, address, status } = req.body;

    if (!name || !cnic) {
      return res.status(400).json({
        success: false,
        message: "Donor name and CNIC are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO donors (name, phone, cnic, email, address, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        phone || null,
        cnic.trim(),
        email || null,
        address || null,
        status || "Active",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Donor created successfully",
      donor: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This CNIC is already registered",
      });
    }

    console.error("Create donor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create donor",
    });
  }
};

// PUT: Update donor profile
const updateDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, cnic, email, address, status } = req.body;

    if (!name || !cnic) {
      return res.status(400).json({
        success: false,
        message: "Donor name and CNIC are required",
      });
    }

    const result = await pool.query(
      `UPDATE donors
       SET name = $1,
           phone = $2,
           cnic = $3,
           email = $4,
           address = $5,
           status = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        name.trim(),
        phone || null,
        cnic.trim(),
        email || null,
        address || null,
        status || "Active",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Donor updated successfully",
      donor: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This CNIC is already registered",
      });
    }

    console.error("Update donor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update donor",
    });
  }
};

// POST: Add donation to an existing donor
const addDonation = async (req, res) => {
  try {
    const { id } = req.params;
    const { donation_date, amount, payment_method, remarks } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid donation amount is required",
      });
    }

    const donorCheck = await pool.query(
      "SELECT id FROM donors WHERE id = $1",
      [id]
    );

    if (donorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    const result = await pool.query(
      `INSERT INTO donations
       (donor_id, donation_date, amount, payment_method, remarks)
       VALUES ($1, COALESCE($2::DATE, CURRENT_DATE), $3, $4, $5)
       RETURNING *`,
      [
        id,
        donation_date || null,
        amount,
        payment_method || null,
        remarks || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Donation added successfully",
      donation: result.rows[0],
    });
  } catch (error) {
    console.error("Add donation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add donation",
    });
  }
};

// GET: Donation history of a donor
const getDonorDonations = async (req, res) => {
  try {
    const { id } = req.params;

    const donorCheck = await pool.query(
      "SELECT id FROM donors WHERE id = $1",
      [id]
    );

    if (donorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    const result = await pool.query(
      `SELECT * FROM donations
       WHERE donor_id = $1
       ORDER BY donation_date DESC, id DESC`,
      [id]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      donations: result.rows,
    });
  } catch (error) {
    console.error("Get donations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch donation history",
    });
  }
};

// DELETE: Delete donor only if no donations are linked
const deleteDonor = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM donors WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Donor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Donor deleted successfully",
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "This donor has donation records and cannot be deleted",
      });
    }

    console.error("Delete donor error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete donor",
    });
  }
};

module.exports = {
  getDonors,
  getDonorById,
  createDonor,
  updateDonor,
  addDonation,
  getDonorDonations,
  deleteDonor,
};