const express = require('express');
const router = express.Router();
const { adjustStock} = require('../../controllers/stock/adjustItemController');
const { verifyToken } = require("../../global/jwt");

// router.get('/', verifyToken, getAllItems);
// router.get('/:itemId', verifyToken, getItemById);
// router.get('/transactions/:itemId', verifyToken, getTransactionForItem);
router.post('/', verifyToken, adjustStock);
// router.put('/:itemId', verifyToken,uploadArray, updateItem);
// router.delete('/:itemId', verifyToken, deleteItem);
module.exports = router;