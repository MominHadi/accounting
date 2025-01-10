const { getAllUnits, getUnitById, createUnit, updateUnit, deleteUnit } = require('../../controllers/units/unitControllers');
const express = require('express');

const { verifyToken} = require("../../global/jwt");

const router = express.Router();

router.get('/',verifyToken, getAllUnits);
router.get('/:unitId', verifyToken,getUnitById);
router.post('/',verifyToken, createUnit);
router.put('/:unitId',verifyToken, updateUnit);
router.delete('/:unitId', verifyToken,deleteUnit);


module.exports = router;

