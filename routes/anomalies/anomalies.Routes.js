const {detectSaleOrderAnomalies} = require('../../controllers/anomalies/saleOrder');
const {detectSaleBelowPurchaseAnomalies} = require('../../controllers/anomalies/salesBelowPurchase');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");

router.get('/sale-order', verifyToken, detectSaleOrderAnomalies);
router.get('/sale-below-purchase', verifyToken, detectSaleBelowPurchaseAnomalies);

// router.get('/graph', verifyToken, getSalesGraphData);

module.exports = router;
