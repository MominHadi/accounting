const Quotations = require("../../models/quotationModel");
const Parties = require("../../models/partyModel");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel");
const SeriesNumber = require("../../models/seriesnumber");
const Transactions = require("../../models/transactionModel");
const mongoose = require("mongoose");
const formatDate = require("../../global/formatDate");
const { deleteFile } = require('../../global/deleteFIle');
const { findOrCreateParty } = require('../../utils/partyUtils');
const { processItems } = require('../../utils/itemUtils');

exports.getAllQuotations = async (req, res) => {
    try {
        const { fromDate, toDate, search } = req.query;
        let searchConditions = { createdBy: req.user };

        // Date range filter
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            searchConditions.invoiceDate = { $gte: startDate, $lte: endDate };
        }

        // Main query to fetch quotations from MongoDB without search
        const quotationList = await Quotations
            .find(searchConditions)
            .populate({
                path: "party",
                select: "name email", // Select relevant fields
            })
            .select("referenceNo party invoiceDate totalAmount balance status isConverted conversionDetails")
            .sort({ invoiceDate: -1 });

        // Function to apply search filter to each field
        const searchFilter = (quotation, search) => {
            const regex = new RegExp(search, 'i');

            // Check for matches in the relevant fields
            const partyNameMatch = quotation.party && quotation.party.name && regex.test(quotation.party.name);
            const partyEmailMatch = quotation.party && quotation.party.email && regex.test(quotation.party.email);
            const referenceNoMatch = quotation.referenceNo && regex.test(quotation.referenceNo);
            const statusMatch = quotation.status && regex.test(quotation.status);
            const conversionDetailsMatch = quotation.conversionDetails && regex.test(quotation.conversionDetails.documentType);
            const documentNoMatch = quotation.conversionDetails && regex.test(quotation.conversionDetails.documentNo);
            const totalAmountMatch = quotation.totalAmount && regex.test(quotation.totalAmount);
            const balanceMatch = quotation.balance && regex.test(quotation.balance);

            // Return true if any field matches the search
            return (
                partyNameMatch ||
                partyEmailMatch ||
                statusMatch ||
                conversionDetailsMatch ||
                documentNoMatch ||
                totalAmountMatch ||
                balanceMatch
            );
        };

        // Filter quotations based on search query
        const filteredQuotations = search
            ? quotationList.filter(quotation => searchFilter(quotation, search))
            : quotationList;

        // Format the quotations with custom fields
        const formattedQuotations = filteredQuotations.map(quotation => {
            const formattedDate = formatDate(quotation.invoiceDate);
            let conversionStatus = quotation.isConverted ?
                `Converted to ${quotation.conversionDetails.documentType} ${quotation.conversionDetails.documentNo}` : "None";

            return {
                ...quotation._doc,
                invoiceDate: formattedDate,
                conversionStatus
            };
        });

        // Send response with the formatted data
        res.status(200).json({ status: "Success", data: formattedQuotations });
    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};


exports.getReferenceNo = async (req, res) => {

    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("quotationReferenceNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
}

exports.getQuotationById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Quotation Id is Required" })
        }

        const invoiceData = await Quotations
            .findOne({ _id: id, createdBy: req.user })
            .populate('stateOfSupply')
            .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
            .populate({ path: "items.unit", select: " _id name" })
            .populate({ path: "items.taxPercent" });

        if (!invoiceData) {
            return res.status(404).json({ error: "Quotation not Found!!!!" })
        }

        invoiceData.invoiceDate = formatDate(invoiceData.invoiceDate);
        res.status(200).json({ status: "Success", data: invoiceData });
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};

exports.createQuoation = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { partyName, referenceNo, invoiceDate, stateOfSupply, description, image, items, roundOff, totalAmount } = req.body;
        let partyId;

        items = items ? JSON.parse(items) : [];
        let imagePath = "";

        if (req.files && req.files.length > 0) {
            for (const image of req.files) {

                imagePath = image.filename
            }
        }

        // const isReferenceExists = await Quotations.findOne({ referenceNo, createdBy: req.user })

        // if (isReferenceExists) {
        //     return res.status(409).json({ status: "Failed", message: "Reference No. already Exists" });
        // }

        // Verify if the party exists
        // const partyExists = await Parties.findOne({ _id: partyId, createdBy: req.user });
        // if (!partyExists) {
        //     return res.status(404).json({ status: "Failed", message: "Party not found" });
        // };

        partyId = await findOrCreateParty(partyName, req.user, session);

        //verifying and Formatting Items(if item exist)  
        if (items.length > 0) items = await processItems(items, req.user, session);


        if (!stateOfSupply) stateOfSupply = null;

        const savedQuotation = await Quotations.create([{
            party: partyId, referenceNo, invoiceDate, stateOfSupply, description, image: imagePath, items, status: "Open", roundOff, totalAmount, balance: totalAmount, createdBy: req.user
        }], { session })

        const transactionReference = {
            documentId: savedQuotation[0]._id,
            documentNumber: referenceNo,
            docName: "Quotations"
        };

        const savedTransaction = await Transactions.create([{
            transactionType: "Estimate", transactionDate: invoiceDate, totalAmount, party: partyId, credit_amount: totalAmount, balance: 0, description, reference: transactionReference, paymentMethod: [], createdBy: req.user
        }], { session });


        if (!savedTransaction) {
            throw new Error("Failed to save Transaction");
        };


        let getLatestQuotationReferenceNo = await SeriesNumber.findOne({ createdBy: req.user }).select('quotationReferenceNo');

        if (+referenceNo >= getLatestQuotationReferenceNo.quotationReferenceNo) {


            // Increment the seriesValue by 1 in the Series collection
            const updatedSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { $inc: { quotationReferenceNo: +1 } },
                { new: true, session } // Ensure this runs within the session
            );

            if (!updatedSeries) {
                throw new Error("Failed to update series value");
            }
        }

        // Commit the transaction if everything is successful

        await session.commitTransaction();

        res.status(201).json({ status: "Success", message: "Quotation Saved Successfully", data: savedQuotation });
    } catch (error) {

        // If any operation fails, abort the transaction
        await session.abortTransaction();
        console.log(error, 'Errops')
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error
        });
    } finally {
        // End the session outside of the try-catch block
        session.endSession();
    }
}

exports.updateQuotation = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        let { partyName, referenceNo, invoiceDate, stateOfSupply, description, image, items, roundOff, totalAmount } = req.body;

        let partyId;
        if (items) {
            items = JSON.parse(items)
        } else items = [];

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



        const existingQuotation = await Quotations.findOne({ _id: id, createdBy: req.user })

        if (existingQuotation.isConverted) {
            return res.status(200).json({ message: "Quotation cannot be updated as it is already converted into Sale" })
        }

        //verifying and Formatting Items(if item exist) 
        // if (items.length > 0) {
        //     for (const item of items) {
        //         //CHecking if the unit exist or not
        //         let existingUnit = await Units.findOne({ name: item.unit, createdBy: req.user });

        //         if (!existingUnit) {
        //             console.log(`Unit Not Found`)
        //             return res.status(400).json({ status: 'Failed', message: 'Unit not Found' });
        //         }

        //         else item.unit = existingUnit._id;

        //         //Checking if the item is created (if not then creating new one):
        //         let existingItem = await Products.findOne({ itemName: item.name, createdBy: req.user })

        //         if (!existingItem) {
        //             console.log("item not found in Edit Invoice")

        //             let itemName = item.name;

        //             const saveItem = await Products.create([{
        //                 itemName,
        //                 stock: { price: item.price },
        //                 salePrice: item.price, createdBy: req.user
        //             }], { session })


        //             if (!saveItem) {
        //                 throw new Error(`Error during saving new Item`);
        //             }

        //             item.itemId = saveItem[0]._id

        //         } else
        //             item.itemId = existingItem._id

        //         delete item.name;
        //     }
        // }

        //verifying and Formatting Items(if item exist)  
        if (items.length > 0) items = await processItems(items, req.user, session);




        // Find the existing quotation by ID and update it
        const updatedQuotation = await Quotations.findOneAndUpdate(
            { _id: id, createdBy: req.user }, // The ID of the quotation to update
            {
                party: partyId,
                referenceNo,
                invoiceDate,
                stateOfSupply,
                description,
                image: imagePath,
                items,
                roundOff,
                totalAmount,
                balance: totalAmount
            },
            { new: true, session } // Return the updated document
        );

        if (!updatedQuotation) {
            return res.status(404).json({ status: "Failed", message: "Quotation not found" });
        }

        // Update the related transaction document
        const transactionReference = {
            documentId: updatedQuotation._id,
            documentNumber: referenceNo,
            docName: "Quotations"
        };

        const updatedTransaction = await Transactions.findOneAndUpdate(
            { "reference.documentId": updatedQuotation._id, createdBy: req.user }, // Match transaction with the quotation ID
            {
                party: partyId,
                totalAmount,
                transactionDate: invoiceDate,
                credit_amount: totalAmount,
                balance: 0,
                description,
                reference: transactionReference
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update Transaction");
        }

        // Commit the transaction if everything is successful
        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Quotation Updated Successfully", data: updatedQuotation });
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

exports.deleteQuotation = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;

        // Find and delete the quotation by IDn 
        const QuotationToDelete = await Quotations.findOne({ _id: id, createdBy: req.user });

        if (QuotationToDelete.image) {
            await deleteFile(QuotationToDelete.image, 'images');
        };

        const deletedQuotation = await Quotations.findOneAndDelete({ _id: id, createdBy: req.user }, { session });

        if (!deletedQuotation) {
            return res.status(404).json({ status: "Failed", message: "Quotation not found" });
        }

        // Delete the related transaction document
        const deletedTransaction = await Transactions.findOneAndDelete({
            "reference.documentId": deletedQuotation._id,
            createdBy: req.user
        }, { session });

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated Transaction");
        }

        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Quotation deleted successfully" });

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


exports.getTransaction = async (req, res) => {

    try {
        const getTransactions = await Transactions.find({ createdBy: req.user }).populate('reference.documentId')


        res.status(200).json({ message: "Transaction Fetched Successfully", data: getTransactions })
    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error
        });
    }
}