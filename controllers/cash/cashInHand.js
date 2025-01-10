const Transactions = require('../../models/transactionModel');
const CashAdjustments = require('../../models/adjustCashModel');
const ChequeTransfer = require("../../models/chequeTransferModel");
const mongoose = require('mongoose');

exports.showCashInHandList = async (req, res) => {
    try {
        // Fetch transactions with specific transaction types and cash payment methods
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
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
        let CashAdjustmentList = await CashAdjustments.find({ createdBy: req.user });

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
            createdBy: req.user,
            accountName: "Cash"
        }).populate('cheque', 'partyName -_id');


        ChequeTransfers.forEach((transfer) => {
                const { transferDate, adjustmentType, amount, cheque, referenceNo,transactionType } = transfer;
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
        res.status(200).json({ status: 'Success', sortedTransactionList, cashBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error. Please try again",
            error: error.message
        });
    }
};
