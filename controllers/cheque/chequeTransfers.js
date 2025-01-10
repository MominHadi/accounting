const ChequeTransfers = require("../../models/chequeTransferModel");
const Cheques = require("../../models/chequeModel");
const Banks = require('../../models/bankModel');
const Parties = require('../../models/partyModel');

exports.createChequeTransfer = async (req, res) => {
    try {

        let { chequeId, transactionType, party, amount, accountName, referenceNo, transferDate, description, partyId } = req.body;

        if (!transactionType || !['withdraw', 'deposit'].includes(transactionType)) {
            return res.status(400).json({
                status: "Failed",
                message: "Transaction Type should be 'withdraw' or 'deposit'.",
            });
        }

        if (!party) {
            return res.status(400).json({ status: "Failed", message: "Party Name is required." });
        };

        if (!chequeId) {
            return res.status(400).json({ status: "Failed", message: "Cheque Id is required." });
        };

        if (!amount || amount <= 0) {
            return res.status(400).json({
                status: "Failed",
                message: "Amount should be greater than 0.",
            });
        };

        let PartyDetails = await Parties.findOne({
            name: { $regex: new RegExp("^" + party + "$", "i") }
            , createdBy: req.user
        });

        if (!PartyDetails) return res.status(404).json({ nessage: 'Party not found!!!' });

        partyId = PartyDetails._id;

        let bankDetails = null;

        if (accountName !== 'Cash') {
            bankDetails = await Banks.findOne({
                bankName: { $regex: new RegExp("^" + accountName + "$", "i") }
                , createdBy: req.user
            });

            if (!bankDetails) {
                return res.status(404).json({
                    status: "Failed",
                    message: "Bank not found.",
                });
            };
        };

        accountName = accountName?.trim() === "Cash" ? accountName : "Bank";

        // Validate the cheque ID
        const cheque = await Cheques.findById(chequeId);
        if (!cheque) {
            return res.status(404).json({ status: "Failed", message: "Cheque not found!" });
        };

        let source = cheque.source;
        let sourceId = cheque.reference;


        // Create a new cheque transfer
        const newChequeTransfer = await ChequeTransfers.create({
            transactionType,
            accountName,
            bank: bankDetails ? bankDetails?._id : null,
            amount,
            referenceNo: referenceNo || 'N/A',
            transferDate,
            description,
            source,
            sourceId,
            cheque: chequeId,
            createdBy: req.user,
        });

        //Update status to close and transferId of cheque
        await Cheques.findByIdAndUpdate(chequeId, {
            transferId: newChequeTransfer._id,
            status: 'close'
        }, { runValidators: true })

        return res.status(201).json({
            status: "Success",
            message: "Cheque transfer created successfully.",
            data: newChequeTransfer,
        });

    }
    catch (error) {
        console.log(error);

        return res.status(500).json({
            status: "Failed",
            message: "An error occurred while creating the cheque transfer.",
        });

    }
};


exports.editChequeTransfer = async (req, res) => {
    try {
        const { chequeTransferId } = req.params;
        let { chequeId, transactionType, party, amount, accountName, referenceNo, transferDate, description } = req.body;

        // Validate transaction type
        if (transactionType && !['withdraw', 'deposit'].includes(transactionType)) {
            return res.status(400).json({
                status: "Failed",
                message: "Transaction Type should be 'withdraw' or 'deposit'.",
            });
        };

        // Validate chequeTransferId
        const existingChequeTransfer = await ChequeTransfers.findById(chequeTransferId);
        if (!existingChequeTransfer) {
            return res.status(404).json({
                status: "Failed",
                message: "Cheque transfer not found.",
            });
        };

        // Validate bank details
        let bankDetails = null;
        if (accountName && accountName !== 'Cash') {
            bankDetails = await Banks.findOne({
                bankName: { $regex: new RegExp("^" + accountName + "$", "i") },
                createdBy: req.user,
            });

            if (!bankDetails) {
                return res.status(404).json({ status: "Failed", message: "Bank not found." });
            }
        }

        accountName = accountName?.trim() === "Cash" ? accountName : "Bank";

        // Update cheque transfer details
        const updatedChequeTransfer = await ChequeTransfers.findByIdAndUpdate(
            chequeTransferId,
            {
                transactionType: transactionType || existingChequeTransfer.transactionType,
                accountName: accountName || existingChequeTransfer.accountName,
                bank: bankDetails ? bankDetails?._id : existingChequeTransfer.bank,
                transferDate: transferDate || existingChequeTransfer.transferDate,
                description: description || existingChequeTransfer.description,
            },
            { new: true, runValidators: true }
        );


        return res.status(200).json({
            status: "Success",
            message: "Cheque transfer updated successfully.",
            data: updatedChequeTransfer,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "Failed",
            message: "An error occurred while updating the cheque transfer.",
            error: error.message,
        });
    }
};
