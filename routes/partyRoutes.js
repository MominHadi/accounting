const express = require('express');
const router = express.Router();
const { addNewParty, updateParty, deleteParty, getTransactionsForParty, getPartyDetailsById, getPartiesAndBalance, getAllPartiesList } = require('../controllers/partyControllers');
const { verifyToken } = require('../global/jwt');
 
router.get('/', verifyToken, getAllPartiesList);

router.get('/balance', verifyToken, getPartiesAndBalance);

router.get('/transactions/:partyId', verifyToken, getTransactionsForParty);

router.get('/:partyId', verifyToken, getPartyDetailsById);

router.post('/', verifyToken, addNewParty);

router.put('/:partyId', verifyToken, updateParty);

router.delete('/:partyId', verifyToken, deleteParty);

module.exports = router;