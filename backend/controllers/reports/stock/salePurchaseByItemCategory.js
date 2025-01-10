const Categories = require('../../../models/categoryModel');
const Purchase = require('../../../models/purchase/purchaseModel');
const Invoices = require('../../../models/invoiceModel');
const mongoose = require('mongoose');

exports.getSalePurchaseReportByItemCategory = async (req, res) => {
    try {

        const { fromDate, toDate, partyName, sortBy } = req.query;

        if (!fromDate || !toDate) {

            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });

        }

        // Convert to date objects
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        let searchConditions;

        if (partyName) {
            searchConditions = {
                invoiceDate: {
                    $gte: startDate,
                    $lte: endDate
                },
                createdBy: new mongoose.Types.ObjectId(req.user),
                partyName: partyName
            }
        } else {
            searchConditions = {
                invoiceDate: {
                    $gte: startDate,
                    $lte: endDate
                },
                createdBy: new mongoose.Types.ObjectId(req.user),
            }
        };


        const SalesData = await Invoices.aggregate([
            {
                $match: searchConditions
            }, {
                $unwind: '$items'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            {
                $unwind: '$itemDetails'
            },
            {
                $unwind: '$itemDetails.category'
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'itemDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            {
                $unwind: '$categoryDetails'
            },
            {
                $group: {
                    _id: '$categoryDetails._id',
                    category: { $first: '$categoryDetails.name' },
                    saleAmount: { $sum: '$items.finalAmount' },
                    saleQuantity: { $sum: '$items.quantity' },
                }
            }
        ]);

        const PurchaseData = await Purchase.aggregate([
            {
                $match: searchConditions
            },
            {
                $unwind: '$items'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            {
                $unwind: '$itemDetails'
            },
            {
                $unwind: '$itemDetails.category'
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'itemDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            {
                $unwind: '$categoryDetails'
            },
            {
                $group: {
                    _id: '$categoryDetails._id',
                    category: { $first: '$categoryDetails.name' },
                    purchaseAmount: { $sum: '$items.finalAmount' },
                    purchaseQuantity: { $sum: '$items.quantity' }
                }
            }
        ]);

        let result = mergeData(SalesData, PurchaseData);


        //Applying sort filter by default sorting by name
        switch (sortBy?.toLowerCase()) {
            case 'purchase quantity':
                result.sort((a, b) => b.purchaseQuantity - a.purchaseQuantity);
                break
            case 'sale quantity':
                result.sort((a, b) => b.saleQuantity - a.saleQuantity);
                break
            case 'name':
                result.sort((a, b) => a.category.localeCompare(b.category));
                break
            default:
                result.sort((a, b) => a.category.localeCompare(b.category));
        }

        res.status(200).json({ status: 'Success', data: result });

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
                    category: item.category,
                    saleAmount: 0,
                    purchaseAmount: 0,
                    purchaseQuantity: 0,
                    saleQuantity: 0,
                };
            };

            merged[item._id] = { ...merged[item._id], ...item };
        });
    });

    return Object.values(merged);
}
