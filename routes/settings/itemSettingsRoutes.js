const {enableOrDisableTaxPercent,getItemSettings}=require('../../controllers/settings/itemSettings.Controller');

const express = require('express');

const router = express.Router();

const { verifyToken } = require("../../global/jwt");

router.put('/', verifyToken, enableOrDisableTaxPercent);
router.get('/', verifyToken, getItemSettings);

module.exports = router;
