const express = require("express");
const router = express.Router();

const {
  getDonors,
  getDonorById,
  createDonor,
  updateDonor,
  addDonation,
  getDonorDonations,
  deleteDonor,
} = require("../controllers/donorController");

router.get("/", getDonors);
router.get("/:id", getDonorById);
router.post("/", createDonor);
router.put("/:id", updateDonor);
router.post("/:id/donations", addDonation);
router.get("/:id/donations", getDonorDonations);
router.delete("/:id", deleteDonor);

module.exports = router;