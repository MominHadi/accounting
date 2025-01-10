const Router = require('express').Router();
const { getBankStatement } = require('../../controllers/reports/bankStatement');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getBankStatement);

module.exports = Router;