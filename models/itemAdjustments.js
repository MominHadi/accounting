const mongoose = require('mongoose');

const itemAdjustmentSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Products',
    required: true,
  },
  adjustmentDate: {
    type: Date,
    default: Date.now,
  },
  totalQty: {
    type: Number,
    // required: true,
    min: 0,
  },
  atPrice: {
    type: Number,
    // required: true,
    min: 0,
  },
  details: {
    type: String,
    trim: true,
  },
  action: {
    type: String,
    enum: ['add', 'reduce'],
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

module.exports = mongoose.model('ItemAdjustment', itemAdjustmentSchema);
