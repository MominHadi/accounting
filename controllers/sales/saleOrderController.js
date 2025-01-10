const SaleOrders = require("../../models/saleOrderModel");
const Parties = require("../../models/partyModel");
const Transactions = require("../../models/transactionModel");
const Quotations = require("../../models/quotationModel");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel");
const SeriesNumber = require('../../models/seriesnumber');
const formatDate = require('../../global/formatDate');
const { deleteFile } = require('../../global/deleteFIle');
const mongoose = require("mongoose");
const { validatePaymentMethods } = require("../../utils/validationUtils");
const { checkDocumentCanDelete, updateChequeReference, updateCheque, createCheque, deleteChequesByReference,handleChequeUpdates } = require("../../utils/cheques");
const { processItems } = require('../../utils/itemUtils');
const { findOrCreateParty } = require('../../utils/partyUtils');

exports.getOrderNo = async (req, res) => {
    try {
        const data = await SeriesNumber.findOne({ createdBy: req.user }).select("orderNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: data })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Sale Order Id is Required" })
        }
        const saleOrderData = await SaleOrders
            .findOne({ _id: id, createdBy: req.user })
            .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
            .populate({ path: "items.unit", select: " -_v" })
            .populate({ path: "stateOfSupply", select: " -_v" })
            .populate({ path: "items.taxPercent" })

        if (!saleOrderData) {
            return res.status(404).json({ error: "Sale Order not Found!!!!" })
        }
        saleOrderData.orderDate = formatDate(saleOrderData.orderDate)
        res.status(200).json({ status: "Success", data: saleOrderData })
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
};


exports.getAllOrders = async (req, res) => {
    try {
        const { search, fromDate, toDate } = req.query;
        let searchConditions = { createdBy: req.user };

        // Date range filter
        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            endDate.setDate(endDate.getDate() + 1); // Ensure the endDate includes the full day

            // Validate if dates are properly parsed
            if (isNaN(startDate) || isNaN(endDate)) {
                return res.status(400).json({ message: "Invalid date range provided" });
            }

            searchConditions.orderDate = { $gte: startDate, $lt: endDate }; // Use $lt for strict endDate limit
        }

        // Search logic
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const searchNumeric = parseFloat(search);

            const searchFields = {
                $or: [
                    ...(isNaN(searchNumeric) ? [] : [
                        { orderNo: searchNumeric },
                        { totalAmount: searchNumeric },
                        { balanceAmount: searchNumeric }
                    ]),
                    { orderNo: { $regex: searchRegex } },
                    { partyName: { $regex: searchRegex } },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                                regex: search
                            }
                        }
                    }
                ]
            };

            // Combine date range and search conditions
            searchConditions = {
                $and: [searchConditions, searchFields]
            };
        }

        const orderData = await SaleOrders
            .find(searchConditions)
            .select("orderDate orderNo partyName totalAmount balanceAmount _id")
            .sort({ orderDate: -1 });

        if (!orderData.length) {
            return res.status(200).json({ status: "Success", message: "No data found" });
        }

        const formattedEntries = orderData.map(item => {
            const formattedDate = formatDate(item.orderDate);

            return {
                ...item._doc,
                orderDate: formattedDate
            };
        });

        res.status(200).json({ status: "Success", data: formattedEntries });
    } catch (error) {
        console.log(error,'Error')
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};


exports.createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction()
    try {
        let {
            partyId, party, billingAddress, phoneNo,
            orderNo, orderDate, dueDate, stateOfSupply,
            description, paymentMethod,
            roundOff, items,
            totalAmount, balanceAmount, advanceAmount,
            poReference
        } = req.body;

        poReference = poReference && typeof poReference === 'string' ? JSON.parse(poReference) : {};
        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        // Parse items and handle image/document uploads
        // let itemsArray = JSON.parse(items);

        items = items ? JSON.parse(items) : [];

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

        
        // Check for existing Order number
        // const isOrderExist = await SaleOrders.findOne({ orderNo });
        // if (isOrderExist) {
        //     return res.status(409).json({ status: "Failed", message: "Order No. already exists" });
        // }
        
        partyId = await findOrCreateParty(party, req.user, session);


        // Validating and formatting  payment Method

        paymentMethod = JSON.parse(paymentMethod);

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        //verifying and Formatting Items(if item exist) 

        if (items.length > 0) {

            items = await processItems(items, req.user, session);
        };

        if (parseFloat(advanceAmount) > 0) {
            // Processing each payment method to either create  cheques
            for (const payment of paymentMethod) {
                if (payment.method === "Cheque") {
                    const chequeData = {
                        partyName: party,
                        party: partyId,
                        transactionType: "credit",
                        date: orderDate,
                        amount: payment.amount,
                        referenceNo: payment.referenceNo ? payment.referenceNo : '',
                        source: "SaleOrder",
                        reference: null,
                        status: "open",
                        createdBy: req.user
                    };

                    if (parseFloat(balanceAmount) > 0) {
                        const savedCheque = await createCheque(chequeData, session);
                        payment.chequeId = savedCheque._id;
                    };
                }
            };
        };

        const savedOrder = await SaleOrders.create([{
            poReference, party: partyId, partyName: party, orderNo, orderDate, dueDate, billingAddress, stateOfSupply, phoneNo, document, image, items, status: "Order Open", roundOff, totalAmount, advanceAmount, balanceAmount, paymentMethod, createdBy: req.user
        }], { session });


        if (!savedOrder) {
            throw new Error(`Failed to save Order`);
        };

        const transactionReference = {
            documentId: savedOrder[0]._id,
            documentNumber: savedOrder[0].orderNo,
            docName: "SaleOrder"
        };

        // Create the transaction 
        const savedTransaction = await Transactions.create([{
            transactionType: "Sale Order",
            party: partyId,
            totalAmount,
            credit_amount: advanceAmount,
            balance: balanceAmount,
            description,
            reference: transactionReference,
            paymentMethod,
            createdBy: req.user
        }], { session });

        if (!savedTransaction) {
            throw new Error("Failed to save transaction");
        };

        // After the order is saved, update the cheque's reference to point to the saved order
        await updateChequeReference(savedOrder[0].paymentMethod, savedOrder, session, 'Save');

        const { poId, poNumber, poDate } = poReference;

        if (poId && poNumber) {
            const conversionDetails = {
                documentId: savedOrder[0]._id,
                documentType: "SaleOrder",
                documentNo: savedOrder[0].orderNo
            }

            const updatedEstimate = await Quotations.findOneAndUpdate({ _id: poId, referenceNo: poNumber, createdBy: req.user, isConverted: false },
                { isConverted: true, conversionDetails },
                { new: true, session }
            );

            if (!updatedEstimate) {
                throw new Error(`Failed to Update Estimate`)
            };
        };

        let getLatestOrderNo = await SeriesNumber.findOne({ createdBy: req.user }).select('orderNo');

        if (+orderNo >= getLatestOrderNo.orderNo) {
            // Increment the seriesValue by 1 in the Series collection
            const updatedSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user },
                { orderNo: +orderNo + 1 }, // Increment seriesValue by 1
                { new: true, session } // Ensure this runs within the session
            );

            if (!updatedSeries) {
                throw new Error("Failed to update series value");
            }
        }

        await session.commitTransaction();
        res.status(201).json({ status: "Success", message: "Sale Order Created Successfully", data: savedOrder })
    } catch (error) {
        console.log(error)

        await session.abortTransaction()
      
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })
    }
    finally {
        session.endSession()
    }
}


exports.updateOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let {
            partyId, party, billingAddress, phoneNo,
            orderNo, orderDate, dueDate, stateOfSupply,
            description, paymentMethod, roundOff, items,
            totalAmount, balanceAmount, advanceAmount
        } = req.body;

        // Parse items and handle image/document uploads
        // let itemsArray = JSON.parse(items);
        items = items ? JSON.parse(items) : [];

        let image = '', document = '';
        balanceAmount = balanceAmount || 0;

        stateOfSupply = !stateOfSupply ? null : stateOfSupply

        paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

        //Validating Payment Methods
        const validationResponse = validatePaymentMethods(paymentMethod, res);

        if (validationResponse !== true) {
            return validationResponse;
        };

        // Find the existing order by orderNo or _id (depends on how you're identifying orders)
        const existingOrder = await SaleOrders.findOne({ _id: req.params.id, createdBy: req.user });
        if (!existingOrder) {
            return res.status(404).json({ status: "Failed", message: "Order not found" });
        };

        if (req.files) {
            for (const file of req.files) {
                if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {

                    image = file.filename;

                } else {

                    document = file.filename;
                }
            }
        };

        partyId = await findOrCreateParty(party, req.user, session);
          
        const existingPaymentMethods = existingOrder.paymentMethod;

        // Handle cheque updates (delete removed cheques)
        await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

        if (parseFloat(advanceAmount) > 0) {
            // Processing each payment method to either create  cheques
            for (const payment of paymentMethod) {
                if (payment.method === "Cheque") {
                    const chequeData = {
                        partyName: party,
                        party: partyId,
                        transactionType: "credit",
                        date: orderDate,
                        amount: payment.amount,
                        referenceNo: payment.referenceNo ? payment.referenceNo : '',
                        source: "SaleOrder",
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
        };

        //verifying and Formatting Items(if item exist) 
        if (items.length > 0) {
            items = await processItems(items, req.user, session);
        };

        // if advance Amount is 00 then delete all existing cheque of this order
        if (parseFloat(advanceAmount) <= 0) {

            await deleteChequesByReference(req.params.id, session);

            for (const payment of paymentMethod) {


                payment.chequeId = null
            };
        };

        // Update the order with new data
        const updatedOrder = await SaleOrders.findOneAndUpdate(
            { _id: req.params.id },
            {
                party: partyId,
                partyName: party,
                orderNo,
                orderDate,
                dueDate,
                billingAddress,
                stateOfSupply,
                phoneNo,
                document,
                image,
                items,
                roundOff,
                totalAmount,
                advanceAmount,
                balanceAmount,
                paymentMethod,
            },
            { new: true, session }
        );

        if (!updatedOrder) {
            throw new Error("Failed to update Order");
        };

        // Update the transaction related to this order
        const transactionReference = {
            documentId: updatedOrder._id,
            documentNumber: updatedOrder.orderNo,
            docName: "SaleOrder"
        };

        const updatedTransaction = await Transactions.findOneAndUpdate(
            { 'reference.documentId': existingOrder._id }, // Ensure you're updating the right transaction
            {
                transactionType: "Sale Order",
                party: partyId,
                totalAmount,
                credit_amount: advanceAmount,
                balance: balanceAmount,
                description,
                reference: transactionReference,
                paymentMethod,
            },
            { new: true, session }
        );

        if (!updatedTransaction) {
            throw new Error("Failed to update transaction");
        };

        //If Sale Order is Generated from Estimate
        const { poId, poNumber, date } = existingOrder.poReference;

        const conversionDetails = {
            documentId: updatedOrder._id,
            documentType: "SaleOrder",
            documentNo: updatedOrder.orderNo
        };

        if (poId && poNumber) {
            const updatedQuotation = await Quotations.findOneAndUpdate({ _id: poId.toString(), referenceNo: poNumber, createdBy: req.user, isConverted: 'true' }, {
                conversionDetails
            },
                { new: true, session });

            if (!updatedQuotation) {
                throw new Error("Failed to update Estimate");

            }
        };

        // After the order is updated, update the cheque's reference to point to the saved order
        await updateChequeReference(updatedOrder.paymentMethod, updatedOrder, session, 'Update');

        await session.commitTransaction();
        res.status(200).json({ status: "Success", message: "Sale Order Updated Successfully", data: updatedOrder });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        session.endSession();
    }
}; 

exports.deleteOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Order ID passed in the request URL

        // Find the order by ID
        const existingOrder = await SaleOrders.findOne({ _id: id, createdBy: req.user });
        if (!existingOrder) {
            return res.status(404).json({ status: "Failed", message: "Order not found" });
        };


        let canInvoiceDelete = await checkDocumentCanDelete(id, req.user);

        if (!canInvoiceDelete) {
            return res.status(200).json({ status: "Failed", message: `Transaction Cannot be deleted as cheque of this transaction is closed` })
        };

        const { poId, poNumber } = existingOrder.poReference;

        if (existingOrder.image) {
            await deleteFile(existingOrder.image, 'images');
        };

        if (existingOrder.document) {
            await deleteFile(existingOrder.document, 'docs');
        };

        // Delete the related transaction
        const deletedTransaction = await Transactions.findOneAndDelete(
            { 'reference.documentId': existingOrder._id, createdBy: req.user },
            { session }
        );

        if (!deletedTransaction) {
            throw new Error("Failed to delete transaction related to the order");
        };

        // Delete the order
        const deletedOrder = await SaleOrders.findOneAndDelete({ _id: id }, { session });
        if (!deletedOrder) {
            throw new Error("Failed to delete the order");
        };

        if (poId && poNumber) {
            const updatedQuotation = await Quotations.findOneAndUpdate({ _id: poId.toString(), referenceNo: poNumber, createdBy: req.user, isConverted: 'true' }, {
                'conversionDetails.isDeleted': true
            },
                { new: true, session });

            if (!updatedQuotation) {
                throw new Error("Failed to update Estimate");
            }
        };

        //Deleting all the cheques of this Sale Order (if there)
        await deleteChequesByReference(id, session);

        await session.commitTransaction();

        res.status(200).json({ status: "Success", message: "Sale Order and related transaction deleted successfully" });
    } catch (error) {
        console.log(error);
        await session.abortTransaction();
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        session.endSession();
    }
};
