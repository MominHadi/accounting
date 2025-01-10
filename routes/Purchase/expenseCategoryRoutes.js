const Router = require('express').Router();
const { getAllCategory, addExpenseCategory, getExpenseDetailsForCategory } = require('../../controllers/purchase/expenseCategory');
const { verifyToken } = require("../../global/jwt");


Router.post('/', verifyToken, addExpenseCategory);

Router.get('/expense/:expenseCategory', verifyToken,getExpenseDetailsForCategory);

Router.get('/', verifyToken, getAllCategory);
// Router.get('/:orderId', verifyToken, getPurchaseOrderById);
// Router.put('/:orderId', verifyToken, updateOrder);
// Router.delete('/:orderId', verifyToken, deleteOrder);

module.exports = Router;