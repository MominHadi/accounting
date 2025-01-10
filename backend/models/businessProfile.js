const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({

    businessName: {
        type: String,
        required: false,
        default: ""
    },
    email: {
        type: String,
        required: false,
        default: ""
    },
    gstIn: {
        type: String,
        default: ""
    },
    logo: {
        type: String,
        default: ""
    },
    phoneNo: {
        type: String,
        default: ""
    },
    businessAddress: {
        type: String,
        default: ""
    },
    businessType: {
        type: String,
        enum: ['None', 'Retail', 'Wholesale', 'Distributor', 'Service', 'Manufacturing'],
        default: 'None',
    },
    businessCategory: {
        type: String,
        default: ""
    },
    pincode: {
        type: String,
    },
    state: {
        type: String,
        default: '',
    },
    businessDescription: {
        type: String,
        maxlength: 160,
        default: ""
    },
    signature: {
        type: String,
        default: ""
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
    },
}, { timestamps: true, collection: "businessProfiles" });

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
