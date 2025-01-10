const ExpenseItems = require("../../models/purchase/expenseItemsModel");
const Expenses = require("../../models/purchase/expenseModel");
const mongoose = require("mongoose");

exports.getAllItems = async (req, res) => {

    try {
        const ProductList = await ExpenseItems.find({ createdBy: req.user }).select("name price");

        if (!ProductList) {
            return res.status(200).json({ error: "Expense Item not Found!!!!" })
        };

        res.status(200).json({ status: "Success", data: ProductList });

    } catch (error) {
        // console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error })

    }
}


exports.getTransactionsForItem = async (req, res) => {
    try {

        let { id } = req.params;

        if (!id) {
            return res.status(400).json({ status: 'Failed', message: 'Id is required' });
        };

        let itemDetails = await Expenses.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),

                }
            }
            , {
                $unwind: '$items'
            }, {
                $match: { 'items.itemId': new mongoose.Types.ObjectId(id) }
            },
            {
                $project: {
                    expenseNo: 1,
                    _id: 1,
                    totalAmount: 1,
                    balanceAmount:1
                }
            }
        ]);

        if (!itemDetails) {
            res.status(404).json({ message: "Data not found" });
        };

        res.status(200).json({ status: 'Success', data: itemDetails });

    } catch (error) {
        console.log(error, 'Errots')
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error })

    }
}

exports.getExpenseItemById = async (req, res) => {

    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ status: "Failed", message: "Expense Item Id is Required" })
        }

        const itemData = await ExpenseItems
            .findOne({ _id: id, createdBy: req.user })
            .populate({ path: "taxRate" })

        if (!itemData) {
            return res.status(404).json({ error: "Expense Item not Found!!!!" })
        }

        res.status(200).json({ status: "Success", data: itemData });
    }
    catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })
    }
}


exports.saveItem = async (req, res) => {
    try {

        let { itemName, itemHsn, price, taxIncluded, taxRate } = req.body;

        if (!itemName) {
            return res.status(400).json({ status: "Failed", message: "Item name is required" })
        }

        price = !price ? 0 : price;
        taxIncluded = !taxIncluded ? false : taxIncluded;

        let existingProduct = await ExpenseItems.findOne({ name: itemName, createdBy: req.user });

        if (existingProduct) {
            return res.status(409).json({ status: "Failed", message: 'Duplicate Entry Found' });
        }

        const newProduct = await ExpenseItems.create({ name: itemName, itemHsn, price, taxIncluded, taxRate, createdBy: req.user });

        if (newProduct) {
            res.status(201).json({ status: "Success", message: "Expense Item Saved Successfully", data: newProduct });
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while saving the Expense item. Please try again", error: error })

    }
}


exports.updateItem = async (req, res) => {
    try {
        const { id } = req.params; // Assuming we're using the item's ID for updating
        const { itemName, itemHsn, price, taxIncluded, taxRate } = req.body;

        // Check if the item exists
        let existingItem = await ExpenseItems.findOne({ _id: id, createdBy: req.user });

        if (!existingItem) {
            return res.status(404).json({ status: "Failed", message: "Expense item not found" });
        }

        if (itemName) existingItem.name = itemName;
        if (itemHsn) existingItem.itemHsn = itemHsn;
        if (price !== undefined) existingItem.price = price;
        if (taxIncluded !== undefined) existingItem.taxIncluded = taxIncluded;
        if (taxRate !== undefined) existingItem.taxRate = taxRate;

        // Save the updated item
        const updatedItem = await existingItem.save();

        res.status(200).json({ status: "Success", message: "Expense Item updated successfully", data: updatedItem });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while updating the Expense item. Please try again", error: error });
    }
}



exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await ExpenseItems.findOne({ _id: id, createdBy: req.user });

        if (!item) {
            return res.status(404).json({ status: "Failed", message: "Expense item not found" });
        }

        //Finding if item used in expense or not
        const isItemUsed = await Expenses.findOne({
            "items": {
                $elemMatch: {
                    itemId: id
                }
            }, createdBy: req.user
        })

        if (isItemUsed) {
            return res.status(400).json({ status: "Failed", message: "This Item cannot be deleted as it is already used in transactions" });
        }

        // Delete the item
        await ExpenseItems.deleteOne({ _id: id });

        res.status(200).json({ status: "Success", message: "Expense item deleted successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while deleting the Expense item. Please try again", error: error });
    }
}
