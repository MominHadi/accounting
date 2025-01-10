const mongoose = require('mongoose');
const Transactions = require("../../models/transactionModel");
const CashAdjustments = require("../../models/adjustCashModel");
const formatDate = require('../../global/formatDate');

exports.getDayBookReport = async (req, res) => {

    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ status: 'Failed', message: "Date is required" })
        }

        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setDate(endOfDay.getDate() + 1);

        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    transactionDate: {
                        $gte: startOfDay,
                        $lt: endOfDay
                    },
                    transactionType: { $ne: 'Sale-Cancelled' },
                    createdBy: new mongoose.Types.ObjectId(req.user),
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
                $unwind: "$partyDetails"
            },
            {
                $project: {
                    partyName: '$partyDetails.name',
                    transactionDate: 1,
                    referenceNo: '$reference.documentNumber',
                    type: '$transactionType',
                    credit_Amount: '$credit_amount',
                    debit_Amount: '$debit_amount',
                    // moneyIn:{$sum:'$credit_amount'}
                }
            }
        ]);
        console.log(TransactionList, '(i0i')
        let CashAdjustmentList = await CashAdjustments.find({
            createdBy: req.user,
            adjustmentDate: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        CashAdjustmentList = CashAdjustmentList.map((obj) => {
            let { adjustmentDate, adjustmentType, amount } = obj;

            TransactionList.push({
                partyName: `Cash adjustment`,
                transactionDate: adjustmentDate,
                referenceNo: '',
                type: `Cash ${adjustmentType}`,
                credit_Amount: adjustmentType === 'Add' ? amount : 0,
                debit_Amount: adjustmentType === 'Reduce' ? amount : 0,
                totalAmount: amount
            })
        });

        let moneyIn = 0
        let moneyOut = 0;
        let totalAmount = 0;
        TransactionList.forEach(item => {

            if (item.credit_Amount > 0) totalAmount = totalAmount + item.credit_Amount
            else totalAmount = totalAmount - item.debit_Amount

            // totalAmount += item.credit_Amount
            // totalAmount -= item.debit_Amountx
            moneyIn += item.credit_Amount
            moneyOut += item.debit_Amount
        })

        res.status(200).json({ status: 'Success', TransactionList, totalAmount: parseFloat(totalAmount).toFixed(2), moneyIn: parseFloat(moneyIn).toFixed(2), moneyOut: parseFloat(moneyOut).toFixed(2) });

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }

}