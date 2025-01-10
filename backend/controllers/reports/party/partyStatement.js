const Parties = require('../../../models/partyModel');
const Transactions = require('../../../models/transactionModel');
const mongoose = require('mongoose');
const formatDate = require('../../../global/formatDate');


exports.generatePartyStatementReport = async (req, res) => {
    try {

        let { toDate, fromDate, partyName } = req.query;
        let partyId;

        if (!partyName || !toDate || !fromDate) {
            return res.status(400).json({ status: 'Failed', message: 'All Fields are required' });
        };

        console.log(req.user, partyName, 'req.user, partyName')
        const PartyDetails = await Parties.findOne({ createdBy: req.user, name: partyName });

        if (!PartyDetails) {
            return res.status(404).json({ status: 'Failed', message: 'Party Not Found' });
        };

        partyId = PartyDetails._id;
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        let beginningBalance = await getOpeningBalance(startDate, partyId, req.user);
        console.log(beginningBalance, 'beginningBalance Balance');
        const transactions = await Transactions.aggregate([{
            $match: {
                transactionDate: {
                    $gte: startDate,
                    $lte: endDate
                },

                createdBy: new mongoose.Types.ObjectId(req.user),
                party: new mongoose.Types.ObjectId(partyId),
                // balance: {
                //     $gt: 0
                // }
            }
        },
        {

            $project: {
                _id: 0,

                transactionDate: {
                    $dateToString: {
                        format: "%d/%m/%Y",
                        date: "$transactionDate"
                    }
                },
                transactionType: 1,
                totalAmount: 1,
                balance: 1,
                documentNo: '$reference.documentNumber'
            }
        }]);


        let obj = {
            transactionType: beginningBalance >= 0 ? 'Receivable beginning' : 'Payable Beginning',
            totalAmount: 0,
            balance: beginningBalance || 0
        };

        transactions.unshift(obj);
        // let totalAmount+=

        let totalAmount = 0;
        let closingBalance = 0

        transactions.map((item) => {
            if (item.transactionType === 'Receivable Beginning') totalAmount += item.balance
            else totalAmount += item.totalAmount

            closingBalance += item.balance;
        });



        // for(let transaction of transactions ){


        //     transaction.transactionDate=formatDate(transaction.transactionDate);
        // };




        res.status(200).json({ message: `Party Statement Report for Party ${partyName}`, data: transactions, totalAmount, closingBalance })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });

    }
};



const getOpeningBalance = async (fromDate, partyId, userId) => {

    let PartyeDetails = await Parties.findById(partyId);


    let openingBalanceData = {
        balanceType: PartyeDetails.openingBalanceDetails.balanceType,
        openingBalance: PartyeDetails.openingBalanceDetails.openingBalance
    };

    let BalanceTransactions = await Transactions.aggregate([
        {
            $match: {
                transactionDate: { $lt: fromDate },
                transactionType: {
                    $in: ['Sale', 'Purchase', 'PaymentIn', 'PaymentOut', 'Credit Note', 'Debit Note']
                },
                createdBy: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                payableBalance: {
                    $sum: {
                        $cond: [
                            {
                                $in: ["$transactionType", ['Payment-Out', 'Purchase', 'Credit Note']]
                            },
                            "$balance",
                            0
                        ]
                    }
                },
                receivableBalance: {
                    $sum: {
                        $cond: [
                            {
                                $in: ["$transactionType", ['Sale', 'Payment-In', 'Debit Note']]
                            },
                            "$balance",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                payableBalance: 1,
                receivableBalance: 1
            }
        }
    ]);




    let balance = BalanceTransactions.length > 0 ? BalanceTransactions[0].receivableBalance : 0 - BalanceTransactions.length > 0 ? BalanceTransactions[0]?.payableBalance : 0
    openingBalanceData?.balanceType == 'toPay' ?
        balance -= openingBalanceData.openingBalance || 0 :
        balance += openingBalanceData.openingBalance || 0;



    console.log(BalanceTransactions, 'BalanceTransactions');
    return balance


}
