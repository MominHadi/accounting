const ExpenseCategory = require("../../models/purchase/expenseCategoryModel");
const Expenses = require("../../models/purchase/expenseModel");
const formatDate = require("../../global/formatDate");

exports.getAllCategory = async (req, res) => {

    try {
        const ProductList = await ExpenseCategory.find({ createdBy: req.user }).select("name expenseAmount");

        if (!ProductList) {
            return res.status(200).json({ error: "Expense Category not Found!!!!" })
        };




        let totalExpenseAmount = ProductList.reduce((prev, next) => { return prev + next.expenseAmount }, 0);

        res.status(200).json({ status: "Success", data: ProductList, total: totalExpenseAmount });

    } catch (error) {
        // console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error })

    }
}

exports.getExpenseDetailsForCategory = async (req, res) => {
    try {

        let { expenseCategory } = req.params;

        let categoryDetails = await Expenses.find({
            createdBy: req.user,
            expenseCategory: expenseCategory
        }).select('_id  expenseNo date totalAmount balanceAmount');

        if (!categoryDetails) {
            res.status(404).json({ message: "Data not found", data: [] })
        };

        categoryDetails = categoryDetails.map((item) => ({
            _id: item._id,
            expenseNo: item.expenseNo,
            date: formatDate(item.date),
            totalAmount: item.totalAmount,
            balanceAmount: item.balanceAmount
        }));

        res.status(200).json({ status: 'Success', data: categoryDetails })

    } catch (error) {

        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error })

    }
}

exports.addExpenseCategory = async (req, res) => {
    try {

        let { name, type } = req.body;

        if (!name) {
            return res.status(400).json({ status: "Failed", message: "Expense name is required" })
        }

        let existingCategory = await ExpenseCategory.findOne({ name, createdBy: req.user });

        if (existingCategory) {
            return res.status(409).json({ status: "Failed", message: 'Duplicate Entry Found' });
        }

        const newCategory = await ExpenseCategory.create({ name, type, createdBy: req.user });

        if (newCategory) {
            res.status(201).json({ status: "Success", message: "Expense Category Saved Successfully", data: newCategory });
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while saving the Expense Category. Please try again", error: error.message || error })

    }

 
}



