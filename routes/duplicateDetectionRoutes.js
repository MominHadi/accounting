const express = require('express');
const router = express.Router();
const { detectDuplicateEntries } = require('../controllers/duplicateDetectionController');
const { verifyToken } = require('../global/jwt');
 
router.get('/', verifyToken, detectDuplicateEntries);


module.exports = router;