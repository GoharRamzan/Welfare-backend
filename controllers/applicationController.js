const pool = require("../config/db");

// GET ALL APPLICATIONS
const getApplications = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM applications ORDER BY created_at DESC"
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            applications: result.rows,
        });
    } catch (error) {
        console.error("Get Applications Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch applications",
        });
    }
};

// GET SINGLE APPLICATION
const getApplicationById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM applications WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }

        res.status(200).json({
            success: true,
            application: result.rows[0],
        });
    } catch (error) {
        console.error("Get Application Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch application",
        });
    }
};

// CREATE APPLICATION
const createApplication = async (req, res) => {
    const {
        receiving_date,
        applicant_name,
        guardian_name,
        cnic,
        phone,
        address,
        approval_date,
        case_type,
        description,
        delivery_date,
        task_status,
        remarks,
        attachment,
    } = req.body;

    if (!receiving_date || !applicant_name) {
        return res.status(400).json({
            success: false,
            message: "Receiving date and applicant name are required",
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const year = new Date().getFullYear();

        // Create counter for this year if it does not exist
        await client.query(
            `INSERT INTO application_counters (year, last_number)
       VALUES ($1, 0)
       ON CONFLICT (year) DO NOTHING`,
            [year]
        );

        // Atomically increment counter and get next number
        const counterResult = await client.query(
            `UPDATE application_counters
       SET last_number = last_number + 1
       WHERE year = $1
       RETURNING last_number`,
            [year]
        );

        const nextNumber = counterResult.rows[0].last_number;
        const applicationNo = `APP-${year}-${String(nextNumber).padStart(3, "0")}`;

        const result = await client.query(
            `INSERT INTO applications (
        application_no,
        receiving_date,
        applicant_name,
        guardian_name,
        cnic,
        phone,
        address,
        approval_date,
        case_type,
        description,
        delivery_date,
        task_status,
        remarks,
        attachment
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *`,
            [
                applicationNo,
                receiving_date,
                applicant_name,
                guardian_name || null,
                cnic || null,
                phone || null,
                address || null,
                approval_date || null,
                case_type || null,
                description || null,
                delivery_date || null,
                task_status || "Pending",
                remarks || null,
                attachment || null,
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Application created successfully",
            application: result.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Create Application Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create application",
        });
    } finally {
        client.release();
    }
};

// UPDATE APPLICATION
const updateApplication = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            application_no,
            receiving_date,
            applicant_name,
            guardian_name,
            cnic,
            phone,
            address,
            approval_date,
            case_type,
            description,
            delivery_date,
            task_status,
            remarks,
            attachment,
        } = req.body;

        const result = await pool.query(
            `UPDATE applications SET
        application_no = $1,
        receiving_date = $2,
        applicant_name = $3,
        guardian_name = $4,
        cnic = $5,
        phone = $6,
        address = $7,
        approval_date = $8,
        case_type = $9,
        description = $10,
        delivery_date = $11,
        task_status = $12,
        remarks = $13,
        attachment = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *`,
            [
                application_no,
                receiving_date,
                applicant_name,
                guardian_name || null,
                cnic || null,
                phone || null,
                address || null,
                approval_date || null,
                case_type || null,
                description || null,
                delivery_date || null,
                task_status || "Pending",
                remarks || null,
                attachment || null,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Application updated successfully",
            application: result.rows[0],
        });
    } catch (error) {
        console.error("Update Application Error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Application number already exists",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update application",
        });
    }
};

// DELETE APPLICATION
const deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM applications WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Application deleted successfully",
        });
    } catch (error) {
        console.error("Delete Application Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete application",
        });
    }
};

module.exports = {
    getApplications,
    getApplicationById,
    createApplication,
    updateApplication,
    deleteApplication,
};