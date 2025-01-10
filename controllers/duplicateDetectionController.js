const SaleOrders = require("../models/saleOrderModel");
const PurchaseOrders = require("../models/purchase/purchaseOrderModel");
const Purchase = require("../models/purchase/purchaseModel");
const mongoose = require('mongoose');

async function findDuplicates(collection, uniqueKeys, userId) {
    const pipeline = [
        {
            $match: {
                createdBy: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: uniqueKeys.reduce((acc, key) => ({ ...acc, [key]: `$${key}` }), {}),
                count: { $sum: 1 },
                documents: { $push: "$$ROOT" }
            }
        },
        { $match: { count: { $gt: 1 } } } // Filter for duplicates
    ];
    const duplicates = await collection.aggregate(pipeline);
    return duplicates;
};

exports.detectDuplicateEntries = async (req, res) => {
    try {

        const salesOrderUniqueKeys = ["orderNo", "orderDate", "partyName"];
        const purchaseOrderUniqueKeys = ["orderNo", "orderDate", "partyName"];
        const purchaseUniqueKeys = ["billNo", "billDate", "partyName"];

        const salesOrderDuplicates = await findDuplicates(SaleOrders, salesOrderUniqueKeys, req.user);
        const purchaseOrderDuplicates = await findDuplicates(PurchaseOrders, purchaseOrderUniqueKeys, req.user);
        const purchaseDuplicates = await findDuplicates(Purchase, purchaseUniqueKeys, req.user);

        res.json({ salesOrderDuplicates , purchaseOrderDuplicates, purchaseDuplicates });
 
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}
