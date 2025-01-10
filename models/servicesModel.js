const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    itemName: {
        type: String,
        default: ""
    },
    itemHsn: {
        type: String,
    },
    category: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categories"
    }],
    itemCode: {
        type: String,
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Units',
        default: null
    },
    salePrice: {
        type: Number,
        default: 0
    },
    salePriceIncludesTax: {
        type: Boolean,
        default: false
    },
    discount: {
        value: {
            type: Number,
            default: 0
        },
        type: {
            type: String,
            enum: ['amount', 'percentage'],
            default: 'percentage'
        }
    },
    wholeSalePrice: {
        type: Number,
        default: 0
    },
    wholeSalePriceIncludesTax: {
        type: Boolean,
        default: false
    },
    taxRate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "taxRates",
        required: false,
        default: null
    },
    image: [
        {
            type: String
        }
    ],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { timestamps: true });

module.exports = mongoose.model('Products', ProductSchema);
