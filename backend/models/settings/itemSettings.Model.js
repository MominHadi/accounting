const mongoose = require('mongoose');

// Item Settings schema
const itemSettingsSchema = new mongoose.Schema({
    enableItem: {
        type: Boolean,
        default: true
    },
    whatDoYouSell: {
        type: String,
        enum: ['Product/Service', 'Product', 'Service'],
        default:'Product/Service'
    },
    barcodeScan: {
        type: Boolean,
        default: false
    },
    stockMaintainance: {
        type: Boolean,
        default: false
    },
    showLowStockDialog: {
        type: Boolean,
        default: false
    },
    enableItemsUnit: {
        type: Boolean,
        default: true
    },
    enableDefaultUnit: {
        type: Boolean,
        default: false
    },
    defaultUnit: {
        type: mongoose.Types.ObjectId,
        default: null
    },
    enableItemCategory: {
        type: Boolean,
        default: false
    },
    enableItemwiseTax: {
        type: Boolean,
        default: false
    },
    enableItemwiseDiscount: {
        type: Boolean,
        default: false
    },
    enableWholeSalePrice: {
        type: Boolean,
        default: false
    },
    enableGstPercent:{
        type: Boolean,
        default: false
    },
    enableVatPercent:{
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }
});


module.exports = mongoose.model(`itemSettings`, itemSettingsSchema);