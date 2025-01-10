const {getBankAccountList,getTransactionForBank}=require('../controllers/bank//bankAccount.controller');

const express = require('express');

const router = express.Router();
const { verifyToken } = require("../global/jwt");

router.get('/', verifyToken, getBankAccountList);
router.get('/:bank', verifyToken, getTransactionForBank);


module.exports = router;
