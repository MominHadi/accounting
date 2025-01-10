const { addConversionForUnit, getConversionForUnit } = require("../../controllers/units/unitConversion.Controller");
const express = require('express');

const Router = express.Router();

const { verifyToken } = require('../../global/jwt');

Router.post('/', verifyToken, addConversionForUnit);
Router.get('/:unitId', verifyToken, getConversionForUnit);

module.exports = Router;