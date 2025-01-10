const Router = require('express').Router();
const { getTransactionForCheques, reOpenCheque } = require('../../controllers/cheque/cheques');
const { createChequeTransfer,editChequeTransfer } = require('../../controllers/cheque/chequeTransfers');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getTransactionForCheques);
Router.post('/reopen-cheque/:chequeId', verifyToken, reOpenCheque);
Router.post('/transfer', verifyToken, createChequeTransfer);
Router.put('/transfer/:chequeTransferId', verifyToken, editChequeTransfer);

module.exports = Router;