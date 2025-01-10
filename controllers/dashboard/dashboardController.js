const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Products = require("../../models/productModel");
const SaleOrders = require("../../models/saleOrderModel");
const Quotations = require("../../models/quotationModel");
const Banks = require("../../models/bankModel");
const ChequeTransfer = require("../../models/chequeTransferModel");
const CashAdjustments = require("../../models/adjustCashModel");
const mongoose = require("mongoose");

exports.getDashboardData = async (req, res) => {
    try {
        const today = new Date();

        // First day of the first month in the 3-month range
        const firstDayOfFirstMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 2, 1));

        // Last day of the current month
        const lastDayOfCurrentMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));

        console.log(firstDayOfFirstMonth.toISOString(), lastDayOfCurrentMonth.toISOString(), 'Corrected Output');

        // Fetch the transactions for the current 3-month period
        let TransactionsData = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionDate: {
                        $gte: firstDayOfFirstMonth,
                        $lte: lastDayOfCurrentMonth
                    },
                    transactionType: {
                        $in: ['Payment-In', 'Payment-Out', 'Purchase', 'Sale', 'Credit Note', 'Debit Note']
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPurchasBalance: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Purchase"] },
                                "$balance", 0
                            ]
                        }
                    },
                    totalSaleBalance: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Sale"] },
                                "$balance", 0
                            ]
                        }
                    },
                    totalCreditNoteBalance: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Credit Note"] },
                                "$balance", 0
                            ]
                        }
                    },
                    totalDebitNoteBalance: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Debit Note"] },
                                "$balance", 0
                            ]
                        }
                    },
                    totalPaymentIn: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Payment-In"] },
                                "$totalAmount", 0
                            ]
                        }
                    },
                    totalPaymentOut: {
                        $sum: {
                            $cond: [
                                { $eq: ["$transactionType", "Payment-Out"] },
                                "$totalAmount", 0
                            ]
                        }
                    }
                }
            }
        ]);

        console.log(TransactionsData, 'Transactions Data');

        // Fetch the opening balance of the party (toReceive and toPay)
        let partyData = await Parties.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'openingBalanceDetails.openingBalance': {
                        $gt: 0
                    }
                }
            }
        ]);

        let totalOpeningBalanceToReceive = 0;
        let totalOpeningBalanceToPay = 0;

        // Loop through the party data and calculate the opening balances
        partyData.forEach(party => {
            console.log(party.openingBalanceDetails?.openingBalance, 'Opening');
            if (party.openingBalanceDetails?.balanceType === "toReceive") {
                totalOpeningBalanceToReceive += party.openingBalanceDetails?.openingBalance;
            } else if (party.openingBalanceDetails?.balanceType === "toPay") {
                totalOpeningBalanceToPay += party.openingBalanceDetails?.openingBalance;
            }
        });

        console.log("Total Opening Balance to Receive: ", totalOpeningBalanceToReceive);
        console.log("Total Opening Balance to Pay: ", totalOpeningBalanceToPay);

        // Calculate the final "You’ll Get" and "You’ll Pay":
        let SaleBalanceDue = TransactionsData[0]?.totalSaleBalance || 0
        let PurchaseBalanceDue = TransactionsData[0]?.totalPurchasBalance || 0
        const totalSaleAndCreditNote = (TransactionsData[0]?.totalSaleBalance || 0) - (TransactionsData[0]?.totalCreditNoteBalance || 0);
        const totalPurchaseAndDebitNote = (TransactionsData[0]?.totalPurchasBalance || 0) - (TransactionsData[0]?.totalDebitNoteBalance || 0);


        console.log(TransactionsData[0]?.totalPurchasBalance, TransactionsData[0]?.totalDebitNoteBalance || 0, 'TransactionsData[0]?.totalDebitNoteBalance || 0')
        // Adding the opening balance amounts to the "You’ll Get" and "You’ll Pay"
        const youllGet = totalSaleAndCreditNote + totalOpeningBalanceToReceive - (TransactionsData[0]?.totalPaymentIn || 0);
        const youllPay = totalPurchaseAndDebitNote + totalOpeningBalanceToPay - (TransactionsData[0]?.totalPaymentOut || 0);

        console.log("You’ll Get: ", youllGet);
        console.log("You’ll Pay: ", youllPay);


        const StockValues = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),

                }
            },

            {
                $addFields: {
                    StockValue: {
                        $cond: [
                            { $gte: ["$stock.totalQuantity", 0] },
                            { $multiply: ["$salePrice", "$stock.totalQuantity"] },
                            0
                        ]
                    }
                }
            }
            , {
                $group: {
                    _id: null,
                    totalStockValue: { $sum: '$StockValue' }

                }
            }, {
                $project: {
                    _id: 0,
                    totalStockValue: 1

                }
            }
        ]);


        let ProductCount = await Products.find({ createdBy: req.user }).countDocuments();

        let LowStockItems = await Products.find({
            createdBy: req.user,
            'stock.totalQuantity': {
                $lte: 0
            }
        }).select('-creatdAt -__v');

        let inventory = {
            stockValue: StockValues[0]?.totalStockValue,
            noOfItems: ProductCount,
            lowStockItems: LowStockItems.length
        };

        let openSaleOrders = await SaleOrders.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    isConverted: false
                }
            }, {
                $group: {
                    _id: null,

                    totalAmount: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }, {
                $project: {
                    _id: 0
                }
            }

        ]);

        let openSaleTransactions = {};

        openSaleTransactions.saleOrders = openSaleOrders[0];


        let openQuotations = await Quotations.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    isConverted: false
                }
            }, {
                $group: {
                    _id: null,

                    totalAmount: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }, {
                $project: {
                    _id: 0
                }
            }

        ]);

        openSaleTransactions.quotations = openQuotations[0];
        let bankBalance = await fetchBankBalance(req);
        let purchaseAmount = await getPurchaseForthisMonth(req);
        let expenseAmount = await getExpenseForthisMonth(req);

        let profitLossData = await calculateTotalProfitLoss(firstDayOfFirstMonth, lastDayOfCurrentMonth, req.user);
        let totalCashInHand = await fetchTotalCashInHand(req.user);

        // Respond with the final data
        res.status(200).json({
            status: "Success",
            data: {
                saleBalanceDue: parseFloat(SaleBalanceDue).toFixed(2),
                purchaseBalanceDue: parseFloat(PurchaseBalanceDue).toFixed(2),
                youllGet: parseFloat(youllGet).toFixed(2),
                youllPay: parseFloat(youllPay).toFixed(2),
                inventory,
                totalBankBalance: parseFloat(bankBalance.toFixed(2)),
                totalPurchaseAmount: parseFloat(purchaseAmount.toFixed(2)),
                totalExpenseAMount: parseFloat(expenseAmount.toFixed(2)),
                openSaleTransactions,
                netProfit: parseFloat(profitLossData.netProfit.toFixed(2)),
                netLoss: parseFloat(profitLossData.netLoss.toFixed(2)),
                totalCashInHand:parseFloat(totalCashInHand.toFixed(2))
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching data. Please try again", error: error.message || error });
    }
};

const fetchBankBalance = async (req) => {
    try {

        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionType: { $in: ['Sale', 'Purchase', 'Debit Note', 'Credit Note', 'Payment-In', 'Payment-Out'] }
                }
            },
            {
                $unwind: '$paymentMethod'
            }, {
                $match: { 'paymentMethod.method': 'Bank' }
            }
            , {
                $project: {
                    _id: 0,
                    amount: { $sum: '$paymentMethod.amount' },
                    transactionDate: 1,
                    transactionType: 1
                }
            }
        ]);

        const chequeTransferList = await ChequeTransfer.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    accountName: "Bank",
                }
            },
            {
                $project: {
                    _id: 0,
                    transactionType: 1,
                    createdAt: 1,
                    amount: 1,
                }
            }
        ]);

        chequeTransferList.map((item) => {
            TransactionList.push({
                transactionType: `Cheque ${item.transactionType}`,
                transactionDate: item.createdAt,
                amount: item.amount
            });
        });

        let bankDetails = await Banks.find({ createdBy: req.user }).select('bankName openingBalance');

        let totalAmount = 0;

        TransactionList.map(transaction => {

            // console.log(parseFloat(transaction.amount), 'parseFloat(transaction.amount);')

            if (['Sale', 'Debit Note', 'Payment-In', 'Cheque deposit', 'Opening Balance'].includes(transaction.transactionType))
                totalAmount += parseFloat(transaction.amount);
            else totalAmount -= parseFloat(transaction.amount);
        });

        // console.log(TransactionList.length, chequeTransferList.length, 'chequeTransferList')

        // console.log(TransactionList.length, 'TransactionList.length in  Bank ')

        //Adding or subtracting Bank opening Balance 
        bankDetails.map(bank => {

            totalAmount += bank?.openingBalance;
        });

        return totalAmount;
    } catch (error) {
        console.log(error, 'Error in Fetching Bank Balance')
    }
}


const getPurchaseForthisMonth = async (req) => {
    try {
        var date = new Date(), y = date.getFullYear(), m = date.getMonth();
        // var firstDay = new Date(y, m + 1, 0);
        // var lastDay = new Date(y, m + 1, 0);

        const today = new Date();

        // First day of the current month
        const firstDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));

        // Last day of the current month
        const lastDay = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));

        let searchConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            transactionDate: {
                $gte: firstDay,
                $lte: lastDay,
            },
            transactionType: 'Purchase'
        };


        let purchaseTransactionList = await Transactions.aggregate([
            {
                $match: searchConditions,
            },
            {
                $group: {
                    _id: null,
                    totalPurchaseAmount: { $sum: '$totalAmount' }
                }
            },
            {
                $project: {
                    totalPurchaseAmount: 1
                }
            }
        ]);


        return purchaseTransactionList.length > 0 ? purchaseTransactionList[0].totalPurchaseAmount : 0;

    } catch (error) {
        console.log(error);

    }
};


const getExpenseForthisMonth = async (req) => {
    try {
        const today = new Date();

        // First day of the current month
        const firstDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));

        // Last day of the current month
        const lastDay = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0));

        let searchConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            // transactionDate: {
            //     $gte: firstDay,
            //     $lte: lastDay,
            // },
            transactionType: 'Expense'
        };

        let expenseTransactionList = await Transactions.aggregate([
            {
                $match: searchConditions,
            },
            {
                $group: {
                    _id: null,
                    totalExpenseAmount: { $sum: '$totalAmount' }
                }
            },
            {
                $project: {
                    totalExpenseAmount: 1
                }
            }
        ]);
        console.log(expenseTransactionList, 'expenseTransactionList');
        return expenseTransactionList.length > 0 ? expenseTransactionList[0]?.totalExpenseAmount : 0;

    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });

    }
};


const calculateTotalProfitLoss = async (fromDate, toDate, userId) => {
    try {


        // if (!fromDate || !toDate) {
        //     return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        // };

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
                    createdBy: new mongoose.Types.ObjectId(userId),
                }
            },
            {
                $group: {
                    _id: '$transactionType',
                    totalAmount: { $sum: '$totalAmount' }

                }
            }
        ]);
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
                    createdBy: new mongoose.Types.ObjectId(userId)
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

        const ProductClosedData = await Products.find({ createdBy: userId })
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
        // let netProfit = (closingStockDetails.totalAmount + totalSaleAmount) - (openingStockDetails.totalAmount + totalPurchaseAmount + totalExpenseAmount);


        // TransactionList.push({ _id: 'Gross Profit', totalAmount: grossProfit });
        // TransactionList.push({ _id: 'Net Profit', totalAmount: parseFloat(netProfit.toFixed(2)) });
        let result = (closingStockDetails.totalAmount + totalSaleAmount)
            - (openingStockDetails.totalAmount + totalPurchaseAmount + totalExpenseAmount);

        let netProfit = result > 0 ? result : 0; // Net profit if result is positive
        let netLoss = result < 0 ? Math.abs(result) : 0; // Net loss if result is negative

        return {
            grossProfit, netProfit, netLoss
        };
        // console.log(grossProfit, 'grossProfit');
        // res.status(200).json({ status: 'Success', TransactionList });

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    };
};


const fetchTotalCashInHand = async (userId) => {
    try {
        // Fetch transactions with specific transaction types and cash payment methods
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    transactionType: {
                        $in: ['Sale', 'Purchase', 'Credit Note', 'Debit Note', 'Payment-In', 'Payment-Out']
                    },
                    "paymentMethod.method": "Cash"
                }
            },
            {
                $unwind: "$paymentMethod"
            },
            {
                $match: {
                    "paymentMethod.method": "Cash"
                }
            },
            {
                $lookup: {
                    from: 'parties',
                    localField: 'party',
                    foreignField: '_id',
                    as: 'partyDetails'
                }
            },
            {
                $unwind: {
                    path: "$partyDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    partyName: '$partyDetails.name',
                    transactionDate: 1,
                    referenceNo: '$reference.documentNumber',
                    type: '$transactionType',
                    credit_Amount: {
                        $cond: {
                            if: {
                                $in: ["$transactionType", ['Sale', 'Debit Note', 'Payment-In']]
                            },
                            then: "$paymentMethod.amount",
                            else: 0
                        }
                    },
                    debit_Amount: {
                        $cond: {
                            if: {
                                $in: ["$transactionType", ['Purchase', 'Credit Note', 'Payment-Out']]
                            },
                            then: "$paymentMethod.amount",
                            else: 0
                        }
                    }
                }
            }
        ]);

        // Fetch Cash Adjustments
        let CashAdjustmentList = await CashAdjustments.find({ createdBy:userId });

        // Map adjustments to transaction list format and push them into the transaction list
        CashAdjustmentList.forEach((adjustment) => {
            const { adjustmentDate, adjustmentType, amount } = adjustment;
            TransactionList.push({
                partyName: `Cash Adjustment`,
                transactionDate: adjustmentDate,
                referenceNo: '',
                type: `Cash ${adjustmentType}`,
                credit_Amount: adjustmentType === 'Add' ? amount : 0,
                debit_Amount: adjustmentType === 'Reduce' ? amount : 0
            });
        });

        const ChequeTransfers = await ChequeTransfer.find({
            createdBy: userId,
            accountName: "Cash"
        }).populate('cheque', 'partyName -_id');


        ChequeTransfers.forEach((transfer) => {
            const { transferDate, adjustmentType, amount, cheque, referenceNo, transactionType } = transfer;
            TransactionList.push({
                partyName: cheque?.partyName,
                transactionDate: transferDate,
                referenceNo: referenceNo || 'N/A',
                type: `Cash ${transactionType}`,
                credit_Amount: transactionType === 'deposit' ? amount : 0,
                debit_Amount: adjustmentType === 'withdraw' ? amount : 0
            });
        });

        // Sort transactions by date (descending order)
        const sortedTransactionList = TransactionList.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

        // Calculate running cash balance
        let cashBalance = 0;
        sortedTransactionList.forEach(transaction => {
            cashBalance += transaction.credit_Amount;
            cashBalance -= transaction.debit_Amount;

            transaction.cashBalance = cashBalance;
        });

        // Send the response
        return cashBalance;
    } catch (error) {
        return error;
    }
};
