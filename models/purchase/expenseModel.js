const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    expenseType: {
        type: String,
        enum: ['GST', 'NON-GST'],
    },
    expenseCategory: {
        type: String,
        default: ""
    },
    expenseNo: {
        type: String,
        default: ""
    },
    date: { type: Date },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Party"
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.String,
        ref: "State"
    },
    description: {
        type: String,
        default: ""
    },
    document: {
        type: String
    },
    image: {
        type: String,

    },
    items: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ExpenseItem",
                required: false
            },
            quantity: {
                type: Number,
                default: 0,
                required: false
            },
            price: {
                type: Number,
                default: 0,
                required: false
            },
            discountPercent: {
                type: Number,
                default: 0,
                required: false
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "taxRates",
                default: null,
                required: false
            },
            finalAmount: {
                type: Number,
                default: 0,
                required: false
            }
        }
    ],
    // paymentMethod: {
    //     type: String,
    //     enum: ["Cash", "Cheque", "Bank"],
    //     default: ""
    // },
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Bank"
    // },
    // referenceNo: { 
    //     type: String, 
    //     default: "" 
    //  },
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
                default: true
            },
            chequeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Cheque',
                default: null
            },
        }
    ],
    grandTotal: {
        type: Number,
        default: 0
    },
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
    }
}, { timestamps: true });

ExpenseSchema.pre('save', function (next) {
    if (this.expenseType === 'GST' && !this.party) {
        return next(new Error('Party is required when Expense Type is GST'));
    }
    next();
});

module.exports = mongoose.model('Expenses', ExpenseSchema);
