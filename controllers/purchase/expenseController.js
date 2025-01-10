const Expenses = require("../../models/purchase/expenseModel");
const SeriesNumber = require("../../models/seriesnumber");
const ExpenseCategory = require("../../models/purchase/expenseCategoryModel");
const ExpenseItems = require("../../models/purchase/expenseItemsModel");
const mongoose = require("mongoose");
const Parties = require("../../models/partyModel");
const Transactions = require("../../models/transactionModel");
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { findOrCreateParty } = require("../../utils/partyUtils");

exports.getExpenseNumber = async (req, res) => {
    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("expenseNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        };

        res.status(200).json({ status: "Success", data: data });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })

    }
};



exports.getExpenseByCategory = async (req, res) => {

    try {
        const { category } = req.params;

        const ExpenseList = await Expenses.find({ createdBy: req.user, expenseCategory: category })
            .select("expenseNo date party totalAmount balanceAmount")
            .sort({ date: -1 });


        let totalExpenseAmount = ExpenseList.reduce((prev, next) => { return prev + next.totalAmount }, 0);

        if (!ExpenseList) {
            return res.status(200).json({ error: "Expense  not Found!!!!" })
        };

        res.status(200).json({ status: "Success", data: ExpenseList, totalExpenseAmount });

    } catch (error) {
        // console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error })

    }
};

exports.getAllExpenses = async (req, res) => {
    try {
        // Fetch all expenses created by the user
        const expenses = await Expenses.find({ createdBy: req.user }).populate({ path: 'items.itemId', select: "name" })
            .populate({ path: 'items.taxPercent', select: "name" }).select("-createdAt -updatedAt")
            .sort({ date: -1 });

        res.status(200).json({ status: "Success", data: expenses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};


exports.getExpenseById = async (req, res) => {
    try {
        const expenseId = req.params.id;

        // Fetch the expense by ID and check if the user created it
        const expense = await Expenses.findOne({ _id: expenseId, createdBy: req.user }).populate({ path: 'items.itemId', select: "name" }).populate('stateOfSupply');

        console.log({ _id: expenseId, createdBy: req.user }, '{ _id: expenseId, createdBy: req.user }')
        if (!expense) {
            return res.status(404).json({ status: "Failed", message: "Expense not found" });
        }

        res.status(200).json({ status: "Success", data: expense });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};

exports.saveNewExpense = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            expenseType, partyId, partyName, expenseCategory,
            expenseNo, date, stateOfSupply,
            description, paymentMethod, roundOff, items, grandTotal,
            totalAmount, paidAmount, balanceAmount,
        } = req.body;

        if (!expenseType) {
            return res.status(400).json({ status: "Failed", message: `Expense Type is Required` });
        }

        if (expenseType === "GST" && !partyName) {
            return res.status(400).json({ status: "Failed", message: `Party Name is required when expenseType is GST` });
        };

        if (expenseType !== "GST") {
            balanceAmount = 0
            paidAmount = totalAmount;
            stateOfSupply = "";
            partyId = null;
            partyName = ''
        };

        // Parse items and handle image/document uploads
        items = items ? JSON.parse(items) : [];
        stateOfSupply = !stateOfSupply ? null : stateOfSupply;

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
        }


        if (expenseCategory) {
            let existingCategory = await ExpenseCategory.findOne({ name: expenseCategory, createdBy: req.user });

            if (!existingCategory) {
                const newCategory = await ExpenseCategory.create({ name: expenseCategory, type: 'Direct Expense', createdBy: req.user }, { session });

                if (!newCategory) {
                    throw new Error('Error Saving New Expense Category');
                }
            }
        };

        // verifying and formatting payment Type
        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        // partyId = null;

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Processing each payment method to create cheques
        for (const payment of paymentMethod) {
            if (payment.method === "Cheque") {
                const chequeData = {
                    partyName: expenseType.toUpperCase() == "GST" ? partyName : expenseCategory,
                    party: partyId,
                    transactionType: "debit",
                    date: date ? date : Date.now(),
                    amount: payment.amount,
                    referenceNo: payment.referenceNo ? payment.referenceNo : '',
                    source: "Expense",
                    reference: null,
                    status: "open",
                    createdBy: req.user
                };
                const savedCheque = await createCheque(chequeData, session);
                payment.chequeId = savedCheque._id;
            };
        };

        // // Check for existing invoice number
        // const isExpenseExist = await Expenses.findOne({ expenseNo, createdBy: req.user });
        // if (isExpenseExist) {
        //     return res.status(409).json({ status: "Failed", message: "Expense No. already exists" });
        // }

        // Validate party details
        if (partyName && expenseType == "GST") {

            // const PartyDetails = await Parties.findOne({ name: partyName, createdBy: req.user });
            // if (!PartyDetails) {

            //     console.log('Party Not found. Creating One...')

            //     const saveNewParty = await Parties.create([{ name: partyName, gstType: 'Unregistered/Consumer', createdBy: req.user }], { session });

            //     if (!saveNewParty) {
            //         return res.status(400).json({ status: 'Failed', message: 'Error during saving new Party' });
            //     }
            //     partyId = saveNewParty[0]._id;
            // } else {
            //     partyId = PartyDetails._id
            // }

            console.log("CHecking Condition partyId && expenseType == GST")

            partyId = await findOrCreateParty(partyName, req.user, session);
        };

        console.log(partyId, 'Party Id');
        //verifying and Formatting Items(if item exist) 
        if (items.length > 0) {
            for (const item of items) {

                item.taxPercent = item.taxPercent ? item.taxPercent : null;

                //Checking if the item is created (if not then creating new one):
                let existingItem = await ExpenseItems.findOne({ name: item.name, createdBy: req.user })

                if (!existingItem) {
                    console.log("Expense item not found in Expenses. Adding new one...");
                    let itemName = item.name;

                    const saveItem = await ExpenseItems.create([{
                        name: itemName,
                        price: item.price,
                        taxRate: item.taxPercent,
                        createdBy: req.user
                    }], { session })

                    if (!saveItem) {
                        throw new Error(`Error during saving new Item`);
                    }

                    item.itemId = saveItem[0]._id;

                } else
                    item.itemId = existingItem._id;


                delete item.name;
            }
        };


        // Create the Expense
        const savedExpense = await Expenses.create([{
            party: partyId,
            partyName,
            expenseType,
            expenseCategory,
            expenseNo,
            date,
            stateOfSupply,
            paymentMethod,
            image,
            description,
            document,
            items,
            grandTotal: +grandTotal,
            roundOff,
            totalAmount: +totalAmount,
            paidAmount,
            balanceAmount,
            createdBy: req.user
        }], { session });

        if (!savedExpense) {
            throw new Error("Failed to save Expense");
        }

        // Prepare transaction reference
        const transactionReference = {
            documentId: savedExpense[0]._id,
            documentNumber: expenseNo,
            docName: "Expenses"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: 'Expense',
            transactionDate: date,
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
        };

        //If Expense Type is gst then party paidAmounf and payable Balance updating
        if (expenseType === "GST") {

            // Update party paid amount and payable Balance
            const updateParty = await Parties.findOneAndUpdate(
                { _id: partyId, name: partyName, createdBy: req.user },
                { $inc: { paidAmount: +paidAmount, 'balanceDetails.payableBalance': +balanceAmount } },
                { new: true, session }
            );

            if (!updateParty) {
                throw new Error("Failed to update Party Paid amount");
            }
        };


        // After the Expense is saved, update the cheque's reference to point to the saved Debit note
        await updateChequeReference(savedExpense[0].paymentMethod, savedExpense, session, 'Save');

        //Updating Amount Expensed for the Expense Category
        const updatedExpenseAmount = await ExpenseCategory.findOneAndUpdate(
            { name: expenseCategory, createdBy: req.user }, {
            $inc: { expenseAmount: +paidAmount }
        }, { new: true, session });

        if (!updatedExpenseAmount) {
            throw new Error("Failed to update Expense Amount for Category");
        };

        //Checking and updating Expense No

        if (!isNaN(expenseNo) && expenseNo !== '') {
            let getLatestExpenseNumber = await SeriesNumber.findOne({ createdBy: req.user }).select('expenseNo');

            if (+expenseNo >= getLatestExpenseNumber?.expenseNo) {

                // Update the Expense number series
                const updateSeries = await SeriesNumber.findOneAndUpdate(
                    { createdBy: req.user },
                    { expenseNo: +expenseNo + 1 },
                    { new: true, session }
                )

                if (!updateSeries) {
                    throw new Error(`Failed to update SeriesNumber`);
                };

            };

        };

        // Committing the transaction
        await session.commitTransaction();
        res.status(201).json({ status: "Success", message: "Expense Saved Successfully", data: savedExpense });
    } catch (error) {
        await session.abortTransaction();
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        // End the session
        session.endSession();
    }
};


exports.editExpense = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const expenseId = req.params.id;
        let {
            expenseType, partyId, partyName, expenseCategory,
            expenseNo, date, stateOfSupply,
            description, paymentMethod,
            roundOff, items, grandTotal,
            totalAmount, paidAmount, balanceAmount
        } = req.body;

        if (!expenseType) {
            return res.status(400).json({ status: "Failed", message: "Expense Type is Required" });
        }

        stateOfSupply = !stateOfSupply ? null : stateOfSupply;

        if (expenseType === "GST" && !partyName) {
            return res.status(400).json({ status: "Failed", message: "Party Name is required when expenseType is GST" });
        };

        if (paymentMethod === "Bank" && !bankName) {
            return res.status(400).json({ status: "Failed", message: "Bank is required if payment Method is Bank" });
        };

        // Fetch the existing expense
        const existingExpense = await Expenses.findOne({ _id: expenseId, createdBy: req.user });
        if (!existingExpense) {
            return res.status(404).json({ status: "Failed", message: "Expense not found" });
        };


        // Fetch the existing Party
        // const existingParty = await Parties.findOne({ _id: partyId, name: partyName, createdBy: req.user });
        // if (!existingParty) {
        //     return res.status(404).json({ status: "Failed", message: "Party not found" });
        // }

        // Revert party balance and paidAmount if the original expenseType was GST
        if (existingExpense.expenseType === "GST" && existingExpense.party) {
            await Parties.findOneAndUpdate(
                { _id: existingExpense.party, createdBy: req.user },
                {
                    $inc: {
                        paidAmount: -existingExpense.paidAmount,
                        'balanceDetails.payableBalance': -existingExpense.balanceAmount
                    }
                },
                { session }
            );
        }

        // Revert expenseAmount for the previous expenseCategory
        const previousExpenseCategory = await ExpenseCategory.findOneAndUpdate(
            { name: existingExpense.expenseCategory, createdBy: req.user },
            { $inc: { expenseAmount: -existingExpense.paidAmount } },
            { new: true, session }
        );

        if (!previousExpenseCategory) {
            throw new Error("Failed to revert Expense Amount for the previous Category");
        }

        // Check and update balance and party fields based on expenseType
        if (expenseType !== "GST") {
            balanceAmount = 0;
            paidAmount = totalAmount;
            stateOfSupply = "";
            partyId = null;
            partyName = "";
        };

        // Parse items and handle image/document uploads
        items = items ? JSON.parse(items) : [];
        let image = existingExpense.image, document = existingExpense.document;
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

        // verifying and formatting payment Type

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Payment Method Validation
        if (paymentMethod.length > 0) {
            for (const payment of paymentMethod) {

                if (!["Cash", "Cheque", "Bank"].includes(payment.method)) {
                    return res.status(400).json({
                        status: "Failed",
                        message: `Invalid payment method. Allowed values are 'Cash', 'Cheque', or 'Bank'.`
                    });
                }
                if (payment.method === "Bank") {
                    if (!payment.bankName) {
                        return res.status(400).json({
                            status: "Failed",
                            message: `Bank name is required when the payment method is 'Bank'.`
                        });
                    }

                }
                if (payment.amount <= 0 || !payment.amount) {
                    return res.status(400).json({
                        status: "Failed",
                        message: `Payment amount must be greater than zero.`
                    });
                }
            }

        };


        // Validate party details for GST expenseType
        if (partyName && expenseType === "GST") {
            const PartyDetails = await Parties.findOne({ name: partyName, createdBy: req.user });
            if (!PartyDetails) {

                console.log('Party Not found. Creating One...');

                const saveNewParty = await Parties.create([{ name: partyName, gstType: 'Unregistered/Consumer', createdBy: req.user }], { session });

                if (!saveNewParty) {
                    return res.status(400).json({ status: 'Failed', message: 'Error during saving new Party' });
                }

                partyId = saveNewParty[0]._id;
            } else {
                partyId = PartyDetails._id
            }
        }

        if (items.length > 0) {
            for (const item of items) {

                //Checking if the item is created (if not then creating new one):
                let existingItem = await ExpenseItems.findOne({ name: item.name, createdBy: req.user })

                if (!existingItem) {
                    console.log("Expense item not found in Expenses. Adding new one...")

                    let itemName = item.name;

                    const saveItem = await ExpenseItems.create([{
                        name: itemName,
                        price: item.price,
                        taxRate: item.taxPercent,
                        createdBy: req.user
                    }], { session })

                    if (!saveItem) {
                        throw new Error(`Error during saving new Item`);
                    }

                    item.itemId = saveItem[0]._id

                } else
                    item.itemId = existingItem._id


                delete item.name;
            }
        }

        // Update the expense
        const updatedExpense = await Expenses.findOneAndUpdate(
            { _id: expenseId },
            {
                party: partyId,
                partyName,
                expenseType,
                expenseCategory,
                expenseNo,
                date,
                stateOfSupply,
                paymentMethod,
                image,
                description,
                document,
                items,
                grandTotal: +grandTotal,
                roundOff,
                totalAmount: +totalAmount,
                paidAmount,
                balanceAmount,
                updatedBy: req.user // Add who updated the record
            },
            { new: true, session }
        );

        if (!updatedExpense) {
            throw new Error("Failed to update Expense");
        }

        // Prepare transaction reference
        const transactionReference = {
            documentId: updatedExpense._id,
            documentNumber: expenseNo,
            docName: "Expenses"
        };

        // Update or create the transaction document
        const updatedTransaction = await Transactions.findOneAndUpdate(
            { 'reference.documentId': updatedExpense._id },
            {
                transactionType: expenseCategory,
                transactionDate: date,
                totalAmount,
                party: partyId,
                debit_amount: paidAmount,
                balance: balanceAmount,
                description,
                reference: transactionReference,
                paymentMethod,
                updatedBy: req.user
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update transaction");
        }

        // If Expense Type is GST, update party paidAmount and payableBalance
        if (expenseType === "GST") {
            const updateParty = await Parties.findOneAndUpdate(
                { _id: partyId, name: partyName, createdBy: req.user },
                {
                    $inc: {
                        paidAmount: +paidAmount,
                        'balanceDetails.payableBalance': +balanceAmount
                    }
                },
                { new: true, session }
            );

            if (!updateParty) {
                throw new Error("Failed to update Party Paid amount");
            }
        }

        // Update the amount expensed for the Expense Category
        const updatedExpenseCategory = await ExpenseCategory.findOneAndUpdate(
            { name: expenseCategory, createdBy: req.user },
            { $inc: { expenseAmount: +paidAmount } },
            { new: true, session }
        );

        if (!updatedExpenseCategory) {
            throw new Error("Failed to update Expense Amount for Category");
        }

        // Commit the transaction
        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Expense Updated Successfully", data: updatedExpense });

    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        // End the session
        session.endSession();
    }
};




exports.deleteExpense = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const expenseId = req.params.id;

        // Fetch the existing expense
        const existingExpense = await Expenses.findOne({ _id: expenseId, createdBy: req.user });
        if (!existingExpense) {
            return res.status(404).json({ status: "Failed", message: "Expense not found" });
        }

        // Revert party balance and paidAmount if the original expenseType was GST
        if (existingExpense.expenseType === "GST" && existingExpense.party) {
            await Parties.findOneAndUpdate(
                { _id: existingExpense.party, createdBy: req.user },
                {
                    $inc: {
                        paidAmount: -existingExpense.paidAmount,
                        'balanceDetails.payableBalance': -existingExpense.balanceAmount
                    }
                },
                { session }
            );
        }

        // Revert expenseAmount in the ExpenseCategory
        const previousExpenseCategory = await ExpenseCategory.findOneAndUpdate(
            { name: existingExpense.expenseCategory, createdBy: req.user },
            { $inc: { expenseAmount: -existingExpense.paidAmount } },
            { new: true, session }
        );

        if (!previousExpenseCategory) {
            throw new Error("Failed to revert Expense Amount for the previous C  ategory");
        }

        // Delete the associated transaction
        const deletedTransaction = await Transactions.findOneAndDelete(
            { 'reference.documentId': existingExpense._id },
            { session }
        );

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated transaction");
        }

        // Delete the expense
        const deletedExpense = await Expenses.findOneAndDelete(
            { _id: expenseId, createdBy: req.user },
            { session }
        );

        if (!deletedExpense) {
            throw new Error("Failed to delete Expense");
        }

        // Commit the transaction
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Expense Deleted Successfully" });

    } catch (error) {
        // Rollback the transaction on error
        await session.abortTransaction();
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        // End the session
        session.endSession();
    }
};