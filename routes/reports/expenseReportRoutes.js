const Router = require('express').Router();
const { getExpenseTransactionReport } = require('../../controllers/reports/expense/expenseTransactions');
const { getExpenseCategoryReport } = require('../../controllers/reports/expense/expenseCategory');
const { getExpenseItemsReport} = require('../../controllers/reports/expense/expenseItemsReport');
const { verifyToken } = require("../../global/jwt");

Router.get('/transactions', verifyToken, getExpenseTransactionReport);
Router.get('/categories', verifyToken, getExpenseCategoryReport);
Router.get('/items', verifyToken, getExpenseItemsReport);

module.exports = Router;