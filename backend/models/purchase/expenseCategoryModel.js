const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExpenseCategorySchema = new Schema({
    name: {
        type: String,
        default:""
    },
    type: {
        type: String,
        enum: ["Indirect Expense", "Direct Expense"],
        default: "Indirect Expense"
    },
    expenseAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "Users"
    }
}, { collection: "expenseCategory", timestamps: true });

module.exports = mongoose.model('ExpenseCategory', ExpenseCategorySchema);
