const { getAllTransactions } = require('../controllers/transactions/transactionController');
const express = require('express');

const { verifyToken} = require("../global/jwt");

const router = express.Router();

router.get('/',verifyToken, getAllTransactions);

module.exports = router;

