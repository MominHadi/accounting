const Router = require('express').Router();
const { getOrderReport } = require('../../controllers/reports/orders/orderReport');
const { getOrderItemReport} = require('../../controllers/reports/orders/orderItems');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getOrderReport);
Router.get('/order-items', verifyToken, getOrderItemReport);

module.exports = Router;