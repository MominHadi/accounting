const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema({
    referenceNo: {
        type: String,
        default: ""
    },
    invoiceDate: {
        type: Date,
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party', // Reference to the Party model
        default: null
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State', // Reference to the States model
    },
    description: {
        type: String
    },
    image: {
        type: String
    },
    items: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Products',
                required: true
            },
            quantity: {
                type: Number,
                default: 0
            },
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Units",
                default: null
            },
            price: {
                type: Number,
                default: 0
            },
            discountPercent: {
                type: Number,
                default: 0
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "taxRates",
                default: null
            },
        }
    ],
    roundOff: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    isConverted: {
        type: Boolean,
        default: false
    },
    conversionDetails: {
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'reference.documentType'
        },
        documentType: {
            type: String,
            enum: ["SaleOrder", "Invoices"],
            default:null
        },
        documentNo: {
            type: String,
            default: ""
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    status: {
        type: String,
        required: true,
        enum: ['Open', 'Completed']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    }

}, { timeStamps: true });

quotationSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    // Check if isConverted is being set to true
    if (update.isConverted === true || (update.$set && update.$set.isConverted === true)) {
        const conversionDetails = update.conversionDetails || (update.$set && update.$set.conversionDetails);


        if (update.$set) {
            update.$set.status = "Closed"; // Set status to "Closed" in the update object
        } else {
            update.status = "Closed"
        }

        // Validate conversionDetails if isConverted is true
        if (!conversionDetails || !conversionDetails.documentId || !conversionDetails.documentType || !conversionDetails.documentNo) {
            return next(new Error('Conversion details is required when isConverted is set to true.'));
        }
    }  

    // If isConverted is false or not set to true, no validation is required
    next();
});
     
module.exports = mongoose.model("Quotations", quotationSchema);