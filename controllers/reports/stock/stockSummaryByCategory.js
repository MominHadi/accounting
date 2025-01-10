const Products = require('../../../models/productModel');
const Purchase = require('../../../models/purchase/purchaseModel');
const Invoices = require('../../../models/invoiceModel');
const mongoose = require('mongoose');

exports.getStockSummaryByCategory = async (req, res) => {
  try {
    // Fetch aggregated stock data
    const data = await Products.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(req.user),
        },
      },
      { $unwind: '$category' },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryName',
        },
      },
      { $unwind: '$categoryName' },
      {
        $addFields: {
          stockValue: {
            $multiply: ['$stock.totalQuantity', '$salePrice'],
          },
        },
      },
      {
        $group: {
          _id: '$category',
          itemName: { $push: '$itemName' },
          category: { $first: '$categoryName.name' },
          totalStockValue: { $sum: '$stockValue' },
          totalStockQty: { $sum: '$stock.totalQuantity' },
        },
      },
    ]);

    // Fetch sales data
    const SalesData = await Invoices.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user) } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: '$itemDetails' },
      { $unwind: '$itemDetails.category' },
      {
        $lookup: {
          from: 'categories',
          localField: 'itemDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: '$categoryDetails' },
      {
        $group: {
          _id: '$categoryDetails._id',
          category: { $first: '$categoryDetails.name' },
          saleQuantity: { $sum: '$items.quantity' },
        },
      },
    ]);

    // Fetch purchase data
    const PurchaseData = await Purchase.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user) } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: '$itemDetails' },
      { $unwind: '$itemDetails.category' },
      {
        $lookup: {
          from: 'categories',
          localField: 'itemDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: '$categoryDetails' },
      {
        $group: {
          _id: '$categoryDetails._id',
          category: { $first: '$categoryDetails.name' },
          purchaseQuantity: { $sum: '$items.quantity' },
        },
      },
    ]);

    const mergedData = data.map((item) => {
      const sale = SalesData.find(
        (saleItem) =>
          saleItem._id.toString() === item._id.toString() &&
          saleItem.category === item.category
      );

      const purchase = PurchaseData.find(
        (purchaseItem) =>
          purchaseItem._id.toString() === item._id.toString() &&
          purchaseItem.category === item.category
      );

      return {
        ...item,
        saleQuantity: sale ? sale.saleQuantity : 0,
        purchaseQuantity: purchase ? purchase.purchaseQuantity : 0,
      };
    });

    res.status(200).json({ status: 'Success', data: mergedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
