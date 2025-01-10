const mongoose = require("mongoose");

const paymentInSchema = new mongoose.Schema({
    receiptNo: {
        type: String,
        default: ""
    },
    date: {
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
    description: {
        type: String,
        default: ""
    },
    image: {
        type: String
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     // required: true
    // },
    // //If paymentMethod =='Bank' then bank name is compulsory
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Banks',
    //     // validate: {
    //     //     validator: function (value) {
    //     //         return this.paymentMethod !== 'Bank' || value != null;
    //     //     },
    //     //     message: 'Bank name is required when payment method is "Bank".'
    //     // }
    // },
    // referenceNo: {
    //     type: String ,
    //     default: 0
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
    receivedAmount: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        // enum: ['Pending', 'Approved', 'Rejected'],
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    },

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: "PaymentIn" });

// paymentInSchema.pre('save', function (next) {
//     if (this.paymentMethod === 'Bank' && !this.bankName) {
//         return next(new Error('Bank name is required when payment method is "Bank".'));
//     }


//     if (this.paymentMethod !== 'Bank' && this.bankName) {
//         return next(new Error('Bank name is not required when payment method is not "Bank".'));
//     }
//     next();
// });
module.exports = mongoose.model('PaymentIn', paymentInSchema);
