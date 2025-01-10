const SeriesNumber = require("../../models/seriesnumber");
const Transactions = require("../../models/transactionModel");
const PaymentIn = require("../../models/paymentInModel");
const Parties = require("../../models/partyModel");
const mongoose = require("mongoose");
const { deleteFile } = require('../../global/deleteFIle');
const formatDate = require("../../global/formatDate");
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { findOrCreateParty } = require('../../utils/partyUtils');

exports.getAllPayments = async (req, res) => {
    try {
        const { search, fromDate, toDate } = req.query;
        let searchConditions = { createdBy: req.user };

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setDate(endDate.getDate() + 1);

            searchConditions.date = { $gte: startDate, $lte: endDate };
        };

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchNumeric = parseFloat(search);

            const searchFields = {
                $or: [
                    { receiptNo: { $regex: searchRegex } },
                    { partyName: { $regex: searchRegex } },
                    { category: { $regex: searchRegex } },
                    // { receivedAmount: { $regex: searchRegex } },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                                regex: search
                            }
                        }
                    }
                ]
            };

            searchConditions = {
                $and: [searchConditions, searchFields]
            };
        }

        const paymentEntries = await PaymentIn
            .find(searchConditions)
            .select("date receiptNo partyName category receivedAmount")
            .sort({ date: -1 });

        if (!paymentEntries.length) {
            return res.status(200).json({ status: "Success", message: "No data found" });
        }

        const formattedEntries = paymentEntries.map(item => {
            const formattedDate = formatDate(item.date);
            return {
                ...item._doc,
                date: formattedDate
            };
        });

        res.status(200).json({ status: "Success", data: formattedEntries });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};


exports.getReceiptNo = async (req, res) => {
    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("paymentInReceiptNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};


exports.getPaymentById = async (req, res) => {

    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Payment Id is Required" })
        }

        const paymentData = await PaymentIn
            .findOne({ _id: id, createdBy: req.user })
            .select("-createdAt -updatedAt")
            .populate({ path: "party", select: " -_id name" })
            .populate({ path: "paymentMethod.bankName", select: "bankName" });


        if (!paymentData) {
            return res.status(404).json({ error: "Payment not Found!!!!" })
        }

        paymentData.date = formatDate(paymentData.date);
        res.status(200).json({ status: "Payment-In Data Fetched Successfully", data: paymentData })
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};

exports.savePaymentIn = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { receiptNo, date, party, description, paymentMethod, bankName, referenceNo, receivedAmount, category } = req.body;
        let partyId;
        let imagePath = "";

        if (req.files && req.files.length > 0) {
            imagePath = req.files[0].filename;
        }

        // const isReceiptExists = await PaymentIn.findOne({ receiptNo, createdBy: req.user });

        // if (isReceiptExists) {    
        //     return res.status(409).json({ status: "Failed", message: "Receipt No. already exists" });
        // }

        // Validate party details
        partyId = await findOrCreateParty(party, req.user, session);

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Processing each payment method to either create  cheques
        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName: party,
                    party: partyId,
                    transactionType: "credit",
                    date,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "PaymentIn",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };

                const savedCheque = await createCheque(chequeData, session);
                payment.chequeId = savedCheque._id;
            }
        };

        // Create the paymentIn document
        const savedPayment = await PaymentIn.create([{
            party: partyId,
            partyName: party,
            receiptNo,
            date,
            description,
            image: imagePath,
            paymentMethod,
            receivedAmount,
            category,
            createdBy: req.user
        }], { session });

        const transactionReference = {
            documentId: savedPayment[0]._id,
            documentNumber: receiptNo,
            docName: "PaymentIn"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: "Payment-In",
            party: partyId,
            totalAmount: receivedAmount,
            credit_amount: receivedAmount,
            balance: 0,
            description,
            reference: transactionReference,
            paymentMethod,
            // bankName,
            createdBy: req.user
        }], { session });

        if (!savedTransaction) {
            throw new Error("Failed to save transaction");
        }

        // Updating Party Received Amount
        const updateParty = await Parties.findOneAndUpdate(
            { _id: partyId, name: party, createdBy: req.user },
            { $inc: { receivedAmount, "balanceDetails.receivableBalance": -receivedAmount } },
            { new: true, session }
        );

        if (!updateParty) {
            throw new Error("Failed to update party received amount");
        };

        // After the Payment-In is saved, update the cheque's reference to point to the saved Payment-In
        await updateChequeReference(savedPayment[0].paymentMethod, savedPayment, session, 'Save');

        //Updating Receipt No.

        let getLatestReceiptNo = await SeriesNumber.findOne({ createdBy: req.user }).select('paymentInReceiptNo');

        if (+receiptNo >= getLatestReceiptNo.paymentInReceiptNo) {

            const updatedSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { $set: { paymentInReceiptNo: +receiptNo + 1 } }, // Increment current Receipt No.
                { new: true, session }
            );

            if (!updatedSeries) {
                throw new Error("Failed to update series value");
            }

        }

        // Commit the transaction if everything is successful
        await session.commitTransaction();

        res.status(201).json({ status: "Success", message: "Payment-In saved successfully", data: savedPayment });

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
};


exports.updatePaymentIn = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        let { receiptNo, date, partyId, party, description, paymentMethod, bankName, referenceNo, receivedAmount, category } = req.body;

        let imagePath = "";

        receivedAmount = +receivedAmount || 0

        // Verify if the payment entry exists
        const paymentEntry = await PaymentIn.findOne({ _id: id, createdBy: req.user });

        if (!paymentEntry) {
            return res.status(404).json({ status: "Failed", message: "Payment Entry not found" });
        }

        if (req.files && req.files.length > 0) {
            if (paymentEntry.image) {
                await deleteFile(paymentEntry.image, 'images');
            };
            imagePath = req.files[0].filename;
        };

        // Verify if the party exists
        // const partyExists = await Parties.findOne({ _id: partyId, createdBy: req.user }, null, { session });
        // if (!partyExists) {
        //     return res.status(404).json({ status: "Failed", message: "Party not found" });
        // }

        // Validate party details
        partyId = await findOrCreateParty(party, req.user, session);

        //Validate payment Method:
        paymentMethod = JSON.parse(paymentMethod);

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        const existingPaymentMethods = paymentEntry.paymentMethod;

        // Handle cheque updates (delete removed cheques)
        await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

        // Processing each payment method to either create or update cheques
        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName: party,
                    party: partyId,
                    transactionType: "credit",
                    date,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "PaymentIn",
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
                }
            }
        };

        // Update paymentIn document
        const updatedPayment = await PaymentIn.findByIdAndUpdate(id, {
            party: partyId,
            partyName: party,
            receiptNo,
            date,
            description,
            image: imagePath || paymentEntry.image,
            paymentMethod,
            receivedAmount,
            category,
            updatedAt: Date.now()
        }, { new: true, session });

        if (!updatedPayment) {
            throw new Error("Failed to update payment entry");
        }

        const transactionReference = {
            documentId: id,
            documentNumber: receiptNo,
            docName: "PaymentIn"
        };

        const updatedTransaction = await Transactions.findOneAndUpdate(
            {
                'reference.documentId': transactionReference.documentId,
                createdBy: req.user
            },
            {
                party: partyId,
                totalAmount: receivedAmount,
                credit_amount: receivedAmount,
                description,
                paymentMethod,
                reference: transactionReference
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update associated transaction");
        };

        await updateChequeReference(updatedPayment.paymentMethod, updatedPayment, session, 'Update');

        const amountDifference = receivedAmount - paymentEntry.receivedAmount; // Calculate the difference

        if (amountDifference !== 0) {
            const updateParty = await Parties.findOneAndUpdate(
                { _id: partyId, name: party, createdBy: req.user },
                { $inc: { receivedAmount: amountDifference } },
                { new: true, session }
            );

            if (!updateParty) {
                throw new Error("Failed to update party received amount");
            }
        }

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Payment-In updated successfully", data: updatedPayment });

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


exports.deletePaymentIn = async (req, res) => {
    const session = await mongoose.startSession();
 
    try {
        const { id } = req.params;

        const paymentEntry = await PaymentIn.findOne({ _id: id, createdBy: req.user }, null, { session });
        if (!paymentEntry) {
            return res.status(404).json({ status: "Failed", message: "Payment entry not found" });
        } 

        if (paymentEntry.image) {
            await deleteFile(paymentEntry.image, 'images');
        };

        let canPaymentEntryDelete = await checkDocumentCanDelete(id, req.user);

        if (!canPaymentEntryDelete) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed.` })
        };

        const { party, receivedAmount } = paymentEntry;

        const transactionReference = {
            documentId: paymentEntry._id,
            documentNumber: paymentEntry.receiptNo,
            docName: "PaymentIn"
        };

        const deletedTransaction = await Transactions.findOneAndDelete({
            'reference.documentId': transactionReference.documentId,
            createdBy: req.user
        }, { session });

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated transaction");
        }

        const deletedPayment = await PaymentIn.findByIdAndDelete(id, { session });

        if (!deletedPayment) {
            throw new Error("Failed to delete payment entry");
        }


        // Update the party's received amount
        const updateParty = await Parties.findOneAndUpdate(
            { _id: party, createdBy: req.user },
            { $inc: { receivedAmount: -receivedAmount } }, // Decrease the received amount
            { new: true, session }
        );

        if (!updateParty) {
            throw new Error("Failed to update party received amount");
        }

        await deleteChequesByReference(id, session);

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Payment-In deleted successfully" });

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
