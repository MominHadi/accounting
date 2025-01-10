const mongoose = require('mongoose');

const LoanAccountModel = new mongoose.Schema({
    bankDetails: {
        accountName: {
            type: String,
            default: ""
        },
        lenderBank: {
            type: String,
            default: ""
        },
        accountNumber: {
            type: String,
            default: ""
        },
        description: {
            type: String,
            default: ""
        }
    },
    loanDetails: {
        openingBalance: {
            type: Number,
            default: 0,
            required: true
        },
        balanceAsOf: {
            type: Date,
            default: Date.now
        },
        loanReceived: {
            type: String,
            enum: ["cash", "bank"],
            required: true,
        },
        bankName: {
            type: mongoose.Types.ObjectId,
            required: function () {
                return this.loanReceived === "bank";
            },
            default: null
        },
        interestRate: {
            type: Number,
            default: 0,
        },
        termDuration: {
            type: Number,
            default: 0,
        },
        processingFees: {
            type: Number,
            default: 0,
        },
        processingFeePaid: {
            type: String,
            enum: ["cash", "bank"],
            required: true,
        },
        processingFeeBankName: {
            type: mongoose.Types.ObjectId,
            required: function () {
                return this.loanReceived === "bank";
            },
            default: null
        }
    },
    totalLoanAmount: {
        type: Number,
        default: 0
    },
    totalPaidAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    }

}, { timestamps: true });


module.exports = mongoose.model('loanAccounts', LoanAccountModel);