
const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({

    name: {
        type: String,
        default: ""
    },
    gstIn: {
        type: String
    },
    gstType: {
        type: String,
        enum: ['Unregistered/Consumer', 'Registered Business-Regular', 'Registered Business-Composition']
    },

    contactDetails: {
        email: {
            type: String,
        },
        phone: {
            type: String
        }
    },
    state: {
        type: mongoose.Types.ObjectId,
        ref: 'States',
        required: false,

    },
    billingAddress: {
        type: String
    },

    shippingAddress: {
        //If User enabled Shipping Address for  Parties
        type: String
    },
    openingBalanceDetails: {
        openingBalance: {
            type: Number,
            default: 0
        },
        date: {
            type: Date
        },
        balanceType: {
            type: String,
            enum: ['toPay', 'toReceive'],
            default: 'toReceive'
        }
    },

    creditLimit: {
        type: Number,
        default: 0
    },

    balanceDetails: {
        receivableBalance: {
            type: Number,
            default: 0
        },
        payableBalance: {
            type: Number,
            default: 0
        },
    },

    receivedAmount: {
        type: Number,
        default: 0,
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    additionalField1: {
        type: String
    },
    additionalField2: {
        type: String
    },
    additionalField3: {
        type: String
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


})


module.exports = mongoose.model('Party', partySchema);