const Router = require('express').Router();
const { getDayBookReport } = require('../../controllers/reports/dayBook');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getDayBookReport);

module.exports = Router;