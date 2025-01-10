const express = require('express');
const router = express.Router();
const { saveItem, updateItem, deleteItem, getAllItems,getItemById ,getTransactionForItem} = require('../../controllers/stock/productsController');

const { verifyToken } = require("../../global/jwt");

const { uploadArray} = require("../../middleware/multer");

router.get('/', verifyToken, getAllItems);
router.get('/:itemId', verifyToken, getItemById);
router.get('/transactions/:itemId', verifyToken, getTransactionForItem);
router.post('/', verifyToken,uploadArray, saveItem);
router.put('/:itemId', verifyToken,uploadArray, updateItem);
router.delete('/:itemId', verifyToken, deleteItem);
module.exports = router;