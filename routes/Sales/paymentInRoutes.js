const { savePaymentIn, updatePaymentIn, deletePaymentIn, getAllPayments, getPaymentById, getReceiptNo } = require("../../controllers/sales/paymentInController");
const express = require('express');
const router = express.Router();
const { verifyToken } = require("../../global/jwt");
const { uploadArray} = require("../../middleware/multer");

router.get('/', verifyToken, getAllPayments);
router.get('/receiptNo', verifyToken, getReceiptNo);
router.get('/:id', verifyToken, getPaymentById);
router.post('/', verifyToken, uploadArray,savePaymentIn);
router.put('/:id', verifyToken, uploadArray,updatePaymentIn);
router.delete('/:id', verifyToken, deletePaymentIn);

module.exports = router;


