
const mongoose = require('mongoose');


const CreditNoteModel = new mongoose.Schema({

    returnNo: {
        type: String,
        required: true
    },
    invoiceDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoices', // Reference to the invoice model
        default: null
        // required: true
    },
    invoiceNo: {
        type: String,
        default: ""
    },
    invoiceDate: {
        type: Date,
    },
    date: {
        type: Date,
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party', // Reference to the Party model
        required: true
    },
    billingAddress: {
        type: String,
        // required: true
    },
    phoneNo: {
        type: Number,
        required: true
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State'
    },
    description: {
        type: String,
        default: ""
    },
    image: String,
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     // required: true
    // },
    // //If paymentMethod =='Bank' then bank name is compulsory
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Banks',
    // },
    paymentMethod: [
        {
            method: {
                type: String,
                enum: ['Cash', 'Cheque', 'Bank'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            bankName: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Banks',
                validate: {
                    validator: function (value) {
                        return this.method !== 'Bank' || value != null;
                    },
                    message: 'Bank name is required when payment method is "Bank".'
                }
            },
            referenceNo: {
                type: String,
                default: ""
            },
            chequeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Cheque',
                // validate: {
                //     validator: function (value) {
                //         return this.method !== 'Cheque' || value != null;
                //     },
                //     message: 'Cheque Id is required when payment method is "Cheque".'
                // },
                default: null
            },
        }
    ],
    items: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Products',
                required: true
            },
            quantity: {
                type: Number,
                default: 0
            },
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Units',
                default: null
            },
            price: {
                type: Number,
                default: 0
            },
            discountPercent: {
                type: Number,
                default: 0
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'taxRates',
                default: null
            },
            finalAmount: {
                type: Number,
                default: 0
            },
        }
    ],
    totalAmount: {
        type: Number,
        default: 0
    },
    paidAmount: {
        type: Number,
        default: 0

    },
    balanceAmount: {
        type: Number,

    },
    source: {
        type: String,
        enum: ['Direct', 'Invoice'],
        required: true,
    },
    // status: {
    //     type: String,
    //     required: true,
    //     enum: ['Open', 'CLose']
    // },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    },

}, { timestamps: true });


module.exports = mongoose.model('CreditNotes', CreditNoteModel);