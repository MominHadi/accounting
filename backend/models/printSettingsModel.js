const mongoose = require('mongoose');

// PrintX Settings schema
const printSettingsSchema = new mongoose.Schema({
    header: {
        showCompanyName: {
            type: Boolean,
            default: false
        },
        showCompanyLogo: {
            type: Boolean,
            default: false
        },
        showAddress: {
            type: Boolean,
            default: false
        },
        showEmail: {
            type: Boolean,
            default: false
        },
        phoneNumber: {
            type: Boolean,
            default: false
        },
        showGSTIN: {
            type: Boolean,
            default: false
        },

    },
    pdfProperties: {
        paperSize: {
            type: String,
            enum: ['A4', 'A5'],
            default: 'A4'
        },
        orientation: {
            type: String,
            enum: ['Portrait', 'Landscape'],
            default: 'Portrait'
        },
        companyNameSize: {
            type: String,
            enum: ['V. small', 'Small', 'Medium', 'Large', 'V. Large'],
            default: 'Large'
        },
        invoiceTextSize: {
            type: String,
            enum: ['V. small', 'Small', 'Medium', 'Large', 'V. Large'],
            default: "Medium"
        },
        extraSpaceOnTop: {
            type: Number,
            default: 0
        }
    },
    printOriginalOrDuplicate: {
        type: Boolean,
        default: false
    },
    transactionNames: {
        sale: {
            type: String,
            default: 'Tax Invoice',
        },
        purchase: {
            type: String,
            default: 'Bill',
        },
        paymentIn: {
            type: String,
            default: 'Payment Receipt',
        },
        paymentOut: {
            type: String,
            default: 'Payment Out',
        },
        expense: {
            type: String,
            default: 'Expense',
        },
        otherIncome: {
            type: String,
            default: 'Other Income',
        },
        saleOrder: {
            type: String,
            default: 'Sale Order',
        },
        purchaseOrder: {
            type: String,
            default: 'Purchase Order',
        },
        estimate: {
            type: String,
            default: 'Estimate',
        },
        deliveryChallan: {
            type: String,
            default: 'Delivery Challan',
        },
        creditNote: {
            type: String,
            default: 'Credit Note',
        },
        debitNote: {
            type: String,
            default: 'Debit Note',
        }
    },
    itemTable: {
        column: [
            { type: String }
        ],
        minimumRow: {
            type: Number,
            default: 0
        }
    },
    totalAndTaxes: {
        showTotalItemQuantity: {
            type: Boolean,
            default: true
        },
        showDecimalAmount: {
            type: Boolean,
            default: true
        },
        showReceivedAmount: {
            type: Boolean,
            default: true
        },
        showBalanceAmount: {
            type: Boolean,
            default: true
        },
        showCurrentBalanceOfParty: {
            type: Boolean,
            default: false
        },
        showTaxDetails: {
            type: Boolean,
            default: true
        }
    },
    footer: {
        termsAndCondtion: {
            saleInvoice: {
                type: String,
                default: 'Thanks for doing business with us!'
            },
            saleOrder: {
                type: String,
                default: 'Thanks for doing business with us!'
            },
            deliveryChallan: {
                type: String,
                default: 'Thanks for doing business with us!'
            },
            Estimate: {
                type: String,
                default: 'Thanks for doing business with us!'
            },
            purchaseBill: {
                type: String,
                default: 'Thanks for doing business with us!'
            },
            purchaseOrder: {
                type: String,
                default: 'Thanks for doing business with us!'
            }
        },

        printReceivedByDetails: {
            type: Boolean,
            default: false
        },

        printDeliveredByDetails: {
            type: Boolean,
            default: false
        },

        showSignatureText: {
            type: Boolean,
            default: true
        },
        signatureText: {
            type: String,
            default: "Authorized Signatory"
        },
        showPaymentMode: {
            type: Boolean,
            default: false
        },
        printAcknowledgement: {
            type: Boolean,
            default: false
        }
    },
    createdBy:{
        type:mongoose.Types.ObjectId,
        ref:'User'
    }

});


module.exports = mongoose.model(`printSettings`, printSettingsSchema);