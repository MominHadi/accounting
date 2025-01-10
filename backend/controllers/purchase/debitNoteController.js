const formatDate = require("../../global/formatDate");
const DebitNotes = require("../../models/purchase/debitNoteModel");
const SeriesNumber = require('../../models/seriesnumber');
const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Units = require("../../models/unitModel");
const Products = require("../../models/productModel");
const mongoose = require("mongoose");
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require("../../utils/partyUtils");

exports.getAllDebitNotes = async (req, res) => {
    try {
        const { fromDate, toDate, search } = req.query;
        let searchConditions = { createdBy: req.user };

        // Add date range filter if fromDate and toDate are provided
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            searchConditions.date = { $gte: startDate, $lte: endDate };
        };

        // Fetch all debit notes based on search conditions (excluding search)
        let debitNoteData = await DebitNotes.find(searchConditions)
            .select('party totalAmount balanceAmount returnNo date')
            .populate('party', 'name')
            .sort({ createdAt: -1 });

        debitNoteData = debitNoteData.map((dbn) => ({
            ...dbn._doc,
            date: formatDate(dbn.date)
        }));


        // If a search term is provided, manually filter the results
        if (search) {
            const regex = new RegExp(search, 'i'); // Create a case-insensitive regex

            // Filter manually
            const filteredDebitNotes = debitNoteData.filter(debitNote => {
                // Apply regex to string fields (party.name, returnNo)
                const matchesName = regex.test(debitNote.party.name);
                const matchesReturnNo = regex.test(debitNote.returnNo);

                const matchesTotalAmount = regex.test(debitNote.totalAmount.toString());
                const matchesBalanceAmount = regex.test(debitNote.balanceAmount.toString());

                // Return true if any field matches the search term
                return matchesName || matchesReturnNo || matchesTotalAmount || matchesBalanceAmount;
            }); b                       


            let totalReturnAmount = filteredDebitNotes.reduce((prev, next) => { return prev + next.totalAmount }, 0);
            let totalBalanceAmount = filteredDebitNotes.reduce((prev, next) => { return prev + next.balanceAmount }, 0);
            // Update the data with filtered results
            return res.status(200).json({ status: "Success", data: filteredDebitNotes, totalAmount: totalReturnAmount, totalBalanceAmount });
        };


        let totalReturnAmount = debitNoteData.reduce((prev, next) => { return prev + next.totalAmount }, 0);
        let totalBalanceAmount = debitNoteData.reduce((prev, next) => { return prev + next.balanceAmount }, 0);

        // If no search term is provided, return all fetched data
        res.status(200).json({ status: "Success", data: debitNoteData, totalAmount: totalReturnAmount, totalBalanceAmount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};

exports.getPurchaseReturnNumber = async (req, res) => {

    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("purchaseReturnNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })
    }
};


exports.getDebitNoteById = async (req, res) => {
    try {
        const { debitNoteId } = req.params;

        if (!debitNoteId) {
            return res.status(400).json({ status: "Failed", message: "Debit Note ID is required" });
        }

        // Find the Debit note by ID
        const DebitNote = await DebitNotes.findOne({ _id: debitNoteId, createdBy: req.user })
            .populate('party', 'name phoneNo')
            .populate('stateOfSupply')
            .populate('items.itemId', 'itemName price')
            .populate('items.unit', '-__v -createdAt -updatedAt')
            .populate('items.taxPercent')
            .exec();

        if (!DebitNote) {
            return res.status(404).json({ status: "Failed", message: "Debit Note not found" });
        }

        res.status(200).json({ status: "Success", data: DebitNote });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};


exports.saveDebitNote = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            partyId, partyName, phoneNo, returnNo,
            billNo, billDate, date, stateOfSupply,
            description, paymentMethod, roundOff, items, totalAmount,
            balanceAmount, receivedAmount, source, billId
        } = req.body;


        if (!source) {
            return res.status(400).json({ status: "Failed", message: `Source is Required.` })
        }

        items = items ? JSON.parse(items) : [];

        if (!['Invoice', 'Direct'].includes(source)) {
            return res.status(400).json({ status: "Failed", message: `Enter Valid Source` });
        };

        stateOfSupply = !stateOfSupply ? null : stateOfSupply;


        // Ensure sourceDetails exists and is an object
        // if (!invoiceDetails || typeof invoiceDetails !== 'string') {
        //     invoiceDetails = {};
        //     console.log('InvoiceDetails is not a valid JSON, using empty object.');
        // } else {
        //     sourceDetails   = JSON.parse(invoiceDetails);
        // }

        let image = '', document = '';
        balanceAmount = balanceAmount || 0;

        if (req.files) {
            for (const file of req.files) {
                if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
                    image = file.filename;
                } else {
                    document = file.filename;
                }
            }
        };

        // Check for existing invoice number
        const isDbnNoExist = await DebitNotes.findOne({ returnNo, createdBy: req.user });

        if (isDbnNoExist) {
            return res.status(409).json({ status: "Failed", message: "Purchase Return No. already exists" });
        };

        billId = billId ? billId : null;

        // Validate party details
        partyId = await findOrCreateParty(partyName, req.user, session)


        //verifying and Formatting Items(if item exist)
        if (items.length > 0) items = await processItems(items, req.user, session);

        if (source === 'Direct') {
            sourceDetails = {}
        };

        // verifying and formatting payment Type
        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };


        // Processing each payment method to  create cheques
        if (parseFloat(balanceAmount) == 0) {
            for (const payment of paymentMethod) {
                if (payment.method === "Cheque") {
                    const chequeData = {
                        partyName,
                        party: partyId,
                        transactionType: "credit",
                        date: date ? date : Date.now(),
                        amount: payment.amount,
                        referenceNo: payment.referenceNo ? payment.referenceNo : '',
                        source: "DebitNotes",
                        reference: null,
                        status: "open",
                        createdBy: req.user
                    };

                    const savedCheque = await createCheque(chequeData, session);
                    payment.chequeId = savedCheque._id;
                };
            };
        };

        // Create the debit note
        const savedDebitNote = await DebitNotes.create([{
            returnNo,
            party: partyId,
            partyName,
            billDetails: billId,
            phoneNo,
            billNo,
            billDate,
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
            receivedAmount,
            createdBy: req.user
        }], { session });

        if (!savedDebitNote) {
            throw new Error("Failed to save Debit Note");
        };

        // Prepare transaction reference
        const transactionReference = {
            documentId: savedDebitNote[0]._id,
            documentNumber: returnNo,
            docName: "DebitNotes"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: "Debit Note",
            totalAmount,
            party: partyId,
            credit_amount: receivedAmount,
            balance: balanceAmount,
            description,
            reference: transactionReference,
            paymentMethod,
            createdBy: req.user
        }], { session });

        if (!savedTransaction) {
            throw new Error("Failed to save transaction");
        };

        // After the Debit note is saved, update the cheque's reference to point to the saved Debit note
        await updateChequeReference(savedDebitNote[0].paymentMethod, savedDebitNote, session, 'Save');

        // Update party received amount and receivable Balance
        const updateParty = await Parties.findOneAndUpdate(
            { _id: partyId, name: partyName, createdBy: req.user },
            { $inc: { receivedAmount: +receivedAmount, 'balanceDetails.receivableBalance': +balanceAmount } },
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
        //             documentNo: billNo
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
                { _id: itemId, type: 'Product', createdBy: req.user },
                { $inc: { 'stock.totalQuantity': -quantity } },
                { new: true, session } // Return the updated document
            );

            if (!updatedProduct) {
                throw new Error(`Failed to update product with itemId ${itemId}. Product not found.`);
            } else {
                console.log(`Updated Product`);
            }
        }

        // for (const item of items) {
        //     const { itemId, quantity } = item;

        //     // Find the product first to check the stock
        //     const product = await Products.findOne({ _id: itemId, createdBy: req.user });

        //     if (!product) {
        //         throw new Error(`Product with itemId ${itemId} not found.`);
        //     };

        //     // Check if the totalQuantity is greater than or equal to the quantity
        //     if (product.stock.totalQuantity <= 0 || product.stock.totalQuantity < quantity) {
        //         console.log(`Not enough stock for product with itemId ${itemId}.`);
        //         // throw new Error(`Not enough stock for product with itemId ${itemId}.`);
        //     };

        //     // Perform the update only if the stock check passes
        //     const updatedProduct = await Products.findOneAndUpdate(
        //         { _id: itemId, createdBy: req.user },
        //         {
        //             $inc: {
        //                 // 'stock.saleQuantity': quantity,
        //                 'stock.totalQuantity': -quantity
        //             }
        //         },
        //         { new: true, session }  // Return the updated document
        //     );

        //     if (!updatedProduct) {
        //         throw new Error(`Failed to update product with itemId ${itemId}.`);
        //     } else {
        //         console.log(`Updated Product`);
        //     }
        // }

        let getLatestPurechaseReturnNo = await SeriesNumber
            .findOne({ createdBy: req.user })
            .select('purchaseReturnNo');

        if (+returnNo >= getLatestPurechaseReturnNo.purchaseReturnNo) {

            // Update the purchase Return number series
            const updateSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { purchaseReturnNo: +returnNo + 1 },
                { new: true, session }
            )

            if (!updateSeries) {
                throw new Error(`Failed to update SeriesNumber`);
            };

        }
        // Commit the transaction
        await session.commitTransaction();

        res.status(201).json({ status: "Success", message: "Debit Note Saved Successfully", data: savedDebitNote });

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
};

exports.editDebitNote = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { debitNoteId } = req.params;
        let {
            partyId, partyName, phoneNo, returnNo, billNo, billDate, date,
            stateOfSupply, description, paymentMethod, referenceNo, bankName,
            roundOff, items, totalAmount, balanceAmount, receivedAmount, source, billId
        } = req.body;

        console.log(req.body, 'Request Body');


        if (!debitNoteId) {
            return res.status(400).json({ status: "Failed", message: `Debit Note ID is required.` });
        }
        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        // Fetch the existing Debit note
        const existingDebitNote = await DebitNotes.findOne({ _id: debitNoteId, createdBy: req.user });
        if (!existingDebitNote) {
            return res.status(404).json({ status: "Failed", message: "Debit Note not found" });
        };

        // Revert stock quantities and party balance from the existing Debit note
        for (const item of existingDebitNote.items) {
            const existingProduct = await Products.findOne({ _id: item.itemId, createdBy: req.user });
            if (existingProduct) {
                // Revert the stock
                await Products.findOneAndUpdate(
                    { _id: item.itemId, createdBy: req.user },
                    { $inc: { 'stock.totalQuantity': +item.quantity } },
                    { session }
                );
            }
        };

        // Revert the party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: existingDebitNote.party, createdBy: req.user },
            {
                $inc: {
                    receivedAmount: -existingDebitNote.receivedAmount,
                    'balanceDetails.receivableBalance': -existingDebitNote.balanceAmount
                }
            },
            { session }
        );

        partyId = await findOrCreateParty(partyName, req.user, session);

        // Handle new items and update quantities
        let parsedItems = items ? JSON.parse(items) : [];

        if (parsedItems.length > 0) {
            parsedItems = await processItems(parsedItems, req.user, session);
        };

        // verifying and formatting payment Type
        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Processing each payment method to either create cheques or update
        const existingPaymentMethods = existingDebitNote.paymentMethod;

        // Handle cheque updates (delete removed cheques)
        await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

        for (const payment of paymentMethod) {

            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName,
                    party: partyId,
                    transactionType: "credit",
                    date: billDate,
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "DebitNotes",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };

                // If chequeId exists, update the cheque, otherwise create a new one
                if (payment.chequeId) {
                    await updateCheque(payment.chequeId, chequeData, session);
                } else {
                    if (parseFloat(balanceAmount) == 0) {
                        const savedCheque = await createCheque(chequeData, session);
                        payment.chequeId = savedCheque._id;
                    }

                }
            }
        };

        // Update the Debit note
        const updatedDebitNote = await DebitNotes.findOneAndUpdate(
            { _id: debitNoteId, createdBy: req.user },
            {
                returnNo,
                party: partyId,
                partyName,
                phoneNo,
                billNo,
                billDate,
                date: date ? date : Date.now(),
                stateOfSupply,
                paymentMethod,
                items: parsedItems,
                roundOff,
                totalAmount: +totalAmount,
                balanceAmount,
                source,
                receivedAmount,
                updatedAt: Date.now(),
            },
            { new: true, session }
        );

        if (!updatedDebitNote) {
            throw new Error("Failed to update Debit Note");
        };

        // Update the corresponding transaction
        const updatedTransaction = await Transactions.findOneAndUpdate(
            { 'reference.documentId': debitNoteId, createdBy: req.user },
            {
                transactionType: "Debit Note",
                totalAmount,
                party: partyId,
                credit_amount: receivedAmount,
                balance: balanceAmount,
                description,
                reference: {
                    documentId: updatedDebitNote._id,
                    documentNumber: returnNo,
                    docName: "DebitNotes"
                },
                paymentMethod,
                updatedAt: Date.now(),
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update the transaction");
        };

        // After the debit note is updated, update the cheque's reference to point to the updated debit note
        await updateChequeReference(updatedDebitNote.paymentMethod, updatedDebitNote, session, 'Update');

        // Update party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: partyId, createdBy: req.user },
            { $inc: { receivedAmount: +receivedAmount, 'balanceDetails.receivableBalance': +balanceAmount } },
            { new: true, session }
        );

        // Update stock quantities for items in the updated Debit note
        for (const item of parsedItems) {
            const { itemId, quantity } = item;
            await Products.findOneAndUpdate(
                { _id: itemId, type: 'Product', createdBy: req.user },
                { $inc: { 'stock.totalQuantity': -quantity } },
                { new: true, session }
            );
        }

        // Commit the transaction
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Debit Note and Transaction updated successfully", data: updatedDebitNote });

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

exports.deleteDebitNote = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { debitNoteId } = req.params;

        if (!debitNoteId) {
            return res.status(400).json({ status: "Failed", message: "Debit Note ID is required" });
        }

        // Find the Debit note
        const DebitNote = await DebitNotes.findOne({ _id: debitNoteId, createdBy: req.user });

        if (!DebitNote) {
            return res.status(404).json({ status: "Failed", message: "Debit Note not found" });
        };

        //Checking whether Debit Note can delete or not 
        let canDebitNoteDeleted = await checkDocumentCanDelete(debitNoteId, req.user);

        if (!canDebitNoteDeleted) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };

        const { party, receivedAmount, balanceAmount, items } = DebitNote;

        // Update party's paid amount and payable balance
        await Parties.findOneAndUpdate(
            { _id: party, createdBy: req.user },
            { $inc: { receivedAmount: -receivedAmount, 'balanceDetails.receivableBalance': -balanceAmount } },
            { session }
        );

        // Update stock quantities for items in the deleted Debit note
        for (const item of items) {
            const { itemId, quantity } = item;
            await Products.findOneAndUpdate(
                { _id: itemId, createdBy: req.user },
                { $inc: { 'stock.totalQuantity': +quantity } },
                { new: true, session }
            );
        };

        // Delete the Debit note
        await DebitNotes.findOneAndDelete({ _id: debitNoteId, createdBy: req.user }, { session });

        // Delete the corresponding transaction
        await Transactions.findOneAndDelete(
            { 'reference.documentId': debitNoteId, createdBy: req.user },
            { session }
        );

        //Deleting all the cheques of this order
        await deleteChequesByReference(debitNoteId, session);

        // Commit the transaction
        await session.commitTransaction();

        return res.status(200).json({ status: "Success", message: "Debit Note and associated transaction deleted successfully" });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        session.endSession();
    }
};
