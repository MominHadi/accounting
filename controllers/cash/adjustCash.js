const mongoose = require('mongoose');
const CashAdjustments = require('../../models/adjustCashModel');

exports.getCashAdjustmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const cashAdjustment = await CashAdjustments.findOne({ _id: id, createdBy: req.user });

        if (!cashAdjustment) {
            return res.status(404).json({ status: 'Failed', message: 'Cash Adjustment not found or access denied' });
        }

        res.status(200).json({
            status: 'Success',
            data: cashAdjustment
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'Failed',
            message: 'An error occurred while retrieving the Cash Adjustment. Please try again.',
            error: error.message
        });
    }
};


exports.getAllCashAdjustments = async (req, res) => {
    try {
        // Find all cash adjustments created by the logged-in user
        const cashAdjustments = await CashAdjustments
        .find({ createdBy: req.user })
        .populate('createdBy', 'businessName _id email');

        // if (!cashAdjustments || cashAdjustments.length === 0) {
        //     return res.status(404).json({ status: 'Failed', message: 'No Cash Adjustments found for this user' });
        // }

        res.status(200).json({
            status: 'Success',
            data: cashAdjustments
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'Failed',
            message: 'An error occurred while retrieving Cash Adjustments. Please try again.',
            error: error.message
        });
    }
};



exports.addCashAdjustment = async (req, res) => {
    try {

        let { adjustmentType, amount, adjustmentDate, description } = req.body;

        if (!adjustmentType || !['Add', 'Reduce'].includes(adjustmentType)) {
            return res.status(400).json({ status: 'Failed', message: 'Enter Valid Adjustment Type' });
        }

        if (+amount < 0) {
            return res.status(400).json({ status: 'Failed', message: 'Amount cannot be negative' });

        };

        adjustmentDate = adjustmentDate ? new Date(adjustmentDate) : Date.now();

        const saveAdjustment = await CashAdjustments.create([{
            adjustmentType,
            amount,
            adjustmentDate,
            description:description,
            createdBy: req.user
        }]);



        res.status(201).json({ status: 'Success', message: 'Cash Adjustment Saved Successfully', data: saveAdjustment });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while saving the Expense Category. Please try again", error: error });

    }
}


exports.editCashAdjustment = async (req, res) => {
    try {
        const { id } = req.params; // ID of the cash adjustment to edit
        let { adjustmentType, amount, adjustmentDate, description } = req.body;

        // Validate adjustmentType
        if (adjustmentType && !['Add', 'Reduce'].includes(adjustmentType)) {
            return res.status(400).json({ status: 'Failed', message: 'Enter Valid Adjustment Type' });
        }

        // Validate amount
        if (amount && +amount < 0) {
            return res.status(400).json({ status: 'Failed', message: 'Amount cannot be negative' });
        }

        // Convert adjustmentDate to Date object (if provided)
        adjustmentDate = adjustmentDate ? new Date(adjustmentDate) : undefined;

        // Build update object
        const updateData = {};
        if (adjustmentType) updateData.adjustmentType = adjustmentType;
        if (amount) updateData.amount = amount;

        if (adjustmentDate) updateData.adjustmentDate = adjustmentDate;
        if (description) updateData.description = description;

        // Find and update the cash adjustment
        const updatedAdjustment = await CashAdjustments.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedAdjustment) {
            return res.status(404).json({ status: 'Failed', message: 'Cash Adjustment not found' });
        }

        res.status(200).json({
            status: 'Success',
            message: 'Cash Adjustment updated successfully',
            data: updatedAdjustment
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'Failed',
            message: 'An error occurred while updating the cash adjustment. Please try again.',
            error: error.message
        });
    }
};


exports.deleteCashAdjustment = async (req, res) => {
    try {
        const { id } = req.params; // ID of the cash adjustment to delete

        // Find and delete the cash adjustment
        const deletedAdjustment = await CashAdjustments.findByIdAndDelete(id);

        if (!deletedAdjustment) {
            return res.status(404).json({ status: 'Failed', message: 'Cash Adjustment not found' });
        }

        res.status(200).json({
            status: 'Success',
            message: 'Cash Adjustment deleted successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'Failed',
            message: 'An error occurred while deleting the cash adjustment. Please try again.',
            error: error.message
        });
    }
};
