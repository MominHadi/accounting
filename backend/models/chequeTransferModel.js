const mongoose = require('mongoose');

const chequeTransferSchema = new mongoose.Schema(
    {
        transactionType: {
            type: String,
            enum: ['withdraw', 'deposit'],
            required: true,
        },

        accountName: {
            type: String
        },
        bank: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            default: null
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        referenceNo: {
            type: String,
            default: 'N/A',
            trim: true,
        },
        transferDate: {
            type: Date,
            required: true,
        },
        description: {
            type: String,
            trim: true,
        },
        source: {
            type: String, // the source of the transaction (e.g., sale, purchase, credit note)
            required: true,
            trim: true,
        },
        sourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'source'
        },
        cheque: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Cheque'
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('ChequeTransfer', chequeTransferSchema);
