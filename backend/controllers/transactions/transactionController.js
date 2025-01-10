const Transactions = require('../../models/transactionModel');
const mongoose = require('mongoose');

exports.getAllTransactions = async (req, res) => {
    try {
        const { filters } = req.body;
        const { search } = req.query;

        const searchConditions = { createdBy: new mongoose.Types.ObjectId(req.user) };

        const pipeline = [
            { $match: searchConditions },
            {
                $lookup: {
                    from: 'parties',
                    localField: 'party',
                    foreignField: '_id',
                    as: 'partyDetails',
                },
            },
            { $unwind: { path: '$partyDetails', preserveNullAndEmptyArrays: true } },
        ];

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { transactionType: searchRegex },
                        { 'partyDetails.name': searchRegex },
                        { 'reference.documentNumber': searchRegex },
                        { totalAmount: { $regex: searchRegex } }
                    ],
                },
            });
        }

        if (filters && filters.length > 0) {
            pipeline.push({
                $match: { transactionType: { $in: filters } },
            });
        }

        pipeline.push({
            $project: {
                transactionType: 1,
                party: '$partyDetails.name',
                totalAmount: 1,
                balance: 1,
                transactionDate: 1,
                documentNo: '$reference.documentNumber',
            },
        });

        const transactionList = await Transactions.aggregate(pipeline);

        res.status(200).json({ status: 'Success', data: transactionList });

    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error });
    }
};
