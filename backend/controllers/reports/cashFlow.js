const mongoose = require('mongoose');
const Transactions = require("../../models/transactionModel");
const CashAdjustments = require("../../models/adjustCashModel");
const ChequeTransfer = require("../../models/chequeTransferModel");
const formatDate = require('../../global/formatDate');

exports.getCashFlowReport = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        };

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);




        // Transactions aggregations
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: { $gte: startDate, $lte: endDate },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionType: { $in: ['Sale', 'Purchase', 'Credit Note', 'Debit Note', 'Payment-In', 'Payment-Out'] }
                }
            },
            { $unwind: "$paymentMethod" }, // Unwind paymentMethod array
            {
                $match: {
                    "paymentMethod.method": "Cash" // Filter only Cash payments
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
            { $unwind: "$partyDetails" },
            {
                $project: {
                    partyName: '$partyDetails.name',
                    transactionDate: 1,
                    referenceNo: '$reference.documentNumber',
                    type: '$transactionType',
                    credit_Amount: {
                        $cond: [
                            { $or: [{ $eq: ["$transactionType", "Sale"] }, { $eq: ["$transactionType", "Payment-In"] }, { $eq: ["$transactionType", "Debit Note"] }] },
                            "$paymentMethod.amount",
                            0
                        ]
                    },
                    debit_Amount: {
                        $cond: [
                            {
                                $or: [{ $eq: ["$transactionType", "Purchase"] }, { $eq: ["$transactionType", "Payment-Out"] },
                                { $eq: ["$transactionType", "Credit Note"] }]
                            },
                            "$paymentMethod.amount",
                            0
                        ]
                    }
                }
            }
        ]);

        // Cash Adjustments
        let CashAdjustmentList = await CashAdjustments.find({
            createdBy: req.user,
            adjustmentDate: { $gte: startDate, $lte: endDate }
        });

        CashAdjustmentList.forEach((obj) => {
            let { adjustmentDate, adjustmentType, amount } = obj;

            TransactionList.push({
                partyName: `Cash adjustment`,
                transactionDate: adjustmentDate,
                referenceNo: '',
                type: `Cash ${adjustmentType}`,
                credit_Amount: adjustmentType === 'Add' ? amount : 0,
                debit_Amount: adjustmentType === 'Reduce' ? amount : 0,
            });
        });

        // Calculate running cash balance
        let runningCashInHand = 0;

        TransactionList = TransactionList.map(transaction => {
            runningCashInHand += (transaction.credit_Amount || 0) - (transaction.debit_Amount || 0);

            return {
                ...transaction,
                runningCashInHand
            };
        });

        res.status(200).json({ status: 'Success', data: TransactionList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


exports.getCashFlowReportForMobile = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        }

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        let TransactionList = []

        let openingCash = await fetchOpeningCash(startDate, req.user);

        console.log(openingCash, 'Opening Cash');

        // Transactions aggregations
        let MoneyInTransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: { $gte: startDate, $lte: endDate },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionType: { $in: ['Sale', 'Debit Note', 'Payment-In', 'Sale Order'] }
                }
            },
            { $unwind: "$paymentMethod" }, // Unwind paymentMethod array
            {
                $match: {
                    "paymentMethod.method": "Cash" // Filter only Cash payments
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
            { $unwind: "$partyDetails" },
            {
                $project: {
                    partyName: '$partyDetails.name',
                    transactionDate: 1,
                    referenceNo: '$reference.documentNumber',
                    type: '$transactionType',
                    credit_Amount: {
                        $cond: [
                            {
                                $or: [{ $eq: ["$transactionType", "Sale"] }, { $eq: ["$transactionType", "Payment-In"] },
                                { $eq: ["$transactionType", "Debit Note"] }]
                            },
                            "$paymentMethod.amount",
                            0
                        ]
                    },

                }
            }
        ]);


        let MoneyOutTransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: { $gte: startDate, $lte: endDate },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionType: { $in: ['Purchase', 'Credit Note', 'Payment-Out', 'Purchase Order'] }
                }
            },
            { $unwind: "$paymentMethod" }, // Unwind paymentMethod array
            {
                $match: {
                    "paymentMethod.method": "Cash" // Filter only Cash payments
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
            { $unwind: "$partyDetails" },
            {
                $project: {
                    partyName: '$partyDetails.name',
                    transactionDate: 1,
                    referenceNo: '$reference.documentNumber',
                    type: '$transactionType',
                    debit_Amount: {
                        $cond: [
                            {
                                $or: [{ $eq: ["$transactionType", "Purchase"] }, { $eq: ["$transactionType", "Payment-Out"] },
                                { $eq: ["$transactionType", "Credit Note"] }]
                            },
                            "$paymentMethod.amount",
                            0
                        ]
                    }
                }
            }
        ]);

        // Cash Adjustments
        let CashAdjustmentList = await CashAdjustments.find({
            createdBy: req.user,
            adjustmentDate: { $gte: startDate, $lte: endDate }
        });


        let totalMoneyIn = 0;
        let totalMoneyOut = 0;
        CashAdjustmentList.forEach((obj) => {
            let { adjustmentDate, adjustmentType, amount } = obj;

            if (adjustmentType === "Add") {
                MoneyInTransactionList.push({
                    partyName: `Cash adjustment`,
                    transactionDate: adjustmentDate,
                    referenceNo: '',
                    type: `Cash ${adjustmentType}`,
                    credit_Amount: adjustmentType === 'Add' ? amount : 0,
                });
            } else if (adjustmentType === "Reduce") {
                MoneyOutTransactionList.push({
                    partyName: `Cash adjustment`,
                    transactionDate: adjustmentDate,
                    referenceNo: '',
                    type: `Cash ${adjustmentType}`,
                    debit_Amount: adjustmentType === 'Reduce' ? amount : 0,
                });
            }

        });

        MoneyInTransactionList.map(transaction => {
            TransactionList.push(transaction)
        })
        MoneyOutTransactionList.map(transaction => {
            TransactionList.push(transaction)
        })

        // Calculate running cash balance
        let runningCashInHand = 0;

        TransactionList = TransactionList.map(transaction => {

            totalMoneyIn += transaction.credit_Amount || 0
            totalMoneyOut += transaction.debit_Amount || 0
            runningCashInHand += (transaction.credit_Amount || 0) - (transaction.debit_Amount || 0);
            console.log(runningCashInHand, 'runningCashInHand')

            console.log((transaction.credit_Amount || 0) - (transaction.debit_Amount || 0), '(transaction.credit_Amount || 0) - (transaction.debit_Amount || 0)')
            return {
                ...transaction,
                runningCashInHand
            };
        });

        let closingCash = openingCash + totalMoneyIn - totalMoneyOut;
        let headerData = { closingCash, openingCash, totalMoneyIn, totalMoneyOut }

        res.status(200).json({ status: 'Success', data: { moneyIn: MoneyInTransactionList, moneyOut: MoneyOutTransactionList, runningCashInHand,headerData } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}



const fetchOpeningCash = async (fromDate, userId) => {
    // Fetch Cash Adjustments
    let TransactionList = await Transactions.aggregate([
        {
            $match: {
                createdBy: new mongoose.Types.ObjectId(userId),
                transactionType: {
                    $in: ['Sale', 'Purchase', 'Credit Note', 'Debit Note', 'Payment-In', 'Payment-Out']
                },
                "paymentMethod.method": "Cash",
                transactionDate: {
                    $lt: fromDate
                }
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
    let CashAdjustmentList = await CashAdjustments.find({
        createdBy: userId,
        adjustmentDate: {
            $lt: fromDate
        }
    });

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
        accountName: "Cash",
        transferDate: {
            $lt: fromDate
        }
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


    return cashBalance

}