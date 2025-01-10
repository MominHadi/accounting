const Router = require('express').Router();
const { getSaleReport } = require('../../controllers/reports/saleReports');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getSaleReport);

module.exports = Router;