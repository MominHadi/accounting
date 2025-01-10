const mongoose = require("mongoose");
const Purchase = require("../../models/purchase/purchaseModel");
const PurchaseOrders = require("../../models/purchase/purchaseOrderModel");
const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel")
const SeriesNumber = require("../../models/seriesnumber");
const formatDate = require("../../global/formatDate");
const { deleteFile } = require("../../global/deleteFIle");
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference, handleChequeUpdates } = require("../../utils/cheques");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require("../../utils/partyUtils");


exports.getBillNumber = async (req, res) => {
    try {

        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("purchaseBillNo");

        console.log(req.user, `Request User`);

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })

    }
};

exports.getAllPurchaseBills = async (req, res) => {
    try {
        const { fromDate, toDate, search } = req.query;

        let searchConditions = { createdBy: req.user };

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setDate(endDate.getDate() + 1);

            searchConditions.billDate = {
                $gte: startDate,
                $lte: endDate
            };
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            searchConditions.$or = [
                { billNo: { $regex: regex } },
                { partyName: { $regex: regex } }
            ];
        }

        let totalPurchaseAmount = 0;
        let totalPaidAmount = 0;
        let totalUnPaidAmount = 0;

        const PurchaseList = await Purchase.find(searchConditions)
            .select("billNo billDate partyName paymentMethod totalAmount paidAmount balanceAmount")
            .populate({ path: "paymentMethod.bankName", select: "bankName" })
            .sort({ billDate: -1 });

        // if (!PurchaseList.length) {
        //     return res.status(200).json({ error: "Data not Found!!!!" });
        // };

        const formattedEntries = PurchaseList.map(item => {
            const formattedDate = formatDate(item.billDate);
            totalPurchaseAmount += item.totalAmount;
            totalPaidAmount += item.paidAmount;
            totalUnPaidAmount += item.balanceAmount;

            // Transform paymentMethod array to string
            const paymentMethods = item.paymentMethod.map(method => {
                if (method.method === "Bank" && method.fbankName) {
                    return `${method.bankName.bankName}`;
                }
                return method.method;
            }).join(', ');

            return {
                _id: item._id,
                billNo: item.billNo,
                billDate: formattedDate,
                partyName: item.partyName,
                paymentMethod: paymentMethods,
                totalAmount: item.totalAmount,
                balanceAmount: item.balanceAmount
            };
        });

        res.status(200).json({
            status: "Success", data: formattedEntries,
            totalPurchaseAmount,
            paidAmount: totalPaidAmount,
            unPaidAmount: totalUnPaidAmount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};



exports.getPurchaseBillById = async (req, res) => {
    try {
        const { billId } = req.params;
        if (!billId) {
            return res.status(400).json({ status: "Failed", message: "Purchase Bill Id is Required" })
        }

        const purchaseData = await Purchase
            .findOne({ _id: billId, createdBy: req.user })
            .select("-__v  ")
            .populate({ path: "paymentMethod.bankName", select: " -_id bankName" })
            .populate({ path: "stateOfSupply" })
            .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
            .populate({ path: "items.unit", select: "-createdAt -updatedAtb   -__v" })
            .populate({ path: "items.taxPercent" })

        if (!purchaseData) {
            return res.status(404).json({ error: "Purchase Bill not Found!!!!" })
        }

        purchaseData.billDate = formatDate(purchaseData.billDate);

        res.status(200).json({ status: "Success", data: purchaseData })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })

    }

}

exports.createPurchaseBill = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {

        let { billNumber, billDate, party, phoneNo, stateOfSupply, paymentMethod, description, items, totalAmount, roundOff, paidAmount, balanceAmount, orderDetails } = req.body;
        let partyId;

        if (!billNumber || !billDate || !party || !paymentMethod) {
            return res.status(200).json({ status: "Failed", message: "All Fields are Required" })
        }

        // Ensure ordereDetails exists and is an object
        orderDetails = orderDetails && typeof orderDetails === 'string' ? JSON.parse(orderDetails) : {};
        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        if (orderDetails.documentId && !orderDetails.documentNo) {
            return res.status(400).json({ status: "Failed", message: "All Fields of Order are Required of Purchase Order" })
        };

        // Parse items and handle image uploads
        items = items ? JSON.parse(items) : [];

        let image = '';
        balanceAmount = balanceAmount || 0;

        if (req.files) {
            for (const file of req.files) {
                if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
                    image = file.filename;
                }
            }
        };

        // Check for existing Bill number
        // const isPurchaseBillExist = await Purchase.findOne({ billNo: billNumber, createdBy: req.user });

        // if (isPurchaseBillExist) {
        //     return res.status(409).json({ status: "Failed", message: "Bill No. already exists" });
        // };

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        partyId = await findOrCreateParty(party, req.user, session);


        //verifying and Formatting Items(if item exist) 
        if (items.length > 0) {

            items = await processItems(items, req.user, session);
        };

        if (balanceAmount == 0) {
            // Processing each payment method to  create  cheques
            for (const payment of paymentMethod) {
                if (payment.method === "Cheque") {
                    const chequeData = {
                        partyName: party,
                        party: partyId,
                        transactionType: "debit",
                        date: billDate,
                        amount: payment.amount,
                        referenceNo: payment.referenceNo ? payment.referenceNo : '',
                        source: "Purchase",
                        reference: null,
                        status: "open",
                        createdBy: req.user
                    };

                    const savedCheque = await createCheque(chequeData, session);
                    payment.chequeId = savedCheque._id;
                };
            };
        };

        const savedPurchase = await Purchase.create([{ billNo: billNumber, billDate, stateOfSupply, party: partyId, partyName: party, phoneNo, image, description, paymentMethod, items, orderDetails, totalAmount, roundOff, paidAmount, balanceAmount, createdBy: req.user }], { session })

        if (!savedPurchase) {
            throw new Error("Failed to save Purchase Bill");
        };

        // Prepare transaction reference
        const transactionReference = {
            documentId: savedPurchase[0]._id,
            documentNumber: billNumber,
            docName: "Purchase"
        };

        // Create the transaction document
        const savedTransaction = await Transactions.create([{
            transactionType: "Purchase",
            transactionDate: billDate,
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

        // After the Purchase is saved, update the cheque's reference to point to the saved Purchase
        await updateChequeReference(savedPurchase[0].paymentMethod, savedPurchase, session, 'Save');

        // Update party received amount and receivable Balance
        const updateParty = await Parties.findOneAndUpdate(
            { _id: partyId, name: party, createdBy: req.user },
            { $inc: { paidAmount: +paidAmount, 'balanceDetails.payableBalance': +balanceAmount } },
            { new: true, session }
        );

        if (!updateParty) {
            throw new Error("Failed to update Party Paid amount");
        }

        //Updating Stock Quantity in items
        for (const item of items) {
            const { itemId, quantity } = item;

            // Using findOneAndUpdate directly
            const updatedProduct = await Products.findOneAndUpdate(
                { _id: itemId, type: 'Product', createdBy: req.user },
                { $inc: { 'stock.totalQuantity': +quantity, 'stock.purchaseQuantity': +quantity } },
                { new: true, session } // Return the updated document
            );

            if (!updatedProduct) {
                throw new Error(`Failed to update product with itemId ${itemId}. Product not found.`);
            } else {
                console.log(`Updated Product`);
            }
        };


        if (orderDetails.orderId && orderDetails.orderNo) {
            const conversionDetails = {
                documentNo: savedPurchase[0].billNo,
                documentId: savedPurchase[0]._id
            }

            const updatedPurchaseOrder = await PurchaseOrders.findOneAndUpdate({ _id: orderDetails.orderId, orderNo: orderDetails.orderNo, createdBy: req.user, isConverted: false }, {
                isConverted: true, status: "Order Closed", conversionDetails
            }, { new: true, runValidators: true, session });

            if (!updatedPurchaseOrder) {
                throw new Error('Failed to Update the Purchase Order')
            };
        };

        let getLatestBillNo = await SeriesNumber.findOne({ createdBy: req.user }).select('purchaseBillNo');

        console.log(req.user, "getLatestBillNo", 'Requestr user')
        if (+billNumber >= getLatestBillNo?.purchaseBillNo) {

            // Update the invoice number series
            const updateSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { purchaseBillNo: +billNumber + 1 },
                { new: true, session }
            )

            if (!updateSeries) {
                throw new Error(`Failed to update SeriesNumber`);
            };

        };

        //Commiting Transaction
        await session.commitTransaction();

        res.status(201).json({ status: "Success", message: "Purchase Bill Saved Successfully", data: savedPurchase })
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        res.status(500).json({ message: "Internal Server Error", error: error })

    } finally {
        session.endSession();
    }
};

exports.updatePurchaseBill = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billId } = req.params;
        let { billNumber, billDate, partyName, phoneNo, stateOfSupply, paymentMethod, description, items, partyId, totalAmount, roundOff, paidAmount, balanceAmount } = req.body;

        console.log(req.body, 'Request Body Purchase Bill Edit')

        if (!billId || !billNumber || !billDate || !paymentMethod) {
            return res.status(400).json({ status: "Failed", message: "All Fields are Required" });
        }

        stateOfSupply = !stateOfSupply ? null : stateOfSupply;

        // Validate if the bill exists
        const existingBill = await Purchase.findOne({ _id: billId, createdBy: req.user });
        if (!existingBill) {
            return res.status(404).json({ status: "Failed", message: "Bill not found" });
        };


        // Revert stock quantities based on previously updated items
        if (existingBill.items.length > 0) {
            for (const item of existingBill.items) {
                const { itemId, quantity } = item;

                const updatedProduct = await Products.findOneAndUpdate(
                    { _id: itemId, createdBy: req.user },
                    { $inc: { 'stock.totalQuantity': -quantity, 'stock.purchaseQuantity': -quantity } },
                    { new: true, session }
                );

                if (!updatedProduct) {
                    throw new Error(`Failed to update product stock for itemId ${itemId}`);
                }
            }
        };

        console.log(existingBill.party, existingBill, 'Test Party 1')

        // Revert Party balance details
        const revertPartyAmount = await Parties.findOneAndUpdate(
            { _id: existingBill.party, createdBy: req.user },
            { $inc: { paidAmount: -existingBill.paidAmount, 'balanceDetails.payableBalance': -existingBill.balanceAmount } },
            { new: true, session }
        );


        partyId = await findOrCreateParty(partyName, req.user, session);

        console.log(partyId, 'partyId');

        items = items ? JSON.parse(items) : [];


        if (items.length > 0) {
            items = await processItems(items, req.user, session);
        }

        if (!revertPartyAmount) {
            throw new Error("Failed to update Party balance");
        };

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Processing each payment method to either create cheques or update
        const existingPaymentMethods = existingBill.paymentMethod;

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
                    source: "Purchase",
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

        let image = '';
        if (req.files) {
            for (const file of req.files) {
                if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
                    image = file.filename;
                }
            }
        }

        // Update Bill
        const updatedPurchase = await Purchase.findOneAndUpdate(
            { _id: billId, createdBy: req.user },
            {
                billNo: billNumber, billDate, stateOfSupply, party: partyId, partyName, image,
                phoneNo, description, paymentMethod, items,
                totalAmount, roundOff, paidAmount, balanceAmount
            },
            { new: true, session }
        );

        if (!updatedPurchase) {
            throw new Error("Failed to update Purchase Bill");
        };

        // Update corresponding transaction
        const updatedTransaction = await Transactions.findOneAndUpdate(
            { 'reference.documentId': billId, createdBy: req.user },
            {
                totalAmount,
                party: partyId,
                transactionDate:billDate,
                debit_amount: paidAmount,
                balance: balanceAmount,
                description,
                paymentMethod,
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update transaction");
        };



        console.log(partyId, 'Test Party 2')
        // Update Party balance details
        const updatedParty = await Parties.findOneAndUpdate(
            { _id: partyId, createdBy: req.user },
            { $inc: { paidAmount: +paidAmount, 'balanceDetails.payableBalance': +balanceAmount } },
            { new: true, session }
        );

        if (!updatedParty) {
            throw new Error("Failed to update Party balance");
        };

        // Updating stock quantities based on updated items
        for (const item of items) {
            const { itemId, quantity } = item;

            const updatedProduct = await Products.findOneAndUpdate(
                { _id: itemId, type: 'Product', createdBy: req.user },
                { $inc: { 'stock.totalQuantity': +quantity, 'stock.purchaseQuantity': +quantity } },
                { new: true, session }
            );

            if (!updatedProduct) {
                throw new Error(`Failed to update product stock for itemId ${itemId}`);
            }
        };

        let getLatestBillNo = await SeriesNumber.findOne({ createdBy: req.user }).select('purchaseBillNo');

        // Update invoice number series if bill number changed
        if (existingBill.billNo !== billNumber) {

            if (+billNumber >= getLatestBillNo.purchaseBillNo) {

                const updatedSeries = await SeriesNumber.findOneAndUpdate(
                    { createdBy: req.user },
                    { purchaseBillNo: +billNumber + 1 },
                    { new: true, session }
                );

                if (!updatedSeries) {
                    throw new Error("Failed to update SeriesNumber");
                }
            };

        };

        if (existingBill.orderDetails.orderId && existingBill.orderDetails.orderNo) {
            const conversionDetails = {
                documentNo: updatedPurchase.billNo,
                documentId: updatedPurchase._id
            }

            const updatedPurchaseOrder = await PurchaseOrders.findOneAndUpdate(
                { _id: existingBill.orderDetails.orderId, orderNo: existingBill.orderDetails.orderNo, createdBy: req.user, isConverted: true },
                { conversionDetails },
                { new: true, runValidators: true, session });

            if (!updatedPurchaseOrder) {
                throw new Error('Failed to Update the Purchase Order')
            }
        }

        // After the invoice is saved, update the cheque's reference to point to the saved invoice
        await updateChequeReference(updatedPurchase.paymentMethod, updatedPurchase, session, 'Update');

        // Commit the transaction
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Purchase Bill updated successfully", data: updatedPurchase });

    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error.message });

    } finally {
        session.endSession();
    }
};


exports.deletePurchaseBill = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { billId } = req.params;

        if (!billId) {
            return res.status(400).json({ status: "Failed", message: "Bill ID is required" });
        };

        const existingBill = await Purchase.findOne({ _id: billId, createdBy: req.user });
        if (!existingBill) {
            return res.status(404).json({ status: "Failed", message: "Bill not found" });
        };

        if (existingBill.image) {
            await deleteFile(existingBill.image, 'images')
        };

        //Checking whether purchase bill can de;ete or not 
        let canBillDelete = await checkDocumentCanDelete(billId, req.user);

        if (!canBillDelete) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };

        // Revert stock quantities for the items in the bill
        if (existingBill.items.length > 0) {
            for (const item of existingBill.items) {
                const { itemId, quantity } = item;

                const updatedProduct = await Products.findOneAndUpdate(
                    { _id: itemId, createdBy: req.user },
                    { $inc: { 'stock.totalQuantity': -quantity, 'stock.purchaseQuantity': -quantity } },
                    { new: true, session }
                );

                if (!updatedProduct) {
                    throw new Error(`Failed to revert product stock for itemId ${itemId}`);
                }
            }
        };

        // Revert Party balance details
        const revertPartyAmount = await Parties.findOneAndUpdate(
            { _id: existingBill.party, createdBy: req.user },
            { $inc: { paidAmount: -existingBill.paidAmount, 'balanceDetails.payableBalance': -existingBill.balanceAmount } },
            { new: true, session }
        );

        if (!revertPartyAmount) {
            throw new Error("Failed to revert Party balance");
        };

        // Delete corresponding transaction
        const deletedTransaction = await Transactions.findOneAndDelete(
            { 'reference.documentId': billId, createdBy: req.user },
            { session }
        );

        if (!deletedTransaction) {
            throw new Error("Failed to delete associated transaction");
        }

        const deletedBill = await Purchase.findOneAndDelete(
            { _id: billId, createdBy: req.user },
            { session }
        );

        if (!deletedBill) {
            throw new Error("Failed to delete Purchase Bill");
        };

        //Deleting all the cheques of this bill
        await deleteChequesByReference(billId, session);

        // Commit the transaction
        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Purchase Bill Deleted Successfully" });

    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error.message });

    } finally {
        session.endSession();
    }
};
