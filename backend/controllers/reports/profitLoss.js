const Transactions = require("../../models/transactionModel");
const Products = require("../../models/productModel");
const mongoose = require('mongoose');

exports.getProfitAndLossReport = async (req, res) => {
    try {

        const { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        };

        let openingStockValue = 0;
        let closingStockValue = 0;

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $group: {
                    _id: '$transactionType',
                    totalAmount: { $sum: '$totalAmount' }

                }
            }
        ])
        TransactionList = TransactionList.filter(item => ["Sale", "Purchase", "Credit Note", "Debit Note", "Expense"].includes(item._id))

        // if (TransactionList) {
        //     TransactionList = TransactionList.map(transaction => {
        //         return {
        //             ...transaction._doc,
        //             transactionDate: formatDate(transaction.transactionDate)
        //         };
        //     })
        // }


        const ProductData = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user)
                }
            },
            {
                $project: {
                    // _id: 1,
                    'stock.price': 1, // Include stock.price field
                    'stock.openingQuantity': 1,
                    openingStockValue: { $multiply: ['$stock.openingQuantity', '$stock.price'] },
                }
            }
        ]);

        // const ProductClosedData = await Products.aggregate([
        //     {
        //         $project: {
        //             // _id: 1,
        //             'stock.price': 1, // Include stock.price field
        //             'stock.openingQuantity': 1,
        //             'stock.saleQuantity': 1,
        //             remainingQuantity: { $subtract: ['$stock.openingQuantity', '$stock.saleQuantity'] },
        //         }
        //     }
        // ]);

        const ProductClosedData = await Products.find({ createdBy: req.user })
            .select('itemName stock.openingQuantity stock.totalQuantity salePrice');

        // console.log(ProductClosedData, 'Products');

        if (ProductClosedData) {
            ProductClosedData.map(product => {
                let actualValue = product.stock.totalQuantity >= 0 ? product.stock.totalQuantity * product.salePrice : 0;
                closingStockValue += actualValue
            })
        };

        if (ProductData) {

            ProductData.map(product => {
                openingStockValue += +product.openingStockValue
            })
        };

        console.log(openingStockValue, 'Os Value');

        const openingStockDetails = {
            _id: 'Opening Stock Value',
            totalAmount: openingStockValue
        }
        const closingStockDetails = {
            _id: 'Closing Stock Value',
            totalAmount: closingStockValue
        };

        TransactionList.push(openingStockDetails);
        TransactionList.push(closingStockDetails);


        let totalSaleAmount = TransactionList.find(transaction => transaction._id == 'Sale')?.totalAmount || 0;
        let totalPurchaseAmount = TransactionList.find(transaction => transaction._id == 'Purchase')?.totalAmount || 0;
        let totalExpenseAmount = TransactionList.find(transaction => transaction._id == 'Expense')?.totalAmount || 0;

        let grossProfit = (closingStockDetails.totalAmount + totalSaleAmount) - (openingStockDetails.totalAmount + totalPurchaseAmount);
        let netProfit = (closingStockDetails.totalAmount + totalSaleAmount) - (openingStockDetails.totalAmount + totalPurchaseAmount + totalExpenseAmount);


        TransactionList.push({ _id: 'Gross Profit',totalAmount: grossProfit });
        TransactionList.push({ _id: 'Net Profit', totalAmount: parseFloat(netProfit.toFixed(2)) });

        console.log(grossProfit, 'grossProfit');
        res.status(200).json({ status: 'Success', TransactionList });

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }


}