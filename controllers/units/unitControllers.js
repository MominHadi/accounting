const Unit = require('../../models/unitModel');



exports.getAllUnits = async (req, res) => {

    try {

        const data = await Unit.find({ createdBy: req.user }).select("-createdAt -updatedAt  -__v").sort({ name: 1 });

        if (!data) {
            return res.status(200).json({ message: "Data not Found!!!" })
        }

        res.status(200).json({ status: 'Success', message: "Units Fetched Succesfully", data: data })

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error })
    }
}

exports.getUnitById = async (req, res) => {

    try {
        const { unitId } = req.params;

        const data = await Unit.findOne({ _id: unitId, createdBy: req.user }).select("-createdAt -updatedAt -createdBy -conversionReferences  -__v");

        if (!data) {
            return res.status(200).json({ message: "Unit not Found!!!" })
        }

        res.status(200).json({ status: 'Success', message: "Unit Fetched Successfully", data: data })

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error })
    }
}



exports.createUnit = async (req, res) => {

    try {
        const { name, shortName } = req.body;

        if (!name || !shortName) {
            return res.status(400).json({ message: 'All Fields are required' });
        }

        //Finding Duplicate Entry
        let isUnitExists = await Unit.findOne({ name, createdBy: req.user });

        if (isUnitExists) {
            return res.status(409).json({ status: "Failed", message: 'Unit Already Exists' });
        }

        const addUnit = await Unit.create({ name, shortName, createdBy: req.user })
        if (addUnit) {
            res.status(201).json({ status: 'Success', message: "Unit Added Succesfully", data: addUnit })
        }

    } catch (error) {
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error })
    }
}

exports.updateUnit = async (req, res) => {

    try {
        const { unitId } = req.params;
        const { name, shortName } = req.body;

        if (!unitId || !name || !shortName) {
            return res.status(400).json({ message: 'All Fields are required' });
        }

        // const isUnitExists = await Unit.findOne({ name })

        // if (isUnitExists) {
        //     return res.status(409).json({ status: "Failed", message: "Unit already Exists" })
        // }

        const updatedUnit = await Unit.findOneAndUpdate({ _id: unitId, createdBy: req.user },
            { name, shortName, updatedAt: Date.now() },
            { runValidators: true, new: true })

        if (!updatedUnit) {
            return res.status(404).json({ status: 'Failed', message: 'Unit Not Found' });
        }

        res.status(200).json({ status: "Success", message: 'Unit Updated Successfully', data: updatedUnit });

    }
    catch (error) {
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error.message });
    }
}

exports.deleteUnit = async (req, res) => {
    try {
        const { unitId } = req.params;

        // Validate if Unit Id is provided
        if (!unitId) {
            return res.status(400).json({ status: 'Failed', message: 'Unit ID is required' });
        }

        const isUnitExist = await Unit.findById(unitId);

        if (!isUnitExist) {
            return res.status(404).json({ status: 'Failed', message: 'Unit Not Found' });
        }

        // Delete the category
        await Unit.findByIdAndDelete(unitId);

        res.status(200).json({ status: 'Success', message: 'Unit Deleted Successfully' });
    } catch (error) {

        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message
        });

    }
};


getTransactionsOfUnit = async (req, res) => {
    try {

    } catch (error) {

        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });

    }
}