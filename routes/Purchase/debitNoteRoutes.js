const Router = require('express').Router();
const { getPurchaseReturnNumber, getDebitNoteById, getAllDebitNotes, saveDebitNote, editDebitNote, deleteDebitNote } = require('../../controllers/purchase/debitNoteController');
const { verifyToken } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/returnNo', verifyToken, getPurchaseReturnNumber);
Router.get('/', verifyToken, getAllDebitNotes);
Router.get('/:debitNoteId', verifyToken, getDebitNoteById);
Router.post('/', verifyToken, uploadArray, saveDebitNote);
Router.put('/:debitNoteId', verifyToken, uploadArray, editDebitNote);
Router.delete('/:debitNoteId', verifyToken, deleteDebitNote);

module.exports = Router;