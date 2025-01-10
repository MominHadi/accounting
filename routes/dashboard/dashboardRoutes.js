const {getDashboardData } = require('../../controllers/dashboard/dashboardController');
const {getSalesGraphData } = require('../../controllers/dashboard/graphDataController');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");

router.get('/', verifyToken, getDashboardData);

router.get('/graph', verifyToken, getSalesGraphData);

module.exports = router;
