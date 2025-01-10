const Router = require('express').Router();
const { getCashFlowReport,getCashFlowReportForMobile } = require('../../controllers/reports/cashFlow');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getCashFlowReport);
Router.get('/mobile', verifyToken, getCashFlowReportForMobile);

module.exports = Router;