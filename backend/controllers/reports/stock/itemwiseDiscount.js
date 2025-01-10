const Sales = require('../../../models/invoiceModel');
const mongoose = require('mongoose');
const Products = require('../../../models/productModel');

exports.getItemwiseDiscountReport = async (req, res) => {

    try {

        let itemsData = await Sales.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user)
                }
            },
            {
                $unwind: '$items'
            },
            {
                $lookup: {
                    from: "products",
                    localField: "items.itemId",
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            {
                $unwind: '$itemDetails'
            },
            {
                $group: {
                    _id: '$items.itemId',
                    itemName: { $first: '$itemDetails.itemName' }, 
                    totalQtySold: { $sum: '$items.quantity' }, 
                    qty: { $push: '$items.quantity' },
                    pricePerunit: { $push: '$items.price' },
                    totalSaleAmount: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                    discountPercent: { $push: '$items.discountPercent' }
                }
            }
        ]);


        let ProductList = await Products.find({ createdBy: req.user }).select('itemName');

        itemsData.forEach(item => {
            const grossAmountArray = item.qty.map((quantity, index) => quantity * item.pricePerunit[index]);
            const grossAmount = grossAmountArray.reduce((acc, curr) => acc + curr, 0);


            item.itemName = ProductList.find(product => { return product._id.toString() === item._id.toString() }).itemName;

            // Calculating discount amount array and store in the item
            const discountAmountArray = grossAmountArray.map((gross, index) => {
                const discount = (gross * item.discountPercent[index]) / 100;
                
                return discount;
            });

            item.totalDiscountAmount = discountAmountArray.reduce((pre, next) => pre + next, 0)
            const averageDiscount = item.discountPercent.reduce((acc, curr) => acc + curr, 0) / item.discountPercent.length;
 
            const nearestDiscountPercent = item.discountPercent.reduce((prev, curr) => {
                return Math.abs(curr - averageDiscount) < Math.abs(prev - averageDiscount) ? curr : prev;
            });

            item.averageDiscountPercent = nearestDiscountPercent;
  
            delete item.qty
            delete item.pricePerunit
            delete item.discountPercent
            delete item.grossAmount
        });

        // console.log("Updated itemsData:", itemsData);
        res.status(200).json({ status: 'Success', data: itemsData });
    }

    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}

exports.getDiscountDetailsForItem = async (req, res) => {
    try {

        const { itemId } = req.params;

        let itemDetails = await Sales.find({
            createdBy: req.user,
            // 'items.itemId': itemId,
            items: {
                $elemMatch: { itemId: itemId }
            }

        })
            .select('invoiceNo totalAmount items');

        console.log(itemDetails, 'Item-details');

        let updatedItemDetails = itemDetails.map(obj => {
            let { items, invoiceNo, totalAmount } = obj;
            let item = items[0];

            let discountAmount = parseFloat(item.discountPercent * totalAmount) / 100;

            return {
                invoiceNo,
                quantity: item.quantity,
                pricePerUnit: item.price,
                amountBeforeDiscount: parseFloat(parseFloat(totalAmount) + parseFloat(discountAmount)).toFixed(2),
                discountAmount:parseFloat(discountAmount).toFixed(2),
                discountPercentage: item.discountPercent,
                totalSaleAmount: totalAmount
            }

        })

        res.status(200).json({ status: 'Success', data: updatedItemDetails });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}