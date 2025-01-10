const Banks = require('../../models/bankModel');
const Transactions = require('../../models/transactionModel');
const ChequeTransfers = require('../../models/chequeTransferModel');
const formatDate = require('../../global/formatDate');
const mongoose = require('mongoose');

exports.getBankStatement = async (req, res) => {
    try {
        let { fromDate, toDate, bankName } = req.query;

        if (!fromDate || !toDate || !bankName) {
            return res.status(400).json({ status: 'Failed', message: "All fields are required" });
        }

        // Convert to date objects and format 
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        // Find the bank details
        let bankDetails = await Banks.findOne({ bankName, createdBy: req.user });

        if (!bankDetails) {
            return res.status(404).json({ message: 'Bank not found' });
        }
        const bankId = bankDetails._id;

        // Fetch transactions where the payment method includes the specified bank
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: {
                        $gte: startDate,
                        $lte: endDate
                    },
                    transactionType: { $ne: "Sale Cancelled" },
                    createdBy: new mongoose.Types.ObjectId(req.user),
                }
            },
            {
                $unwind: "$paymentMethod"
            },
            {
                $match: {
                    "paymentMethod.method": "Bank",
                    "paymentMethod.bankName": bankId
                }
            },
            {
                $project: {
                    _id: 1,
                    transactionDate: 1,
                    transactionType: 1,
                    credit_amount: {
                        $cond: [
                            { $or: [{ $eq: ["$transactionType", "Sale"] }, { $eq: ["$transactionType", "Payment-In"] }, { $eq: ["$transactionType", "Debit Note"] }] },
                            "$paymentMethod.amount",
                            0
                        ]
                    },
                    debit_amount: {
                        $cond: [
                            { $or: [{ $eq: ["$transactionType", "Purchase"] }, { $eq: ["$transactionType", "Payment-Out"] }, { $eq: ["$transactionType", "Credit Note"] }] },
                            "$paymentMethod.amount",
                            0
                        ]
                    }
                }
            }
        ]);
        console.log(bankId, TransactionList, 'Transactioons');

        // Adding opening balance as the first entry
        let bankObject = {
            transactionDate: formatDate(bankDetails.asOfDate),
            transactionType: 'Opening Balance',
            credit_amount: bankDetails.openingBalance,
            debit_amount: 0
        };

        TransactionList.unshift(bankObject);


        //Adding Cheque Transfers for the Bank
        let ChequeTransfersData = await ChequeTransfers.find({
            transferDate: {
                $gte: startDate,
                $lte: endDate
            }, accountName: "Bank", bank: bankId
        }).populate('sourceId', 'partyName');


        if (ChequeTransfersData.length) {
            ChequeTransfersData.map((item) => {

                TransactionList.push({
                    transactionDate: formatDate(item.transferDate),
                    transactionType: `[Cheque Transfer] ${item?.sourceId?.partyName}`,
                    debit_amount: item.transactionType == 'deposit' ? 0 : item.amount,
                    credit_amount: item.transactionType == 'deposit' ? item.amount : 0
                });

            });
        };

        // Calculate the running balance
        let balanceAmount = 0;

        TransactionList = TransactionList.map(transaction => {

            balanceAmount += (transaction.credit_amount || 0) - (transaction.debit_amount || 0);

            return {
                date: formatDate(transaction.transactionDate),
                description: transaction.transactionType,
                withdrawal_amount: transaction.debit_amount,
                deposit_Amount: transaction.credit_amount,
                balanceAmount
            };
        });

        // Sort transactions by date (descending order)
        const sortedTransactionList = TransactionList.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({ status: "Success", data: sortedTransactionList });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};
