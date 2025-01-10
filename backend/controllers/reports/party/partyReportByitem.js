const mongoose = require('mongoose');
const Sales = require('../../../models/invoiceModel');
const Purchase = require('../../../models/purchase/purchaseModel');

exports.getPartyByItemReport = async (req, res) => {
    try {
        const { fromDate, toDate, category, sortBy } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        }

        // Convert category to ObjectId if provided
        const categoryFilter = category ? new mongoose.Types.ObjectId(category) : null;

        const salesData = await Sales.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    invoiceDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.itemId",
                    foreignField: "_id",
                    as: "itemDetails"
                }
            },
            { $unwind: "$itemDetails" },
            ...(categoryFilter
                ? [{ $match: { "$itemDetails.category": categoryFilter } }]
                : []),
            {
                $group: {
                    _id: '$partyName',
                    saleQty: { $sum: '$items.quantity' },
                    saleAmount: { $sum: '$receivedAmount' }
                }
            }
        ]);

        const purchaseData = await Purchase.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    purchaseDate: { $gte: new Date(fromDate), $lte: new Date(toDate) }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.itemId",
                    foreignField: "_id",
                    as: "itemDetails"
                }
            },
            { $unwind: "$itemDetails" },
            ...(categoryFilter
                ? [{ $match: { "$itemDetails.category": categoryFilter } }]
                : []),
            {
                $group: {
                    _id: '$partyName',
                    purchaseQty: { $sum: '$items.quantity' },
                    purchaseAmount: { $sum: '$paidAmount' }
                }
            }
        ]);

        // Combine and format the results
        const result = [...salesData, ...purchaseData].reduce((acc, item) => {
            const found = acc.find(obj => obj._id === item._id);

            if (found) {
                found.saleQty = item.saleQty || found.saleQty || 0;
                found.purchaseQty = item.purchaseQty || found.purchaseQty || 0;
                found.purchaseAmount = item.purchaseAmount || found.purchaseAmount || 0;
                found.saleAmount = item.saleAmount || found.saleAmount || 0;
            } else {
                acc.push({
                    _id: item._id,
                    saleQty: item.saleQty || 0,
                    purchaseQty: item.purchaseQty || 0,
                    purchaseAmount: item.purchaseAmount || 0,
                    saleAmount: item.saleAmount || 0
                });
            }

            return acc;
        }, []);

        const updatedResult = result.map(obj => ({
            partyName: obj._id,
            saleQty: obj.saleQty,
            purchaseQty: obj.purchaseQty,
            purchaseAmount: obj.purchaseAmount,
            saleAmount: obj.saleAmount
        }));

        //Applying sort filter by default sorting by name
        switch (sortBy?.toLowerCase()) {
            case 'purchase quantity':
                updatedResult.sort((a, b) => b.purchaseQty - a.purchaseQty);
                break
            case 'sale quantity':
                updatedResult.sort((a, b) => b.saleQty - a.saleQty);
                break
            case 'party name':
                updatedResult.sort((a, b) => a.partyName.localeCompare(b.partyName));
                break
            default:
                updatedResult.sort((a, b) => a.partyName.localeCompare(b.partyName));
        };

        res.status(200).json({ status: 'Success', data: updatedResult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};
