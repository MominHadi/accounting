const Expenses = require('../../../models/purchase/expenseModel');
const mongoose = require('mongoose');

exports.getExpenseItemsReport = async (req, res) => {

    try {
        const { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        };

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        // endDate.setDate(endDate.getDate() + 1);

        let expenseData = await Expenses.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'expenseitems',
                    localField: 'items.itemId',
                    foreignField: '_id',
                    as: 'expenseItemDetails'
                }
            },
            {
                $unwind: '$expenseItemDetails'
            }
            , {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$expenseItemDetails.name' },
                    amount: { $sum: '$totalAmount' }
                }
            }
        ]);

        res.status(200).json({ status: 'Success', data: expenseData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}