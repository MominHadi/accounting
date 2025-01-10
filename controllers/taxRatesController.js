const TaxRates = require('../models/taxModel');


exports.getAllTaxRates = async (req, res) => {
    try {
        if (verifyTaxRates(req) == false) {
            return res.status(200).json({
                status: "Invalid Request",
                message: "Please enable VAT or GST to retrieve the tax rates list."
            })
        };

        const taxRatesData = await TaxRates
            .find({ taxType: { $in: [fetchSelectedTaxType(req), 'Exempt'] } })
            .sort({ rate: 1 });

        if (!taxRatesData) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: taxRatesData })
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};


const verifyTaxRates = (req) => {

    let { enableGstPercent, enableVatPercent } = req?.itemSettings


    if (!enableGstPercent && !enableVatPercent) {

        return false
    };
    return true

};


const fetchSelectedTaxType = (req) => {
    let { enableGstPercent, enableVatPercent } = req?.itemSettings

    if (enableGstPercent) return "GST"
    else if (enableVatPercent) return "VAT"
}