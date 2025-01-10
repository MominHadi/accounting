const Router = require('express').Router();
const { getOrderNo, getAllOrders,getOrderById ,createOrder, updateOrder, deleteOrder } = require('../../controllers/sales/saleOrderController');
const { verifyToken } = require("../../global/jwt");
const { uploadArray} = require("../../middleware/multer");

Router.get('/orderNo', verifyToken, getOrderNo);
Router.get('/', verifyToken, getAllOrders);
Router.get('/:id',verifyToken,getOrderById);
Router.post('/', verifyToken,uploadArray, createOrder);
Router.put('/:id', verifyToken,uploadArray, updateOrder);
Router.delete('/:id', verifyToken, deleteOrder);

module.exports = Router;