const SeriesNumber = require("../../models/seriesnumber");
const Transactions = require("../../models/transactionModel");
const PaymentOut = require("../../models/purchase/paymentOutModel");
const Parties = require("../../models/partyModel");
const mongoose = require("mongoose");
const formatDate = require("../../global/formatDate")
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require("../../utils/partyUtils");



exports.getReceiptNo = async (req, res) => {
    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("paymentOutReceiptNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};


exports.getAllPayments = async (req, res) => {
    try {

        const { fromDate, toDate, search } = req.query;

        let searchConditions = { createdBy: req.user };

        // Date range filter
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setDate(endDate.getDate() + 1);

            searchConditions.createdAt = { $gte: startDate, $lte: endDate };
        };


        if (search) {
            const regex = new RegExp(search, 'i');
            searchConditions.$or = [
                { receiptNo: { $regex: regex } },
                { partyName: { $regex: regex } }
            ]


            const searchNumber = parseFloat(search);
            if (!isNaN(searchNumber)) {
                searchConditions.$or.push(
                    { paidAmount: { $eq: searchNumber } }
                );
            }
        }

        let paymentEntries = await PaymentOut.find(searchConditions).select("date receiptNo partyName paidAmount").sort({ createdAt: -1 });

        const formattedEntries = paymentEntries.map(item => {
            const formattedDate = formatDate(item.date)
            return {
                ...item._doc,
                date: formattedDate
            };
        });


        res.status(200).json({ status: "Success", data: formattedEntries })

    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
}

exports.getPaymentById = async (req, res) => {

    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Payment Id is Required" })
        }

        const paymentData = await PaymentOut
            .findOne({ _id: id, createdBy: req.user })
            .select("-createdAt -updatedAt")
            .populate({ path: "party", select: " -_id name" })
            .populate({ path: "paymentMethod.bankName", select: "-_id bankName" })


        if (!paymentData) {
            return res.status(404).json({ error: "Payment not Found!!!!" })
        }

        // paymentData.date = formatDate(paymentData.date);
        res.status(200).json({ message: "Payment-Out Data Fetched Successfully", data: paymentData })
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};

exports.savePaymentOut = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { receiptNo, date, partyId, party, description, paymentMethod, paidAmount, category } = req.body;

        let imagePath = "";


        if (req.files && req.files.length > 0) {
            imagePath = req.files[0].filename;
        }

        const isReceiptExists = await PaymentOut.findOne({ receiptNo, createdBy: req.user });

        if (isReceiptExists) {
            return res.status(409).json({ status: "Failed", message: "Receipt No. already exists" });
        }

        partyId = await findOrCreateParty(party, req.user, session)


        // verifying and formatting payment Type
        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Processing each payment method to  create  cheques
        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName: party,
                    party: partyId,
                    transactionType: "debit",
                    date,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "PaymentOut",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };

                const savedCheque = await createCheque(chequeData, session);
                payment.chequeId = savedCheque._id;
            };
        };

        // Create the PaymentOut document
        const savedPayment = await PaymentOut.create([{
            party: partyId,
            partyName: party,
            receiptNo,
            date,
            description,
            image: imagePath,
            paymentMethod,
            paidAmount,
            category,
            createdBy: req.user
        }], { session });



        const transactionReference = {
            documentId: savedPayment[0]._id,
            documentNumber: receiptNo,
            docName: "PaymentOut"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: "Payment-Out",
            transactionDate: date,
            party: partyId,
            totalAmount: paidAmount,
            debit_amount: paidAmount,
            balance: 0,
            description,
            reference: transactionReference,
            paymentMethod,
            createdBy: req.user
        }], { session });

        if (!savedTransaction) {
            throw new Error("Failed to save transaction");
        }


        // After the Payment-Out is saved, update the cheque's reference to point to the saved Payment-Out
        await updateChequeReference(savedPayment[0].paymentMethod, savedPayment, session, 'Save');

        // Updating Party Paid Amount

        const updateParty = await Parties.findOneAndUpdate(
            { _id: partyId, name: party, createdBy: req.user },
            { $inc: { paidAmount, "balanceDetails.payableBalance": -paidAmount } },
            { new: true, session }
        );

        if (!updateParty) {
            throw new Error("Failed to update party paidAmount amount");
        }

        //Updating Receipt No.
        const updatedSeries = await SeriesNumber.findOneAndUpdate(
            { createdBy: req.user },
            { $set: { paymentOutReceiptNo: +receiptNo + 1 } }, // Increment current Receipt No.
            { new: true, session }
        );

        if (!updatedSeries) {
            throw new Error("Failed to update series value");
        }

        // Commit the transaction if everything is successful
        await session.commitTransaction();

        res.status(201).json({ status: "Success", message: "Payment-Out Saved Successfully", data: savedPayment });
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


exports.updatePaymentOut = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        let { receiptNo, date, partyId, party, description, paymentMethod, paidAmount } = req.body;

        let imagePath = "";

        if (!paidAmount || paidAmount < 0) {
            return res.status(400).json({ status: "Failed", message: "Valid Paid Amount Required" })

        }

        paidAmount = +paidAmount || 0

        if (req.files && req.files.length > 0) {
            imagePath = req.files[0].filename;
        }

        // Verify if the payment entry exists

        const paymentEntry = await PaymentOut.findOne({ _id: id, createdBy: req.user });

        if (!paymentEntry) {
            return res.status(404).json({ status: "Failed", message: "Payment Entry not found" });
        };

        partyId = await findOrCreateParty(party, req.user, session);

        // verifying and formatting payment Type
        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        const existingPaymentMethods = paymentEntry.paymentMethod;

        // Handle cheque updates (delete removed cheques)
        await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName: party,
                    party: partyId,
                    transactionType: "debit",
                    date: date,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "PaymentOut",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };

                // If chequeId exists, update the cheque, otherwise create a new one
                if (payment.chequeId) {
                    await updateCheque(payment.chequeId, chequeData, session);
                } else {
                    const savedCheque = await createCheque(chequeData, session);
                    payment.chequeId = savedCheque._id;
                };
            }
        };


        // Update paymentIn document
        const updatedPayment = await PaymentOut.findOneAndUpdate({ _id: id, createdBy: req.user }, {
            party: partyId,
            partyName: party,
            receiptNo,
            date,
            description,
            image: imagePath || paymentEntry.image,
            paymentMethod,
            paidAmount,
        }, { new: true, session });

        if (!updatedPayment) {
            throw new Error("Failed to update payment entry");
        };

        const transactionReference = {
            documentId: id,
            documentNumber: receiptNo,
            docName: "PaymentOut"
        };

        const updatedTransaction = await Transactions.findOneAndUpdate(
            {
                'reference.documentId': transactionReference.documentId,
                createdBy: req.user
            },
            {
                party: partyId,
                transactionDate: date,
                totalAmount: paidAmount,
                debit_amount: paidAmount,
                description,
                paymentMethod,
                reference: transactionReference
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update associated transaction");
        }

        const amountDifference = paidAmount - paymentEntry.paidAmount; // Calculate the difference

        if (amountDifference !== 0) {
            const updateParty = await Parties.findOneAndUpdate(
                { _id: partyId, name: party, createdBy: req.user },
                { $inc: { paidAmount: amountDifference } },
                { new: true, session }
            );

            if (!updateParty) {
                throw new Error("Failed to update party paid amount");
            }
        }

        // After the invoice is saved, update the cheque's reference to point to the saved invoice
        await updateChequeReference(updatedPayment.paymentMethod, updatedPayment, session, 'Update');

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Payment-Out updated successfully", data: updatedPayment });

    } catch (error) {
        await session.abortTransaction();

        console.log(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    } finally {
        session.endSession();
    }
};

exports.deletePaymentOut = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const paymentEntry = await PaymentOut.findById(id, null, { session });
        if (!paymentEntry) {
            return res.status(404).json({ status: "Failed", message: "Payment entry not found" });
        };

        //Checking whether purchase bill can delete or not 
        let canPaymentEntryDelete = await checkDocumentCanDelete(billId, req.user);

        if (!canPaymentEntryDelete) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };

        const { party, paidAmount } = paymentEntry;

        const transactionReference = {
            documentId: paymentEntry._id,
            documentNumber: paymentEntry.receiptNo,
            docName: "PaymentOut"
        };

        const deletedTransaction = await Transactions.findOneAndDelete({
            'reference.documentId': transactionReference.documentId,
            createdBy: req.user
        }, { session });

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated transaction");
        }

        const deletedPayment = await PaymentOut.findOneAndDelete({ _id: id, createdBy: req.user }, { session });

        if (!deletedPayment) {
            throw new Error("Failed to delete payment entry");
        }

        // Update the party's received amount
        const updateParty = await Parties.findOneAndUpdate(
            { _id: party, createdBy: req.user },
            { $inc: { paidAmount: -paidAmount, 'balanceDetails.payableBalance': -paidAmount } }, // Decrease the paid amount
            { new: true, session }
        );

        if (!updateParty) {
            throw new Error("Failed to update party Paid amount");
        }

        //Deleting all the cheques of this bill
        await deleteChequesByReference(id, session);

        // Commit the transaction if everything is successful
        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Payment-Out Deleted Successfully" });

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
