const {getBusinessCategories,getBusinessTypes}=require('../../controllers/businessProfile/dropdowns.Controller');

const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");

router.get('/business-categories', getBusinessCategories);
router.get('/business-types', getBusinessTypes);

module.exports = router;
