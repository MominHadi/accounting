const express = require('express');
const router = express.Router();
const { getAllStates} = require('../controllers/state/stateController');

router.get('/', getAllStates);


module.exports = router;