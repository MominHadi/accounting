const mongoose = require('mongoose');

const taxRatesSchema = new mongoose.Schema({
    taxType: {
        type: String,
        required: true,
        enum: ['GST', 'IGST', 'CGST', 'SGST','VAT'], 
    },
    rate: {
        type: String,
        required: true,
    }
}, {
     timestamps: true
});

// Create the model
const TaxRates = mongoose.model('taxRates', taxRatesSchema);

module.exports = TaxRates;
