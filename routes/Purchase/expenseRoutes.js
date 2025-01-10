const { getExpenseByCategory,getExpenseNumber, getAllExpenses, getExpenseById, saveNewExpense, editExpense, deleteExpense } =
    require("../../controllers/purchase/expenseController");
const express = require('express');

const router = express.Router();

const { verifyToken } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

router.get('/expenseNo', verifyToken, getExpenseNumber);
router.get('/', verifyToken, getAllExpenses);
router.get('/details/:category', verifyToken, getExpenseByCategory);
router.get('/:id', verifyToken, getExpenseById);
router.post('/', verifyToken, uploadArray, saveNewExpense);
router.put('/:id', verifyToken, uploadArray, editExpense);
router.delete('/:id', verifyToken, deleteExpense);

module.exports = router;


