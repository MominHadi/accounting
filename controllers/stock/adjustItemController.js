const Products = require('../../models/productModel');
const ItemAdjustment = require('../../models/itemAdjustments');
const mongoose = require('mongoose');

exports.adjustStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let { adjustmentDate, itemId, totalQty, atPrice, details, action } = req.body;

        totalQty=parseFloat(totalQty);

        const savedItemAdjustment = await ItemAdjustment.create([{
            itemId,
            totalQty,
            atPrice,
            details,
            action,
            adjustmentDate,
            createdBy: req.user,
        }], { session });

        const product = await Products.findOne({ _id: itemId, createdBy: req.user }).session(session);

        if (action === 'reduce') {
            // if (product.stock.totalQuantity < totalQty) {
            //     await session.abortTransaction();
            //     session.endSession();
            //     return res.status(400).json({ error: 'Insufficient stock to reduce.' });
            // }
            product.stock.totalQuantity -= totalQty;
        } else if (action === 'add') {
            product.stock.totalQuantity += totalQty;
        }

        await product.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: 'Stock adjusted successfully!', data: savedItemAdjustment });
    } catch (error) {
        console.log(error)
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};