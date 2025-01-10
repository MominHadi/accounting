const Invoices = require('../../../models/invoiceModel');
const Purchase = require('../../../models/purchase/purchaseModel');
const Products = require('../../../models/productModel');
const ItemsAdjustments = require('../../../models/itemAdjustments');
const mongoose = require('mongoose');
const { eachDayOfInterval, format } = require('date-fns');

exports.generateItemDetailsReport = async (req, res) => {

    try {
        const { fromDate, toDate, itemName } = req.query;

        let itemId;
        if (!fromDate || !toDate || !itemName) {
            return res.status(400).json({ status: 'Failed', message: "All Fields  v Required." });
        }

        // Converting to date objects
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        let itemDetails = await Products.findOne({
            itemName: { $regex: new RegExp("^" + itemName + "$", "i") },
            createdBy: req.user
        });

        if (!itemDetails) {
            return res.status(404).json({ status: "Failed", message: "Item not Found" })
        };

        itemId = itemDetails._id;

        let SalesData = await Invoices.aggregate([
            {
                $match: { 
                    invoiceDate: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    "items.itemId": new mongoose.Types.ObjectId(itemId)
                },

            },
            {
                $unwind: '$items'
            },
            {
                $match: { 'items.itemId': new mongoose.Types.ObjectId(itemId) }
            },
            {
                $group: {
                    _id: {
                        invoiceDate: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } }
                    },
                    saleQuantity: {
                        $sum: '$items.quantity'
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id.invoiceDate',
                    saleQuantity: 1
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
                    "items.itemId": new mongoose.Types.ObjectId(itemId)
                }
            },
            {
                $unwind: '$items'
            },
            {
                $match: { 'items.itemId': new mongoose.Types.ObjectId(itemId) }
            },
            {
                $group: {
                    _id: {
                        billDate: { $dateToString: { format: "%Y-%m-%d", date: "$billDate" } }
                    },
                    purchaseQuantity: {
                        $sum: '$items.quantity'
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id.billDate',
                    purchaseQuantity: 1
                }
            }
        ]);

        let ItemsAdjustmentsData = await ItemsAdjustments.aggregate([
            {
                $match: {
                    // adjustmentDate: {
                    //     $gte: startDate,
                    //     $lte: endDate
                    // },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    itemId: new mongoose.Types.ObjectId(itemId)
                }
            },
            {
                $group: {
                    _id: {
                        adjustmentDate: { $dateToString: { format: "%Y-%m-%d", date: "$adjustmentDate" } }
                    },
                    adjustedQuantity: {
                        $sum: {
                            $cond: {
                                if: { $eq: ["$action", "reduce"] },
                                then: { $multiply: ["$totalQty", -1] },
                                else: "$totalQty"
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id.adjustmentDate',
                    adjustedQuantity: 1
                }
            }
        ])

        let OpeningQuantityDetails = await Products.findOne({
            createdBy: req.user,
            _id: itemId
        }).select('stock itemName createdAt');

        const updatedDetails = adjustOpeningQuantity(ItemsAdjustmentsData, OpeningQuantityDetails);
        let updatedQuantity = updatedDetails.stock.openingQuantity;

        // Update ItemsAdjustmentsData
        ItemsAdjustmentsData = syncAdjustedQuantityWithStock(OpeningQuantityDetails, ItemsAdjustmentsData);


        const mergedData = eachDayOfInterval({ start: new Date(fromDate), end: new Date(toDate) }).map(date => {
            const formattedDate = format(date, 'yyyy-MM-dd');

            const saleItem = SalesData.find(s => s.date === formattedDate) || { saleQuantity: 0 };
            const purchaseItem = PurchaseData.find(p => p.date === formattedDate) || { purchaseQuantity: 0 };
            const adjustmentItem = ItemsAdjustmentsData.find(a => a.date === formattedDate) || { adjustedQuantity: 0 };

            return {
                date: formattedDate,
                saleQuantity: saleItem.saleQuantity,
                purchaseQuantity: purchaseItem.purchaseQuantity,
                adjustmentQuantity: adjustmentItem.adjustedQuantity
            };
        });

        const finalData = mergedData.map(item => {


            const closingQuantity = item.purchaseQuantity - item.saleQuantity + item.adjustmentQuantity;

            const result = {
                ...item,
                closingQuantity: closingQuantity
            };

            //    openingQuantity = closingQuantity;

            return result;
        });

        res.status(200).json({ status: 'Item Details Fetched Successfully', data: finalData })

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

// Function to update openingQuantity based on item adjustments
function adjustOpeningQuantity(itemsAdjustmentsData, openingQtyDetails) {
    itemsAdjustmentsData.forEach(adjustment => {
        const adjustmentDate = new Date(adjustment.date);
        const lastUpdatedDate = openingQtyDetails.createdAt;

        if (adjustmentDate.toISOString().slice(0, 10) === lastUpdatedDate.toISOString().slice(0, 10)) {

            if (adjustment.adjustedQuantity < 0) {
                // Subtract if negative
                openingQtyDetails.stock.openingQuantity += adjustment.adjustedQuantity;
            } else {
                // Add if non-negative
                openingQtyDetails.stock.openingQuantity += adjustment.adjustedQuantity;
            }
        }
    });
    return openingQtyDetails;
}


function syncAdjustedQuantityWithStock(openingQtyDetails, ItemsAdjustmentsData) {
    const lastUpdatedDate = new Date(openingQtyDetails.createdAt).toISOString().split('T')[0];

    ItemsAdjustmentsData.forEach(item => {
        if (item.date === lastUpdatedDate) {
            item.adjustedQuantity = openingQtyDetails.stock.totalQuantity;
        }
    });

    return ItemsAdjustmentsData;
}

