const mongoose = require("mongoose");

const SaleOrderSchema = new mongoose.Schema({
    //If  Sale Order is creating from Estimate
    poReference: {
        poId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotations",
            default: null
        },
        poNumber: {
            type: String,
            default: ""
        },
        date: {
            type: String,
            default: ""
        },
    },
    orderNo: {
        type: String,
        default: ""
    },
    orderDate: {
        type: Date,
    },
    dueDate: {
        type: Date,
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        default: null
    },
    partyName: {
        type: String,
        default: ""
    },
    billingAddress: {
        type: String,
    },
    phoneNo: {
        type: String,
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State', // Reference to the Party model
    },
    image: {
        type: String
    },
    document: {
        type: String
    },
    description: String,
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     // required: true
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
    // referenceNo: { type: String },//If bank is selected in payment Method


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
                ref: 'Products',
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
                ref: "taxRates",
                default: null
            },
        }
    ],

    totalAmount: {
        type: Number,
        default: 0
    },
    //Received Amount is advanced Amount
    advanceAmount: {
        type: Number,
        default: 0
    },
    balanceAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Order Overdue', 'Order Open', 'Order Closed'],
        default: "Order Open"
    }
    //If sales order is coverted to Sales/Invoice
    , isConverted: {
        type: Boolean,
        default: false
    },
    conversionDetails: {
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'reference.documentType'
        },
        documentType: {
            type: String,
            enum: ["Invoices"],
            default: null
        },
        documentNo: {
            type: Number,
            default: null
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    }
}, { timestamps: true })



// SaleOrderSchema.pre('save', function (next) {


//     const today = new Date();
//     if (this.dueDate && this.dueDate < today) {
//         this.status = 'Order Overdue';
//     } else {
//         this.status = 'Order Open';
//     }


//     if (this.paymentMethod === 'Bank' && !this.bankName) {
//         return next(new Error('Bank name is required when payment method is "Bank".'));
//     }

//     next();
// });


module.exports = mongoose.model("SaleOrder", SaleOrderSchema);