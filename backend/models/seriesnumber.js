const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const seriesNumberSchema = new Schema({
  invoiceNo: {
    type: Number,
    default: 1
  },
  challanNo: {
    type: Number,
    default: 1
  },
  quotationReferenceNo: {
    type: Number,
    default: 1
  },
  paymentInReceiptNo: {
    type: Number,
    default: 1
  },
  expenseNo: {
    type: Number,
    default: 1
  },
  orderNo: {
    type: Number,
    default: 1
  },
  purchaseBillNo: {
    type: Number,
    default: 1
  },
  poNumber: {
    type: Number,
    default: 1
  },
  paymentOutReceiptNo: {
    type: Number,
    default: 1
  },
  saleReturnNo: {
    type: Number,
    default: 1
  },
  purchaseReturnNo: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: Schema.Types.ObjectId,  // This will reference the user
    ref: 'Users',
    required: true
  }
});


module.exports = mongoose.model(`seriesnumbers`, seriesNumberSchema);