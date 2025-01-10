const SeriesNumber = require("../../models/seriesnumber");
const Transactions = require("../../models/transactionModel");
const Challans = require("../../models/deliveryChallan");
const Units = require("../../models/unitModel");
const Products = require("../../models/productModel");
const Parties = require("../../models/partyModel");
const mongoose = require("mongoose");
const formatDate = require("../../global/formatDate");
const { deleteFile } = require("../../global/deleteFIle");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require('../../utils/partyUtils');

exports.getAllChallans = async (req, res) => {
    try {
        let { search } = req.query;
        let searchConditions = { createdBy: req.user };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchNumeric = parseFloat(search);

            // Construct search conditions for both numeric and string matches
            const searchFields = {
                $or: [
                    ...(isNaN(searchNumeric) ? [] : [
                        { totalAmount: searchNumeric },
                        { challanNo: searchNumeric }
                    ]),
                    { challanNo: { $regex: searchRegex } },
                    { partyName: { $regex: searchRegex } },
                    { status: { $regex: searchRegex } },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
                                regex: search
                            }
                        }
                    }
                ]
            };

            // Combine default conditions with search logic
            searchConditions = {
                $and: [searchConditions, searchFields]
            };
        }

        // Fetch the filtered challans
        const ChallanList = await Challans.find(searchConditions)
            .select("invoiceDate challanNo totalAmount partyName status")
            .sort({ dueDate: -1 });

        // Format the dates for the response
        const formattedEntries = ChallanList.map(item => {
            const formattedInvoiceDate = formatDate(item.invoiceDate);
            const formattedDueDate = formatDate(item.dueDate);

            return {
                ...item._doc,
                invoiceDate: formattedInvoiceDate,
                dueDate: formattedDueDate,
            };
        });

        // Send the response
        res.status(200).json({ status: "Success", data: formattedEntries });
    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};


exports.getChallanById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Challan Id is Required" })
        }

        const invoiceData = await Challans
            .findOne({ _id: id, createdBy: req.user })
            // .select("-_id -sourceDetails ")
            // .populate({ path: "paymentMethod.bankName", select: " -_id bankName" })
            .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
            .populate({ path: "items.unit", select: "-_id name" })
            .populate({ path: "items.taxPercent" })
            .populate('stateOfSupply');

        if (!invoiceData) {
            return res.status(404).json({ error: "Challan not Found!!!!" });
        };

        invoiceData.invoiceDate = formatDate(invoiceData.invoiceDate);
        res.status(200).json({ status: "Success", data: invoiceData });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error: error });
    }
}

exports.getChallanNo = async (req, res) => {
    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("challanNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};


exports.createChallan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        let { partyName, billingAddress, challanNo, invoiceDate, dueDate, stateOfSupply, description, items, roundOff, totalAmount } = req.body;

        if (items) {
            items = JSON.parse(items)
        }
        else {
            items = []
        }

        let partyId;
        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        let imagePath = "";

        if (req.files && req.files.length > 0) {
            for (const image of req.files) {

                imagePath = image.filename
            }
        }

        const isChallanExists = await Challans.findOne({ challanNo, createdBy: req.user })

        // if (isChallanExists) {
        //     return res.status(409).json({ status: "Failed", message: "Challan No. already Exists" });
        // }

        // Verify if the party exists
        // const partyExists = await Parties.findOne({ _id: partyId, createdBy: req.user });
        // if (!partyExists) {
        //     return res.status(404).json({ status: "Failed", message: "Party not found" });
        // }

        partyId = await findOrCreateParty(partyName, req.user, session);

        //verifying and Formatting Items(if item exist)
        if (items.length > 0) {
            items = await processItems(items, req.user, session);
        }

        const savedChallan = await Challans.create([{
            party: partyId, partyName, challanNo, invoiceDate, dueDate, billingAddress, stateOfSupply, description, image: imagePath, items, status: "Open", roundOff, totalAmount, createdBy: req.user
        }], { session })

        const transactionReference = {
            documentId: savedChallan[0]._id,
            documentNumber: challanNo,
            docName: "Challan"
        };

        const savedTransaction = await Transactions.create([{
            transactionType: "Delivery Challan", party: partyId, credit_amount: 0, totalAmount, balance: 0, description, reference: transactionReference, paymentMethod: [], createdBy: req.user
        }], { session });


        if (!savedTransaction) {
            throw new Error("Failed to save Transaction");
        }


        let getLatestChallanNo = await SeriesNumber.findOne({ createdBy: req.user }).select('challanNo');

        if (+challanNo >= getLatestChallanNo.challanNo) {

            // Increment the seriesValue by 1 in the Series collection
            const updatedSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { challanNo: +challanNo + 1 },
                { new: true, session }
            );

            if (!updatedSeries) {
                throw new Error("Failed to update series value");
            }
        }

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        res.status(201).json({ status: "Success", message: "Challan Saved Successfully", data: savedChallan });
    } catch (error) {
        // If any operation fails, abort the transaction
        await session.abortTransaction();
        console.log(error)
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    } finally {
        session.endSession();
    }
}


exports.updateChallan = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        let { partyName, partyId, billingAddress, challanNo, invoiceDate, dueDate, stateOfSupply, description, image, items, roundOff, totalAmount } = req.body;
        // const itemsArray = JSON.parse(items);

        items = items ? JSON.parse(items) : [];
        // Convert necessary fields to ObjectId
        // // partyId = new mongoose.Types.ObjectId(partyId);
        // stateOfSupply = new mongoose.Types.ObjectId(stateOfSupply);

        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        let imagePath = "";

        if (req.files && req.files.length > 0) {
            for (const image of req.files) {
                imagePath = image.filename;
            }
        }

        // Verify if the party exists
        // const partyExists = await Parties.findOne({ _id: partyId, createdBy: req.user });
        // if (!partyExists) {
        //     return res.status(404).json({ status: "Failed", message: "Party not found" });
        // }

        partyId = await findOrCreateParty(partyName, req.user, session);

        //verifying and Formatting Items(if item exist)
        if (items.length > 0) items = await processItems(items, req.user, session);

        // Find the existing challan by ID and update it
        const updatedChallan = await Challans.findOneAndUpdate(
            { _id: id, createdBy: req.user },
            {
                party: partyId,
                partyName,
                challanNo,
                invoiceDate,
                dueDate,
                billingAddress,
                stateOfSupply,
                description,
                image: imagePath,
                items,
                roundOff,
                totalAmount,
            },
            { new: true, session }
        );

        if (!updatedChallan) {
            return res.status(404).json({ status: "Failed", message: "Challan not found" });
        }

        // Update the related transaction document
        const transactionReference = {
            documentId: updatedChallan._id,
            documentNumber: challanNo,
            docName: "Challan"
        };

        const updatedTransaction = await Transactions.findOneAndUpdate(
            { "reference.documentId": updatedChallan._id, createdBy: req.user }, 
            {
                party: partyId,
                credit_amount: 0,
                balance: 0,
                totalAmount,
                description,
                reference: transactionReference
            },
            { new: true, session }
        );

     
        // Commit the transaction if everything is successful
        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Challan Updated Successfully", data: updatedChallan });
    } catch (error) {
        // If any operation fails, abort the transaction
        await session.abortTransaction();

        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    } finally {
        session.endSession();
    }
};

exports.deleteChallan = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        // Find and delete the challan by ID
        const challanToDelete = await Challans.findOne({ _id: id, createdBy: req.user });

        const deletedChallan = await Challans.findOneAndDelete({ _id: id, createdBy: req.user }
            , { session });

        if (!deletedChallan) {
            return res.status(404).json({ status: "Failed", message: "Challan not found" });
        }

        if (challanToDelete.image) {
            await deleteFile(challanToDelete.image, 'images');
        };


        // Delete the related transaction document
        const deletedTransaction = await Transactions.findOneAndDelete({
            "reference.documentId": deletedChallan._id,
            createdBy: req.user
        }, { session });

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated Transaction");
        }

        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Challan deleted successfully" });

    } catch (error) {
        // If any operation fails, abort the transaction
        await session.abortTransaction();

        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    } finally {
        session.endSession();
    }
};
