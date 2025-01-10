const { updateOrCreateBusinessProfile,getBusinessProfile,updateBusinessLogo } = require('../controllers/businessProfile/businessProfileController');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../global/jwt");
const { uploadFields } = require("../middleware/multer")

router.post('/', verifyToken,uploadFields, updateOrCreateBusinessProfile);
router.patch('/', verifyToken,uploadFields, updateBusinessLogo);
router.get('/', verifyToken, getBusinessProfile);


module.exports = router;


