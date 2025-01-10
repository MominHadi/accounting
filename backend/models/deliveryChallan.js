const mongoose = require("mongoose");


const deliveryChallanSchema = new mongoose.Schema({
    challanNo: {
        type: String,
    },
    invoiceDate: {
        type: Date,
    },
    dueDate: {
        type: Date,
        required: true
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: true
    },
    partyName:{
        type:String,
        default:""
    },
    billingAddress: {
        type: String,
        // required: true
        default: ""
    },
    image: {
        type: String,
    },

    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State'
    },
    description: {
        type: String,
        default:""
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
                ref: 'Units',
                default:null
            },
            price: {
                type: Number,
                default: 0
            },
            discountPercent: {
                type: Number,
                default: 0
                // required: true
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "taxRates",
                // required: true
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
    status: {
        type: String,
        required: true,
        enum: ['Open', 'Closed']

    }, isConverted: {
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
            enum: ["Invoices"],
            default: null
        },
        documentNo: {
            type: Number,
            default: null
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    }, createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { timestamps: true });


deliveryChallanSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    // Check if isConverted is being set to true
    if (update.isConverted === true || (update.$set && update.$set.isConverted === true)) {
        const conversionDetails = update.conversionDetails || (update.$set && update.$set.conversionDetails);

        if (update.$set) {
            update.$set.status = "Closed"; // Set status to "Closed" in the update object
        } else {
            update.status = "Closed";
        }
        // Validate conversionDetails if isConverted is true
        if (!conversionDetails || !conversionDetails.documentId || !conversionDetails.documentType || !conversionDetails.documentNo) {
            return next(new Error('Conversion details is required when isConverted is set to true.'));
        }
    }

    // If isConverted is false or not set to true, no validation is required
    next();
});

module.exports = mongoose.model("Challan", deliveryChallanSchema);