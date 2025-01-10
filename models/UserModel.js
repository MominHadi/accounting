const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNo: {
        type: String,
        required: true,
        maxlength: 30,
    },
    email: {
        type: String,
        required: false,
    },
    passCode: {
        type: String,
        default: ""
    },
    otpCode: {
        type: String,
        default: null,
    },
    otpExpiration: {
        type: Date,
        default: null,
    },
    isPhoneNoVerified: {
        type: Boolean,
        default: false
    },
    businessProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BusinessProfile',
        default: null
    },
    subUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]

}, { timestamps: true, collection: "users" });

module.exports = mongoose.model('Users', userSchema);
