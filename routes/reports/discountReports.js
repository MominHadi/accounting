const Router = require('express').Router();
const { getDiscountReport } = require('../../controllers/reports/discountReport');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getDiscountReport);

module.exports = Router;