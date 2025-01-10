const Router = require('express').Router();
const { getTransactionReport } = require('../../controllers/reports/transactions');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getTransactionReport);

module.exports = Router;