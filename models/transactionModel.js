const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    transactionDate: {
        type: Date,
        default: Date.now
    },
    transactionType: {
        type: String,
        required: true
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Party"
        // required:true
    },
    totalAmount: {
        type: Number,
        default: 0,
    },
    credit_amount: {
        type: Number,
        default: 0,
    },
    debit_amount: {
        type: Number,
        default: 0,
    },
    balance: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ""
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank', 'None'],
    //     required: true,
    // },
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Bank',
    //     // Only required if paymentMethod is 'Bank'
    //     validate: {
    //         validator: function (value) {
    //             return this.paymentMethod !== 'Bank' || value != null;
    //         },
    //         message: 'Bank name is required when payment method is "Bank".'
    //     }
    // },
    paymentMethod: [
        {
            method: {
                type: String,
                enum: ['Cash', 'Cheque', 'Bank', 'None'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            bankName: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Bank',
                validate: {
                    validator: function (value) {
                        return this.method !== 'Bank' || value != null;
                    },
                    message: 'Bank name is required when payment method is "Bank".'
                }
            },
            referenceNo: {
                type: String, // Optional, used if the payment method is "Bank"
                default: null
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
    reference: {
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'reference.docName'
        },
        documentNumber: {
            type: String,
            // required: true
        },
        docName: {
            type: String,
            required: true
        },
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { timestamps: true }); // Use timestamps to manage createdAt and updatedAt automatically


// TransactionSchema.pre('save', function (next) {
//     if (this.paymentMethod === 'Bank' && !this.bankName) {
//         return next(new Error('Bank name is required when payment method is "Bank".'));
//     }


//     if (this.paymentMethod !== 'Bank' && this.bankName) {
//         return next(new Error('Bank name is not required when payment method is not "Bank".'));
//     }
//     next();
// });

module.exports = mongoose.model("Transactions", TransactionSchema);
