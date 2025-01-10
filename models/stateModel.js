const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true // You can store the state code (e.g., KA for Karnataka, MH for Maharashtra)
    }
});

module.exports = mongoose.model('State', stateSchema);
