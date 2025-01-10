const { getReferenceNo, createQuoation,getQuotationById, getTransaction, updateQuotation, deleteQuotation, getAllQuotations } = require('../../controllers/sales/quotationController');
const express = require('express');
const { verifyToken } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

const router = express.Router();

router.get('/referenceNo', verifyToken, getReferenceNo);
router.get('/', verifyToken, getAllQuotations);
router.get('/:id', verifyToken, getQuotationById);
router.post('/', verifyToken, uploadArray, createQuoation);
router.get('/transaction', verifyToken, getTransaction);
router.put('/:id', verifyToken, uploadArray, updateQuotation);
router.delete('/:id', verifyToken, deleteQuotation);

module.exports = router;



