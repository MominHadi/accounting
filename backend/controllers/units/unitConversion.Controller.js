const Units = require('../../models/unitModel');
const UnitConversions = require("../../models/unitConversionModel");
const mongoose = require('mongoose');

//Utility FUnction
const fetchUnitId = async (unit, userId, res) => {

    const UnitDetails = await Units.findOne({ name: unit, createdBy: userId })

    if (!UnitDetails) {
        return res.status(404).json({ message: `Unit-${unit} Not Found` })
    };

    return UnitDetails._id;
};

//COntrollers



exports.addConversionForUnit = async (req, res) => {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {

        let { baseUnit, secondaryUnit, rate } = req.body;

        if (!baseUnit || !secondaryUnit || !rate) {
            return res.status(400).json({ status: "Failed", message: `All Fields are Required.` });
        };

        let baseUnitId = await fetchUnitId(baseUnit, req.user, res);
        let secondaryUnitId = await fetchUnitId(secondaryUnit, req.user, res);

        console.log(baseUnitId, secondaryUnitId, 'Secondary Unit Id');

        let data = {
            baseUnit: baseUnitId,
            secondaryUnit: secondaryUnitId,
            conversionRate: rate,
            createdBy: req.user
        };

        console.log(data, 'Data')

        let newUnitConversion = await UnitConversions.create([data], { session });


        if (!newUnitConversion) {
            throw new Error('Error in Saving Unit Conversion...');
        };

        console.log(newUnitConversion[0]._id, `newUnitConversion`);

        let updatedBaseUnit = await Units.findOneAndUpdate({ _id: baseUnitId, createdBy: req.user },
            { $push: { conversionReferences: newUnitConversion[0]._id } }
            , { new: true, session });


        if (!updatedBaseUnit) {
            throw new Error('Error in Updating Base Unit.');
        };

        await session.commitTransaction();

        res.status(201).json({ status: 'Success', message: 'Unit Conversion Added Successfully', data: newUnitConversion })
    }
    catch (error) {
        console.log(error);
        await session.abortTransaction();
        res.status(500).json({ message: `Internal Sever Error`, error: error.message || error });
    } finally {
        session.endSession();
    }
};



exports.getConversionForUnit = async (req, res) => {
    try {

        const { unitId } = req.params;

        const data = await Units.findOne({ _id: unitId, createdBy: req.user }).populate({
            path: "conversionReferences",
            populate: {
                path: "baseUnit secondaryUnit",
                select: "name shortName "
            },
            select: "baseUnit secondaryUnit conversionRate"
        }).select("conversionReferences");

        if (!data || data?.conversionReferences?.length <= 0) {
            return res.status(200).json({ message: "Conversions not Found for given Unit!!!", data: [] })
        };

        res.status(200).json({ status: 'Success', message: "Conversions Fetched for Unit Successfully", data: data })


    } catch (error) {
        console.log(error);
        res.status(500).json({ message: `Internal Sever Error`, error: error.message || error });
    }
}