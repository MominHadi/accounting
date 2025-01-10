const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({

    type: {
        type: String,
        enum: ["Product", "Service"],
        default: "Product"
    },
    itemName: {
        type: String,
        default: "",
        required: true
    },
    itemHsn: {
        type: String,
        // required: true
    },
    category: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categories"
    }],
    itemCode: {
        type: String,
        default: ""
        // unique: true, // Assuming item codes should be unique
    },
    unit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Units',
        default: null
    },
    mrp: {
        type: Number,
        default: 0
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
    purchasePrice: {
        type: Number,
        default: 0
    },
    purchasePriceIncludesTax: {
        type: Boolean,
        default: false
    },
    taxRate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "taxRates",
        required: false,
        default: null

    },
    stock: {
        openingQuantity: {
            type: Number,
            default: 0,
            // required: true // Starting opening quantity
        },
        saleQuantity: {
            type: Number,
            default: 0,// Sold quantity
            // required: true,
        },
        purchaseQuantity: {
            type: Number,
            default: 0,// Sold quantity
            // required: true,
        },
        totalQuantity: {
            type: Number,
            default: 0,
            // required: true // Starting opening quantity
        },
        price: {
            type: Number,
            default: 0
        },
        minStockToMaintain: {
            type: Number,
            default: 0 // Minimum stock level to maintain
        },
        location: {
            type: String, // Storage location of the item
            default: ""
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    image: [
        {
            type: String
        }
    ],

    isActive: {
        type: Boolean,
        default: true
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
});

module.exports = mongoose.model('Products', ProductSchema);
