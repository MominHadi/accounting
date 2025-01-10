const Products = require('../../../models/productModel');
const Category = require('../../../models/categoryModel');
const Sales = require('../../../models/invoiceModel');
const Purchase = require('../../../models/purchase/purchaseModel');
const mongoose = require('mongoose');

exports.getStockDetails = async (req, res) => {
    try {

        const { fromDate, toDate, category, status } = req.query;
        let categoryId;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: 'fromDate and  toDate are required' });
        };

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);


        let totalBeginningQty = 0;
        let totalQuantityIn = 0;
        let totalQuantityOut = 0;
        // let totalBeginning=0;

        let searchConditions = {
            createdBy: req.user,
            createdAt: {
                $gte: startDate,
                $lte: endDate
            },
        };

        if (category && category.toUpperCase() !== 'ALL') {

            if (category.toUpperCase() === 'UNCATEGORIZED') {
                searchConditions.category = []
            } else {
                let CategoryDetails = await Category.findOne({ name: category, createdBy: req.user });

                if (!CategoryDetails) {
                    return res.status(404).json({ status: "Failed", message: 'Category Not Found' })
                };

                categoryId = CategoryDetails._id;
                searchConditions.category = {
                    $in: categoryId
                };
            };
        };

        if (status && status.toUpperCase() !== 'ALL') {
            searchConditions.isActive = status.toUpperCase() === 'ACTIVE' ? true : false;
        };

        let stockDetails = await Products.find(searchConditions).select('itemName  stock');


        const updatedStockDetails = stockDetails.map(obj => ({
            itemName: obj.itemName,
            beginningQuantity: parseFloat(obj.stock.totalQuantity),
            quantityIn: parseFloat(obj.stock.saleQuantity) + parseFloat(obj.stock.totalQuantity),
            quantityOut: parseFloat(obj.stock.saleQuantity),
            closingQuantity: (parseFloat(obj.stock.totalQuantity) + parseFloat(obj.stock.saleQuantity)) - parseFloat(obj.stock.saleQuantity),
        }));

        stockDetails.map((obj) => {
            totalBeginningQty += parseFloat(obj.stock.totalQuantity)
            totalQuantityIn += parseFloat(obj.stock.purchaseQuantity)
            totalQuantityOut += parseFloat(obj.stock.saleQuantity)
        });

        let salesData = await Sales.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    invoiceDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
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
            {
                $unwind: '$itemDetails'
            },
            // Filter products where category array contains the categoryId
            ...(categoryId ? [{
                $match: {
                    'itemDetails.category': { $in: [categoryId] }
                }
            }] : []),

            // Filter products where status 
            ...(searchConditions?.isActive ? [{
                $match: {
                    'itemDetails.isActive': searchConditions?.isActive
                }
            }] : []),
            {
                $unwind: '$items'
            },
            {

                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    salesAmount: {
                        $sum: '$totalAmount'
                    }
                }
            }
        ]);


        let purchaseData = await Purchase.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    billDate: {
                        $gte: startDate,
                        $lte: endDate
                    },

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
            {
                $unwind: '$itemDetails'
            },
            ...(categoryId ? [{
                $match: {
                    'itemDetails.category': { $in: [categoryId] }
                }
            }] : []),
            ...(searchConditions?.isActive ? [{
                $match: {
                    'itemDetails.isActive': searchConditions?.isActive
                }
            }] : []),
            {
                $unwind: '$items'
            },
            {

                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' },
                    purhaseAmount: {
                        $sum: '$totalAmount'
                    }
                }
            }
        ]);


        let mergedStockDetails = mergeStockDetails(updatedStockDetails, salesData, purchaseData);
        // let totalClosingQuantity = (totalBeginningQty + totalQuantityIn) - totalQuantityOut;

        res.status(200).json({ status: 'Success', data: mergedStockDetails, totalQuantityIn, totalQuantityOut, totalBeginningQty });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}


function mergeStockDetails(updatedStock, salesData, purchaseData) {


    updatedStock = updatedStock.map(item => ({
        ...item,
        saleAmount: 0,
        purchaseAmount: 0
    }));

    salesData.forEach(sale => {
        const stockItem = updatedStock.find(item => item.itemName === sale.itemName);
        if (stockItem) {
            stockItem.saleAmount = sale.salesAmount;
        }
    });


    purchaseData.forEach(purchase => {
        const stockItem = updatedStock.find(item => item.itemName === purchase.itemName);
        if (stockItem) {
            stockItem.purchaseAmount = purchase.purhaseAmount;
        }
    });

    return updatedStock;
} 