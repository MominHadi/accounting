const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNo: {
        type: String,
        default: ""
        // unique: true
    },
    invoiceType: {
        type: String,
        required: true,
        enum: ["Credit", "Cash"]
    },
    invoiceDate: {
        type: Date,
        // required: true,
        default: Date.now
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Party"
    },
    partyName: {
        type: String,
        default: ""
    },
    phoneNo: {
        type: String,
        default: ""
    },
    billingName: {//If Invoice Type is Cash (Optional)
        type: String,
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State',
    },
    contactNo: {
        type: String,
    },
    billingAddress: {
        type: String,
    },
    description: {
        type: String,
        default: ''
    },
    document: {
        type: String
    },
    image: {
        type: String,
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     required: true
    // },
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Banks',
    //     validate: {
    //         validator: function (value) {
    //             return this.paymentMethod !== 'Bank' || value != null;
    //         },
    //         message: 'Bank name is required when payment method is "Bank".'
    //     }
    // },
    // referenceNo: {
    //     type: String // Optional, used if bank payment method selected
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
                type: String
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
                required: true,
                ref: "Products"
            },
            quantity: {
                type: Number,
                default: 0
            },
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Units",
                default: null
            },
            price: {
                type: Number,
                default: 0
            },
            mrp: {
                type: Number,
                default: 0
            },
            discountPercent: {
                type: Number,
                default: 0
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                // required: true,
                ref: "taxRates",
                default: null

            },
            finalAmount: {
                type: Number,
                default: 0
            },

        }
    ],
    roundOff: {
        type: Number,
        default: 0

    },
    totalAmount: {
        type: Number,
        default: 0

    },
    receivedAmount: {
        type: Number,
        default: 0

    },
    balanceAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    },
    source: {
        type: String,
        enum: ["Direct", "Estimate", "Sale Order", "Challan"],
        default: "Direct"
    },
    sourceDetails: {
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'sourceDetails.docName'
        },
        documentNo: {
            type: String,
        },
        docName: {
            type: String,
        },
    }
}, { collection: "invoices", timestamps: true });


invoiceSchema.pre('save', function (next) {
    // console.log(this.sourceDetails.documentId,'sourceDetails.documentId')

    if (this.paymentMethod === 'Bank' && !this.bankName) {
        return next(new Error('Bank name is required when payment method is "Bank".'));
    }

    if (this.paymentMethod !== 'Bank' && this.bankName) {
        return next(new Error('Bank name is not required when payment method is "Bank".'));
    }

    if (this.source !== 'Direct' && !this.sourceDetails.documentId) {
        return next(new Error('Invoice cannot be created  without source Details'));
    }

    next();
});


module.exports = mongoose.model(`Invoices`, invoiceSchema);