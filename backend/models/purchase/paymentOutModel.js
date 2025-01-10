const mongoose = require("mongoose");

const paymentInSchema = new mongoose.Schema({
    receiptNo: {
        type: String,
        default: "",
        // unique: true
    },
    date: {
        type: Date
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party'
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
        type: String,
        default: ""
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     default: ""
    // },
    // // If paymentMethod =='Bank', then bank name is compulsory
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
    paidAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { collection: "PaymentOut", timestamps: true });

// paymentInSchema.pre('save', function (next) {
//     if (this.paymentMethod === 'Bank' && !this.bankName) {
//         return next(new Error('Bank name is required when payment method is "Bank".'));
//     }

//     if (this.paymentMethod !== 'Bank' && this.bankName) {
//         return next(new Error('Bank name is not required when payment method is not "Bank".'));
//     }
//     next();
// });

module.exports = mongoose.model('PaymentOut', paymentInSchema);
