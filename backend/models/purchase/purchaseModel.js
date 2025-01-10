const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    billNo: {
        type: String,
        default: "",
        // unique: true
    },
    billDate: {
        type: Date,
        default: Date.now
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State'
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
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
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     default: ""
    // },
    // // Bank name is required only when paymentMethod is 'Bank'
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
    //     type: String,
    //     default: ""
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
            }

        }
    ],
    items: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
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
            discountPercent: {
                type: Number,
                default: 0
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "taxRates",
                default: null
            },
            finalAmount: {
                type: Number,
                default: 0
            }
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
    paidAmount: {
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
    orderDetails: {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PurchaseOrders'
        },
        orderNo: {
            type: String,
            default: ""
        }
    }
}, { timestamps: true });

// purchaseSchema.pre('save', function (next) {
//     if (this.paymentMethod === 'Bank' && !this.bankName) {
//         return next(new Error('Bank name is required when payment method is "Bank".'));
//     }

//     if (this.paymentMethod !== 'Bank' && this.bankName) {
//         return next(new Error('Bank name is not required when payment method is not "Bank".'));
//     }

//     next();
// });

module.exports = mongoose.model("Purchase", purchaseSchema);
