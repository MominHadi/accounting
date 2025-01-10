const mongoose = require('mongoose');

// General Settings schema
const generalSettingsSchema = new mongoose.Schema({
    general: {

        businessCurrency: { type: String, default: "Rs." },
        gstinNumber: { type: String, default: "" },
        enablePasscode: { type: Boolean, default: false },
        enableTransaction: {
            Estimate: {
                type: Boolean,
                default: true
            },
            saleAndPurchaseOrder: {
                type: Boolean,
                default: true
            },
            otherIncome: {
                type: Boolean,
                default: false
            },
            fixedAsset: {
                type: Boolean,
                default: false
            },
            deliveryChallan: {
                type: Boolean,
                default: false
            }
        }
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }

}, { timestamps: true });

module.exports = mongoose.model('GeneralSettings', generalSettingsSchema)
