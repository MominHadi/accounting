const ItemSettings = require("../../models/settings/itemSettings.Model");

exports.enableOrDisableTaxPercent = async (req, res) => {
    try {

        let { gstTax, vatTax } = req.body;

        if (typeof gstTax !== "boolean") {
            return res.status(400).json({ status: "Failed", message: "Enter Valid GST Tax Value" });
        };

        if (typeof vatTax !== "boolean") {
            return res.status(400).json({ status: "Failed", message: "Enter Valid VAT Tax Value" });
        };

        if (vatTax && gstTax) {
            return res.status(400).json({ status: "Failed", message: "You can enable only one Tax." });
        };

        let payload = {
            enableGstPercent: gstTax,
            enableVatPercent: vatTax,
        };

        let updatedItemSettings = await ItemSettings.findOneAndUpdate({ createdBy: req.user }, payload);

        if (!updatedItemSettings) {
            throw new Error(`Error Updating Item Settings`)
        };

        res.status(200).json({ status: 'Success', message: "Item Settings Updated Successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};

exports.getItemSettings = async (req, res) => {
    try {

        res.status(200).json({ status: 'Success', message: "Item Settings Fetched Successfully", data: req?.itemSettings })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}
