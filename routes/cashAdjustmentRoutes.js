const {getAllCashAdjustments,getCashAdjustmentById, addCashAdjustment, editCashAdjustment, deleteCashAdjustment } = require("../controllers/cash/adjustCash");
const {showCashInHandList}=require('../controllers/cash/cashInHand');
const express = require('express');
const router = express.Router();
const { verifyToken } = require("../global/jwt");

router.get('/', verifyToken, getAllCashAdjustments);
router.get('/cash-in-hand', verifyToken, showCashInHandList);
router.get('/:id', verifyToken, getCashAdjustmentById);
router.post('/', verifyToken, addCashAdjustment);
router.put('/:id', verifyToken, editCashAdjustment);
router.delete('/:id', verifyToken, deleteCashAdjustment);



module.exports = router;