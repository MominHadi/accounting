const Transactions = require("../../../models/transactionModel");
const formatDate = require("../../../global/formatDate")

exports.getExpenseTransactionReport = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        };

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        let expenseTransactionList = await Transactions.find({
            transactionDate: {
                $gte: startDate,
                $lte: endDate
            },
            transactionType: 'Expense',
            createdBy: req.user,

        })
            .populate({ path: 'reference.documentId', select: 'expenseCategory' })
            .select(`transactionDate reference   transactionType totalAmount debit_amount  balance`)
            // .populate('party', 'name')
            .sort({ transactionDate: -1 });


        if (expenseTransactionList) {
            expenseTransactionList = expenseTransactionList.map(transaction => {

                let { reference, totalAmount, debit_amount, balance, transactionDate } = transaction;

                return {
                    _id: reference.documentId._id,
                    transactionDate: formatDate(transactionDate),
                    category: reference.documentId?.expenseCategory,
                    amount: totalAmount,
                    balance
                };
            })
        };

        res.status(200).json({ status: 'Success', expenseTransactionList });

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}