const {getAllCategory,getCategoryById, createCategory, updateCategory, deleteCategory ,addItemsToCategory,getItemsExcludingCategory,getItemsIncludingCategory} = require('../controllers/categoryController');
const express = require('express');

const router = express.Router();
const { verifyToken} = require("../global/jwt");

router.get('/', verifyToken,getAllCategory);
router.get('/:categoryId',verifyToken, getCategoryById);
router.post('/:categoryName', verifyToken,createCategory);
router.put('/:categoryId',verifyToken, updateCategory);
router.delete('/:categoryId',verifyToken, deleteCategory);


//Add items to Category

router.post('/add-items/:category',verifyToken,addItemsToCategory);
router.get('/items/excluding-category/:categoryId',verifyToken,getItemsExcludingCategory);
router.get('/items/including-category/:categoryId',verifyToken,getItemsIncludingCategory);

module.exports = router;


