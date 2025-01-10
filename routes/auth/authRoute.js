const { registerUser, loginUser, logoutUser, editFirm } = require("../../controllers/auth/auth");
const express = require('express');
const router = express.Router();

const { verifyToken } = require("../../global/jwt")
const { uploadFields } = require("../../middleware/multer")

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.put('/:userId', verifyToken,uploadFields, editFirm);

module.exports = router;


