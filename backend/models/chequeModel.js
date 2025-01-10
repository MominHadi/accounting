const mongoose = require('mongoose');

const chequeSchema = new mongoose.Schema(
    {
        partyName: {
            type: String,
            required: false,
            trim: true,
        },
        party: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Party',
            required: false,
            default: null
        },
        transactionType: {
            type: String,
            required: true,
            enum: ['credit', 'debit'],
        },
        date: {
            type: Date,
            default: Date.now()
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        referenceNo: {
            type: String,
            default: 'N/A'
        },
        transferId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        status: {
            type: String,
            required: true,
            enum: ['open', 'close'],
            default: 'open',
        },
        source: {
            type: String,
            required: true,
        },
        reference: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'source'
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users"
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Cheque', chequeSchema);
