// const mongoose = require('mongoose');

// const bankSchema = new mongoose.Schema({
//     bankName: {
//         type: String,
//         required: true,
//         trim: true
//     },
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Users"
//     }
// },
//     {
//         timestamps: true // Adds createdAt and updatedAt fields automatically
//     });


// module.exports = mongoose.model('Banks', bankSchema);

const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    trim:true
  },
  openingBalance: {
    type: Number,
    default: 0,
  },
  asOfDate: {
    type: Date,
    default: Date.now,
  },
  printUPIQRCodeOnInvoice: {
    type: Boolean,
    default: false,
  },
  printBankDetailsOnInvoice: {
    type: Boolean,
    default: false,
  },
  accountNumber: {
    type: String,
    required: false,
  },
  ifscCode: {
    type: String,
    required: false,
  },
  upiIDForQRCode: {
    type: String,
  },
  branchName: {
    type: String,
    required: false,
    trim:true
  },
  accountHolderName: {
    type: String,
    required: false,
    trim:true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Users'
  }
}, { timestamps: true });

module.exports = mongoose.model('Banks', bankAccountSchema);
