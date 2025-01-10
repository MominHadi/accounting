const States=require('../../models/stateModel');

exports.getAllStates = async (req, res) => {

    try {
        const stateData = await States
            .find({ createdBy: req.user })
            .select("name code")
            .sort({ name: 1 })


        if (!stateData) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

     
        res.status(200).json({ status: "Success", data: stateData })
    }
    catch (error) {

        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};