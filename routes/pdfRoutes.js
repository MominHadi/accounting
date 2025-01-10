const express = require('express');
const router = express.Router();
const { generatePdf } = require('../pdfGeneration/index');
const { verifyToken } = require('../global/jwt');
 
router.get('/', verifyToken, generatePdf);


module.exports = router;