const Router = require('express').Router();
const { getTransactionReport } = require('../../controllers/reports/purchaseReport');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getTransactionReport);

module.exports = Router;