const Router = require('express').Router();
const { getProfitAndLossReport } = require('../../controllers/reports/profitLoss');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getProfitAndLossReport);

module.exports = Router;