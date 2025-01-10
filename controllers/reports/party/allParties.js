const Parties = require("../../../models/partyModel");
const Transactions = require("../../../models/transactionModel");
let mongoose = require("mongoose");

exports.getAllPartiesReport = async (req, res) => {
    try {

        let { sortBy, show, dateFilter, showZeroBalanceParty } = req.query;
        showZeroBalanceParty = showZeroBalanceParty ? showZeroBalanceParty : true;

        let searchConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            transactionType: { $ne: 'Expense' }
        };
        // let PartiesList = await Parties.aggregate([{
        //     $match: searchConditions


        // }, {
        //     $addFields: {
        //         balance: { $subtract: ['$balanceDetails.receivableBalance', '$balanceDetails.payableBalance'] }
        //     }
        // }, {
        //     $project: {
        //         balance: 1
        //     }
        // }]);

        // let PartiesList = await Parties.find(searchConditions).select('balanceDetails name  creditLimit');

        // if (PartiesList.length) {

        //     PartiesList = PartiesList.map(data => {
        //         let receivableBalance = data.balanceDetails?.receivableBalance || 0;
        //         let payableBalance = data.balanceDetails?.payableBalance || 0;

        //         const netBalance = receivableBalance - payableBalance;

        //         if (netBalance > 0) {

        //             receivableBalance = netBalance;
        //             payableBalance = 0;
        //         } else if (netBalance < 0) {
        //             receivableBalance = 0;
        //             payableBalance = Math.abs(netBalance);
        //         } else {
        //             receivableBalance = 0;
        //             payableBalance = 0;
        //         }

        //         return{

        //         }
        //     })
        // };

        // console.log(PartiesList, 'PartiesList');
        console.log(searchConditions, 'Search-conditionss');
        let TransactionsforParty = await Transactions.aggregate([
            {
                $match: searchConditions
            },

            {
                $group: {
                    _id: {
                        party: '$party',
                        transactionType: '$transactionType'
                    },
                    totalBalance: { $sum: '$balance' },
                    totalAmount: { $sum: '$totalAmount' },

                }
            },
            {
                $lookup: {
                    from: 'parties',
                    localField: '_id.party',
                    foreignField: '_id',
                    as: 'partyDetails',
                    pipeline: [{
                        $project: {
                            name: 1,
                            creditLimit: 1,
                            _id: 0
                        }
                    }]
                }
            },
            {

                $project: {
                    _id: 1,
                    partyDetails: '$partyDetails',
                    transactionType: '$transactionType',
                    totalBalance: 1,
                    totalAmount: 1,
                    creditLimit: 1
                }
            }
        ]);


        console.log(TransactionsforParty,`TransactionsforParty`)
        let balancedData = calculateBalances(TransactionsforParty, showZeroBalanceParty);

        if (showZeroBalanceParty == 'true') {
            let zeroBalanceParties = await Parties.find({
                createdBy: req.user,
                'balanceDetails.receivableBalance': { $eq: 0 },
                'balanceDetails.payableBalance': { $eq: 0 },
            }).select('name creditLimit');

            if (zeroBalanceParties.length) {

                zeroBalanceParties.map(party => {
                    balancedData.push({
                        "party": party._id,
                        "partyName": party.name,
                        "creditLimit": party.creditLimit,
                        "balance": 0
                    });
                })

            }
        }

        let uniqueData = removeDuplicateParties(balancedData);


        //Applying SOrting and filtering
        if (sortBy && sortBy.trim().toLowerCase() == 'amount') {
            uniqueData = uniqueData.sort((a, b) => b.balance - a.balance);
        } else if (!sortBy || sortBy.trim().toLowerCase() == 'name') {
            uniqueData = uniqueData.sort((a, b) => a.name - b.name);
        };

        if (show && show.trim().toLowerCase() == "receivables") {
            uniqueData = uniqueData.filter((item) => item.balance > 0)
        } else if (show && show.trim().toLowerCase() == "payables") {
            uniqueData = uniqueData.filter((item) => item.balance < 0)
        };

        return res.status(200).json({ message: "All Parties Report Fetched  Successfully", data: uniqueData });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });

    };
}

function removeDuplicateParties(data) {
    return data.reduce((uniqueParties, currentParty) => {
        // If the party already exists in uniqueParties, we skip adding it
        if (!uniqueParties.some(party => party.party.toString() === currentParty.party.toString())) {
            uniqueParties.push(currentParty);
        }
        return uniqueParties;
    }, []);
}


function calculateBalances(data, showZeroBalanceParty) {
    const partyBalances = {};

    data.forEach((item) => {

        const partyId = item._id.party;
        const transactionType = item._id.transactionType;
        const totalBalance = item.totalBalance || 0;
        const totalAmount = item.totalAmount || 0;
        const partyName = item.partyDetails[0]?.name || "Unknown";
        const creditLimit = item.partyDetails[0]?.creditLimit;

        if (!partyBalances[partyId]) {
            partyBalances[partyId] = {
                name: partyName,
                receivingBalance: 0,
                payableBalance: 0,
                creditLimit
            };
        }

        // Calculating Receiving Balance
        if (transactionType === "Sale") {
            partyBalances[partyId].receivingBalance += totalBalance;
        } else if (transactionType === "Debit Note") {
            partyBalances[partyId].receivingBalance += totalBalance;
        } else if (transactionType === "Payment-In") {
            partyBalances[partyId].receivingBalance -= totalAmount;
        }

        // Calculating Payable Balance
        if (transactionType === "Purchase") {
            partyBalances[partyId].payableBalance += totalBalance;
        } else if (transactionType === "Credit Note") {
            partyBalances[partyId].payableBalance += totalBalance;
        } else if (transactionType === "Payment-Out") {
            partyBalances[partyId].payableBalance -= totalAmount;
        }
    });

    return Object.keys(partyBalances).map((partyId) => ({
        party: partyId,
        // ...partyBalances[partyId],
        partyName: partyBalances[partyId].name,
        creditLimit: partyBalances[partyId].creditLimit,
        balance: partyBalances[partyId].receivingBalance - partyBalances[partyId].payableBalance,
    })).filter((party) => showZeroBalanceParty == "true" || party.balance !== 0);;
}