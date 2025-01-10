const { getAllBanks, getBankDetailsById, addBank, editBank, deleteBank } = require('../controllers/bank/bank');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../global/jwt");

router.get('/', verifyToken, getAllBanks);
router.get('/:bankId', verifyToken, getBankDetailsById);
router.post('/', verifyToken, addBank);
router.put('/:bankId', verifyToken, editBank);
router.delete('/:bankId', verifyToken, deleteBank);


module.exports = router;


