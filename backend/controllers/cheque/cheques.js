const Transactions = require("../../models/transactionModel");
const Cheques = require("../../models/chequeModel");
const ChequeTransfer = require("../../models/chequeTransferModel");
const mongoose = require("mongoose");
const formatDate = require('../../global/formatDate');

exports.getTransactionForCheques = async (req, res) => {
    try {

        const { sortBy, status } = req.query;
        let searchOptions;

        searchOptions = {
            createdBy: new mongoose.Types.ObjectId(req.user)
        };

        if (status && status.trim().toLowerCase() !== "all") {
            searchOptions.status = status.trim().toLowerCase();
        };

        let query = Cheques.find(searchOptions).select('partyName status amount referenceNo date source transactionType');

        if (!sortBy) {
            query = query.sort({ date: -1, amount: -1 });
        } else if (sortBy.trim().toLowerCase() === 'amount') {
            query = query.sort({ amount: -1 });
        }
        else if (sortBy.trim().toLowerCase() === 'date') {
            query = query.sort({ date: -1 });
        };

        let chequeList = await query;


        chequeList=  chequeList.map(cheque => {
            return {
                ...cheque._doc,
                date: formatDate(cheque.date)
            }
        })
        res.status(200).json({ message: "Cheque List Fetched successfully", data: chequeList })

    } catch (error) {
        console.log(error);

        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message
        });

    }
};


exports.reOpenCheque = async (req, res) => {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {

        let { chequeId } = req.params;

        if (!chequeId) {
            return res.status(400).json({ status: "Failed", message: "Cheque Id is required" });
        };

        let updateChequeStatus = await Cheques.findByIdAndUpdate(chequeId, {
            transferId: null,
            status: "open",
        }, { session });

        if (!updateChequeStatus) {
            return res.status(404).json({ status: "Failed", message: "Cheque not found" });
        };

        //Deleting CHeque Transfer
        await ChequeTransfer.findOneAndDelete({ createdBy: req.user, cheque: chequeId }, { session })

        await session.commitTransaction()

        return res.status(200).json({ status: "Success", message: "Status Updated Successfully" });


    } catch (error) {

        await session.abortTransaction()
        console.log(error);
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error.message });

    }

}