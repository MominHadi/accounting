const mongoose = require('mongoose');
const Transactions = require('../../../models/transactionModel');
const Invoices = require('../../../models/invoiceModel');
const CreditNotes = require('../../../models/crnModel');
const Purchase = require("../../../models/purchase/purchaseModel");
const DebitNotes = require('../../../models/purchase/debitNoteModel');
const Products = require('../../../models/productModel');

exports.generateItemProfitLossReport = async (req, res) => {
    try {
        let { fromDate, toDate, sortBy, itemsHavingSale } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        };

        // Convert to date objects
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);


        let SalesData = await Invoices.aggregate([
            {
                $match: {
                    invoiceDate: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$items' },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    saleAmount: { $sum: '$items.finalAmount' },
                }
            },
            {
                $project: {
                    // itemId: "$_id",
                    itemName: 1,
                    saleAmount: 1
                }
            }
        ]);

        let PurchaseData = await Purchase.aggregate([
            {
                $match: {
                    billDate: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$items' },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    purchaseAmount: { $sum: '$items.finalAmount' },
                }
            },
            {
                $project: {
                    itemName: 1,
                    purchaseAmount: 1
                }
            }
        ]);


        const CreditNoteData = await CreditNotes.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$items' },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    creditNoteAmount: { $sum: '$items.finalAmount' },
                }
            },
            {
                $project: {
                    // itemId: "$_id",
                    itemName: 1,
                    creditNoteAmount: 1
                }
            }
        ]);

        const DebitNoteData = await DebitNotes.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$items' },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    debitNoteAmount: { $sum: '$items.finalAmount' },
                }
            },
            {
                $project: {
                    itemName: 1,
                    debitNoteAmount: 1
                }
            }
        ]);

        let stockDetails = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            }, {
                $addFields: {
                    openingStockValue: {
                        $multiply: ['$stock.openingQuantity', '$salePrice']
                    },

                    closingStockValue: {
                        $multiply: ['$stock.totalQuantity', '$salePrice']
                    }
                }
            }, {
                $project: {
                    _id: '$_id',
                    itemName: 1,
                    openingStockValue: 1,
                    closingStockValue: 1
                }
            }
        ]);

        stockDetails = stockDetails.map(item => {
            return {
                ...item,
                closingStockValue: item.closingStockValue < 0 ? 0 : item.closingStockValue
            }
        });

        let result = mergeData(SalesData, PurchaseData, CreditNoteData, DebitNoteData, stockDetails);

        if (itemsHavingSale) result = result.filter(item => item.saleAmount > 0);


        const finalResult = result.map(data => {
            const saleAmount = parseFloat(data.saleAmount || 0);
            const purchaseAmount = parseFloat(data.purchaseAmount || 0);
            const creditNoteAmount = parseFloat(data.creditNoteAmount || 0);
            const debitNoteAmount = parseFloat(data.debitNoteAmount || 0);
            const openingStockValue = parseFloat(data.openingStockValue || 0);
            const closingStockValue = parseFloat(data.closingStockValue || 0);

            const profitLoss =
                (saleAmount - purchaseAmount) +
                (closingStockValue - openingStockValue) -
                (creditNoteAmount + debitNoteAmount);

            return {
                ...data,
                profitLoss: profitLoss.toFixed(2)
            };
        });


        //Applying sort filter (by default sorting by name)
        switch (sortBy?.toLowerCase()) {
            case 'amount':
                finalResult.sort((a, b) => b.profitLoss - a.profitLoss);
                break;
            case 'name':
                finalResult.sort((a, b) => a.itemName.localeCompare(b.itemName));
                break;
            default:
                finalResult.sort((a, b) => a.itemName.localeCompare(b.itemName));
        }

        // Send response
        res.status(200).json({ status: 'Success', data: finalResult });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

function mergeData(...arrays) {
    const merged = {};

    arrays.forEach(array => {
        array.forEach(item => {
            if (!merged[item._id]) {
                merged[item._id] = {
                    _id: item._id,
                    itemName: item.itemName,
                    saleAmount: 0,
                    purchaseAmount: 0,
                    creditNoteAmount: 0,
                    debitNoteAmount: 0,
                    openingStockValue: 0,
                    closingStockValue: 0,

                };
            }

            // Merge the current item into the result
            merged[item._id] = { ...merged[item._id], ...item };
        });
    });

    return Object.values(merged);
}

