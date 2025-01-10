const formatDate = require("../../global/formatDate");
const CreditNotes = require("../../models/crnModel")
const SeriesNumber = require('../../models/seriesnumber');
const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Units = require("../../models/unitModel");
const Products = require("../../models/productModel");
const mongoose = require("mongoose");
const { deleteFile } = require('../../global/deleteFIle');
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require('../../utils/partyUtils');

exports.getAllCreditNotes = async (req, res) => {
    try {
        const { search, fromDate, toDate } = req.query;
        let searchConditions = { createdBy: req.user };

        // Date range filter
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setDate(endDate.getDate() + 1);

            searchConditions.date = { $gte: startDate, $lte: endDate };
        }

        // Search logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchNumeric = parseFloat(search);

            const searchFields = {
                $or: [
                    { returnNo: { $regex: searchRegex } },

                    { 'party.name': { $regex: searchRegex } },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                                regex: search
                            }
                        }
                    },
                    ...(isNaN(searchNumeric) ? [] : [
                        { totalAmount: searchNumeric },  // Exact match for totalAmount
                        { balanceAmount: searchNumeric }  // Exact match for balanceAmount
                    ])
                ]
            };

            // Combine date range and search conditions
            searchConditions = {
                $and: [searchConditions, searchFields]
            };
        }

        // Fetch the credit notes data with the constructed search conditions
        const creditNotes = await CreditNotes
            .find(searchConditions)
            .select('party totalAmount balanceAmount returnNo date')
            .populate('party', 'name')
            .sort({ createdAt: -1 });

        if (!creditNotes.length) {
            return res.status(200).json({ status: "Success", message: "No data found" });
        }

        const formattedCreditNotes = creditNotes.map(item => {
            const formattedDate = formatDate(item.date);  // Assuming you have a function to format dates
            return {
                ...item._doc,
                date: formattedDate
            };
        });

        res.status(200).json({ status: "Success", data: formattedCreditNotes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};

exports.getSaleReturnNumber = async (req, res) => {

    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("saleReturnNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};


exports.getCreditNoteById = async (req, res) => {
    try {
        const { creditNoteId } = req.params;

        if (!creditNoteId) {
            return res.status(400).json({ status: "Failed", message: "Credit Note ID is required" });
        }

        // Find the credit note by ID
        const creditNote = await CreditNotes.findOne({ _id: creditNoteId, createdBy: req.user })
            .populate('party', 'name phoneNo')
            .populate('items.itemId', 'itemName price')
            .populate('items.unit', 'name ')
            .populate('items.taxPercent')
            .populate('stateOfSupply')
            .populate('paymentMethod.bankName', '-_id bankName')
            .exec();

        if (!creditNote) {
            return res.status(404).json({ status: "Failed", message: "Credit Note not found" });
        }

        res.status(200).json({ status: "Success", data: creditNote });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


exports.saveCreditNote = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            partyId, partyName, phoneNo, returnNo,
            invoiceNo, invoiceDate, date, stateOfSupply,
            description, paymentMethod, roundOff, items, totalAmount,
            balanceAmount, paidAmount, source, invoiceId
        } = req.body;


        if (!source) {
            return res.status(400).json({ status: "Failed", message: `Source is Required.` })
        }

        items = items ? JSON.parse(items) : [];

        if (!['Invoice', 'Direct'].includes(source)) {
            return res.status(400).json({ status: "Failed", message: `Enter Valid Source` })
        }

        // Ensure sourceDetails exists and is an object
        // if (!invoiceDetails || typeof invoiceDetails !== 'string') {
        //     invoiceDetails = {};
        //     console.log('InvoiceDetails is not a valid JSON, using empty object.');
        // } else {
        //     sourceDetails = JSON.parse(invoiceDetails);
        // };

        let image = '', document = '';
        stateOfSupply = !stateOfSupply ? null : stateOfSupply;
        balanceAmount = balanceAmount || 0;

        if (req.files) {
            for (const file of req.files) {
                if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
                    image = file.filename;

                } else {
                    document = file.filename;
                }
            }
        }

        invoiceId = invoiceId ? invoiceId : null

        // Validate party details
        partyId = await findOrCreateParty(partyName, req.user, session);

        //verifying and Formatting Items(if item exist) 
        if (items.length > 0) {
            items = await processItems(items, req.user, session);
        };

        if (source === 'Direct') {
            sourceDetails = {}
        };

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        if (balanceAmount == 0) {
            // Processing each payment method to either create  cheques
            for (const payment of paymentMethod) {
                if (payment.method === "Cheque") {
                    const chequeData = {
                        partyName,
                        party: partyId,
                        transactionType: "debit",
                        date,
                        amount: payment.amount,
                        referenceNo: payment.referenceNo ? payment.referenceNo : '',
                        source: "CreditNotes",
                        reference: null,
                        status: "open",
                        createdBy: req.user
                    };

                    const savedCheque = await createCheque(chequeData, session);
                    payment.chequeId = savedCheque._id;
                }
            };
        };

        // Create the invoice
        const savedCreditNote = await CreditNotes.create([{
            returnNo,
            party: partyId,
            partyName,
            invoiceDetails: invoiceId,
            phoneNo,
            invoiceNo,
            invoiceDate,
            date: date ? date : Date.now(),
            stateOfSupply,
            paymentMethod,
            image,
            document,
            items,
            roundOff,
            totalAmount: +totalAmount,
            balanceAmount,
            source,
            paidAmount,
            createdBy: req.user
        }], { session });

        if (!savedCreditNote) {
            throw new Error("Failed to save Credit Note");
        }

        // Prepare transaction reference
        const transactionReference = {
            documentId: savedCreditNote[0]._id,
            documentNumber: returnNo,
            docName: "CreditNotes"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: "Credit Note",
            transactionDate:invoiceDate,
            totalAmount,
            party: partyId,
            debit_amount: paidAmount,
            balance: balanceAmount,
            description,
            reference: transactionReference,
            paymentMethod,

            createdBy: req.user
        }], { session });

        if (!savedTransaction) {
            throw new Error("Failed to save transaction");
        }

        // Update party received amount and receivable Balance
        const updateParty = await Parties.findOneAndUpdate(
            { _id: partyId, name: partyName, createdBy: req.user },
            { $inc: { paidAmount: +paidAmount, 'balanceDetails.payableBalance': +balanceAmount } },
            { new: true, session }
        );

        if (!updateParty) {

            throw new Error("Failed to update party paid amount");
        }

        // Update Invoice if source!= "Direct"
        // if (source === "Invoice") {
        //     let updatedSource;
        //     console.log(`Updating source for ${source}`);

        //     if (source === "Estimate") {
        //         const conversionDetails = {
        //             documentId: savedInvoice[0].id,
        //             documentType: "Invoices",
        //             documentNo: invoiceNo
        //         }

        //         updatedSource = await Quotations.findOneAndUpdate(
        //             { _id: sourceDetails.documentId, referenceNo: sourceDetails.documentNo, isConverted: false, createdBy: req.user },
        //             { isConverted: true, conversionDetails },
        //             { new: true, session }
        //         );

        //         //Deleting Transaction for estimate before creating new transaction for invoice
        //         const deleteTransactionForQuotation = await Transactions.findOneAndDelete({ transactionType: source, 'reference.documentId': sourceDetails.documentId, createdBy: req.user }, { session })
        //         if (!deleteTransactionForQuotation) {
        //             throw new Error(`Failed to Delete ${source} Transaction`);
        //         }
        //     };

        //     if (!updatedSource) {
        //         throw new Error(`Failed to update ${source}`);
        //     }

        // }

        //Updating Stock Quantity in items
        for (const item of items) {
            const { itemId, quantity } = item;

            // Using findOneAndUpdate directly
            const updatedProduct = await Products.findOneAndUpdate(
                { _id: itemId, createdBy: req.user },
                { $inc: { 'stock.totalQuantity': +quantity } },
                { new: true, session } // Return the updated document
            );

            if (!updatedProduct) {
                throw new Error(`Failed to update product with itemId ${itemId}. Product not found.`);
            } else {
                console.log(`Updated Product`);
            }
        };

        // After the CRN is saved, update the cheque's reference to point to the saved Crn
        await updateChequeReference(savedCreditNote[0].paymentMethod, savedCreditNote, session, 'Save');

        let getLatestReturnNo = await SeriesNumber.findOne({ createdBy: req.user }).select('saleReturnNo');

        if (+returnNo >= getLatestReturnNo.saleReturnNo) {

            // Update the Return number series
            const updateSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { saleReturnNo: +returnNo + 1 },
                { new: true, session }
            )

            if (!updateSeries) {
                throw new Error(`Failed to update SeriesNumber`);
            };
        }


        // Commit the transaction
        await session.commitTransaction();
        res.status(201).json({ status: "Success", message: "Credit Note Saved Successfully", data: savedCreditNote });

    } catch (error) {
        // Rollback the transaction on error
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error(error, 'Error');
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        // End the session
        session.endSession();
    }
}


exports.editCreditNote = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { creditNoteId } = req.params;
        let {
            partyId, partyName, phoneNo, returnNo, invoiceNo, invoiceDate, date,
            stateOfSupply, description, paymentMethod,
            roundOff, items, totalAmount, balanceAmount, paidAmount, source, invoiceId
        } = req.body;


        if (!creditNoteId) {
            return res.status(400).json({ status: "Failed", message: `Credit Note ID is required.` });
        }
        stateOfSupply = !stateOfSupply ? null : stateOfSupply;

        // Fetch the existing credit note
        const existingCreditNote = await CreditNotes.findOne({ _id: creditNoteId, createdBy: req.user });
        if (!existingCreditNote) {
            return res.status(404).json({ status: "Failed", message: "Credit Note not found" });
        };

        let canCreditNoteEdited = await checkDocumentCanDelete(creditNoteId, req.user);

        if (!canCreditNoteEdited) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };

        // Revert stock quantities and party balance from the existing credit note
        for (const item of existingCreditNote.items) {
            const existingProduct = await Products.findOne({ _id: item.itemId, createdBy: req.user });
            if (existingProduct) {
                // Revert the stock
                await Products.findOneAndUpdate(
                    { _id: item.itemId, createdBy: req.user },
                    { $inc: { 'stock.totalQuantity': -item.quantity } },
                    { session }
                );
            }
        };

        // Revert the party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: existingCreditNote.party, createdBy: req.user },
            { $inc: { paidAmount: -existingCreditNote.paidAmount, 'balanceDetails.payableBalance': -existingCreditNote.balanceAmount } },
            { session }
        );

        partyId = await findOrCreateParty(partyName, req.user, session);

        // Handle new items and update quantities
        let parsedItems = items ? JSON.parse(items) : [];

        if (parsedItems.length > 0) {
            parsedItems = await processItems(parsedItems, req.user, session);
        };

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Payment Method Validation
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Update the credit note
        const updatedCreditNote = await CreditNotes.findOneAndUpdate(
            { _id: creditNoteId, createdBy: req.user },
            {
                returnNo,
                party: partyId,
                partyName,
                phoneNo,
                invoiceNo,
                invoiceDate,
                date: date ? date : Date.now(),
                stateOfSupply,
                paymentMethod,
                items: parsedItems,
                roundOff,
                totalAmount: +totalAmount,
                balanceAmount,
                source,
                paidAmount,
                updatedAt: Date.now(),
            },
            { new: true, session }
        );

        if (!updatedCreditNote) {
            throw new Error("Failed to update Credit Note");
        }


        const existingPaymentMethods = existingCreditNote.paymentMethod;

        // Handle cheque updates (delete removed cheques)
        await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);


        // Processing each payment method to either create cheques or update
        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName,
                    party: partyId,
                    transactionType: "debit",
                    date: invoiceDate,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "CreditNotes",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };

                // If chequeId exists, update the cheque, otherwise create a new one
                if (payment?.chequeId) {
                    await updateCheque(payment?.chequeId, chequeData, session);
                } else {
                    if (balanceAmount == 0) {
                        const savedCheque = await createCheque(chequeData, session);
                        payment.chequeId = savedCheque._id;
                    }

                }
            }
        };

        // Update the corresponding transaction
        const updatedTransaction = await Transactions.findOneAndUpdate(
            { 'reference.documentId': creditNoteId, createdBy: req.user },
            {
                transactionType: "Credit Note",
                totalAmount,
                transactionDate:invoiceDate,

                party: partyId,
                debit_amount: paidAmount,
                balance: balanceAmount,
                description,
                reference: {
                    documentId: updatedCreditNote._id,
                    documentNumber: returnNo,
                    docName: "CreditNotes"
                },
                paymentMethod,
                updatedAt: Date.now(),
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update the transaction");
        }

        // Update party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: partyId, createdBy: req.user },
            { $inc: { paidAmount: +paidAmount, 'balanceDetails.payableBalance': +balanceAmount } },
            { new: true, session }
        );

        // Update stock quantities for items in the updated credit note
        for (const item of parsedItems) {
            const { itemId, quantity } = item;
            await Products.findOneAndUpdate(
                { _id: itemId, createdBy: req.user },
                { $inc: { 'stock.totalQuantity': +quantity } },
                { new: true, session }
            );
        }

        // Commit the transaction
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Credit Note and Transaction updated successfully", data: updatedCreditNote });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error(error, 'Error');
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        session.endSession();
    }
};


exports.deleteCreditNote = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { creditNoteId } = req.params;


        if (!creditNoteId) {
            return res.status(400).json({ status: "Failed", message: "Credit Note ID is required" });
        }

        // Find the credit note
        const creditNote = await CreditNotes.findOne({ _id: creditNoteId, createdBy: req.user });
        if (!creditNote) {
            return res.status(404).json({ status: "Failed", message: "Credit Note not found" });
        }

        let canInvoiceDelete = await checkDocumentCanDelete(creditNoteId, req.user);

        if (!canInvoiceDelete) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };


        if (creditNote.image) {
            await deleteFile(creditNote.image, 'images');
        };

        const { party, paidAmount, balanceAmount, items } = creditNote;

        // Update party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: party, createdBy: req.user },
            { $inc: { paidAmount: -paidAmount, 'balanceDetails.payableBalance': -balanceAmount } },
            { session }
        );

        // Update stock quantities for items in the deleted credit note
        // for (const item of items) {
        //     const { itemId, quantity } = item;
        //     await Products.findOneAndUpdate(
        //         { _id: itemId, createdBy: req.user },
        //         { $inc: { 'stock.totalQuantity': -quantity } },
        //         { new: true, session }
        //     );
        // }

        for (const item of items) {

            const { itemId, quantity } = item;

            const product = await Products.findOne({ _id: itemId, createdBy: req.user });

            if (!product) {
                throw new Error(`Product with itemId ${itemId} not found.`);
            }

            if (product.stock.totalQuantity <= 0 || product.stock.totalQuantity < quantity) {
                console.log(`Not enough stock for product with itemId ${itemId}.`);
            }

            // Perform the update only if the stock check passes
            const updatedProduct = await Products.findOneAndUpdate(
                { _id: itemId, createdBy: req.user },
                {
                    $inc: {
                        'stock.totalQuantity': -quantity
                    }
                },
                { new: true, session }
            );

            if (!updatedProduct) {
                throw new Error(`Failed to update product with itemId ${itemId}.`);
            } else {
                console.log(`Updated Product`);
            }
        }

        // Delete the credit note
        await CreditNotes.findOneAndDelete({ _id: creditNoteId, createdBy: req.user }, { session });

        // Delete the corresponding transaction
        await Transactions.findOneAndDelete(
            { 'reference.documentId': creditNoteId, createdBy: req.user },
            { session }
        );


        //Deleting All the cheques of  credit note
        await deleteChequesByReference(creditNoteId, session);

        // Commit the transaction
        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Credit Note and associated transaction deleted successfully" });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    } finally {
        session.endSession();
    }
};
