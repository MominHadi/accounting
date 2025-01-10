const express = require('express');
const router = express.Router();
const { getAllTaxRates} = require('../controllers/taxRatesController');

const { verifyToken } = require('../global/jwt');

router.get('/',verifyToken, getAllTaxRates);


module.exports = router;