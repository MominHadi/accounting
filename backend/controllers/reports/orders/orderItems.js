const SaleOrders = require('../../../models/saleOrderModel');
const PurchaseOrders = require('../../../models/purchase/purchaseOrderModel');
const mongoose = require("mongoose");

exports.getOrderItemReport = async (req, res) => {
    try {
        let { fromDate, toDate, partyName, orderType, orderStatus } = req.query;

        if (!orderType || !['Sale', 'Purchase'].includes(orderType)) {
            return res.status(400).json({ status: 'Failed', message: "Valid Order type is required" });
        }

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "FromDate and toDate are required" });
        }

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        let findConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            orderDate: {
                $gte: startDate,
                $lte: endDate
            }
        };

        if (partyName) {
            findConditions.partyName = partyName;
        };

        if (orderStatus) {
            findConditions.status = orderStatus?.toLowerCase() == 'open' ? 'Order Open' : 'Order Closed';
        };

        let orderDetails;

        if (orderType === 'Sale') {
            orderDetails = await SaleOrders.aggregate([
                { $match: findConditions },
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
                    $lookup: {
                        from: 'taxrates',
                        localField: 'items.taxPercent',
                        foreignField: '_id',
                        as: 'taxPercentage'
                    }
                },
                { $unwind: '$taxPercentage' },
                {
                    $addFields: {
                        price: { $toDouble: "$items.price" },
                        quantity: { $toDouble: "$items.quantity" },
                        discountPercent: { $toDouble: "$items.discountPercent" },
                    }
                },
                {
                    $group: {
                        _id: {
                            itemId: "$items.itemId",
                            itemName: "$itemDetails.itemName"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalAmount: {
                            $sum: {
                                $subtract: [
                                    {
                                        $multiply: [
                                            { $toDouble: "$items.price" },
                                            { $toDouble: "$items.quantity" }
                                        ]
                                    },
                                    {
                                        $multiply: [
                                            { $divide: ["$items.discountPercent", 100] },
                                            {
                                                $multiply: [
                                                    { $toDouble: "$items.price" },
                                                    { $toDouble: "$items.quantity" }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        },
                        taxAmount: {
                            $sum: {
                                $multiply: [
                                    { $divide: ["$taxPercentage.rate", 100] },
                                    {
                                        $subtract: [
                                            {
                                                $multiply: [
                                                    { $toDouble: "$items.price" },
                                                    { $toDouble: "$items.quantity" }
                                                ]
                                            },
                                            {
                                                $multiply: [
                                                    { $divide: ["$items.discountPercent", 100] },
                                                    {
                                                        $multiply: [
                                                            { $toDouble: "$items.price" },
                                                            { $toDouble: "$items.quantity" }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        },

                    }
                },
                {
                    $project: {
                        _id: 0,
                        itemName: "$_id.itemName",
                        totalQuantity: 1,
                        totalAmount: {
                            $round: [
                                { $add: ["$totalAmount", "$taxAmount"] },
                                2
                            ]
                        },

                    }
                },

            ]);
        } else if (orderType === 'Purchase') {
            orderDetails = await PurchaseOrders.find(findConditions)
                .sort({ orderDate: -1 })
                .select('orderName orderDate dueDate totalAmount advanceAmount status balanceAmount partyName');
        }

        return res.status(200).json({ status: 'Success', data: orderDetails });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}
