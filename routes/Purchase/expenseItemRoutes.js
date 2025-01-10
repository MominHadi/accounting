const Router = require('express').Router();

    const { getAllItems,getTransactionsForItem,getExpenseItemById, saveItem, updateItem, deleteItem } = require('../../controllers/purchase/expenseItemController');
    const { verifyToken } = require("../../global/jwt");


    Router.post('/', verifyToken, saveItem);
    Router.put('/:id', verifyToken, updateItem);
    Router.get('/', verifyToken, getAllItems);
    Router.get('/:id', verifyToken, getExpenseItemById);
    Router.get('/expense/:id', verifyToken, getTransactionsForItem);
    // Router.get('/:orderId', verifyToken, getPurchaseOrderById);
    // Router.put('/:orderId', verifyToken, updateOrder);
    Router.delete('/:id', verifyToken, deleteItem);

    module.exports = Router;