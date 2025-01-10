const Sales = require('../../models/invoiceModel');
const Purchase = require('../../models/purchase/purchaseModel');
const Transactions = require('../../models/transactionModel');
const mongoose = require('mongoose');

exports.getDiscountReport = async (req, res) => {
    try {

        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" })
        }

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        console.log(startDate, endDate, 'Ij8j i3o');
        // Ensure that endDate includes the full day by setting the time to 23:59:59
        endDate.setHours(23, 59, 59, 999);

        console.log(startDate, endDate, 'Date Range');


        // const Transaction = await Transactions.find({
        //     createdBy: req.user,
        //     transactionDate: {
        //         $gte: startDate,
        //         $lte: endDate
        //     },
        //     transactionType: { $in: ['Sale', 'Purchase'] }

        // })
        //     .populate({ path: 'reference.documentId', populate: { path: 'items.itemId', select: 'itemName' } })
        //     .populate('party', 'name -_id')
        //     .select("transactionType party  reference ");


        // const Transaction2 = await Transactions.aggregate([
        //     {
        //         $match: {
        //             createdBy: new mongoose.Types.Obje ctId(req.user),
        //             transactionType: { $in: ['Sale', 'Purchase'] }, // Check for Sale or Purchase
        //             transactionDate: {
        //                 $gte: startDate,  // Start date
        //                 $lte: endDate     // End date
        //             }
        //         }
        //     },
        //     {
        //         $lookup: {
        //             from: `$reference.docName`,
        //             localField: '$reference.documentId',
        //             foreignField: '_id',
        //             as: 'docDetails'
        //         }
        //     },
        //     {
        //         $unwind: '$docDetails'
        //     }, {
        //         $lookup: {
        //             from: 'products', // Assuming items are stored in a collection named 'items'
        //             localField: 'docDetails.items.itemId',
        //             foreignField: '_id',
        //             as: 'itemDetails'
        //         }
        //     },
        // ])

        // let updatedData = Transaction.map(obj => {
        //     let { reference, } = obj;

        //     let item = reference.documentId.items;

        //     console.log(item, 'Length Id');
        // });


        const SalesData = await Sales.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    invoiceDate: {
                        $gte: startDate,  // Start date
                        $lte: endDate     // End date
                    }
                }
            },
            {
                $unwind: '$items'  // Unwind the items array
            },
            {
                $addFields: {
                    totalAmount: {
                        $multiply: ['$items.price', '$items.quantity']  // Calculate total amount (price * quantity)
                    },
                    discountAmount: {
                        $multiply: [
                            { $divide: ['$items.discountPercent', 100] },  // Convert discountPercent to a fraction
                            { $multiply: ['$items.price', '$items.quantity'] }  // Apply discount to total amount
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$party',  // Group by party
                    saleDiscount: { $sum: '$discountAmount' },
                    partyName: { $first: '$partyName' }  // Sum the discountAmount for each party
                }
            },
            {
                $project: {
                    _id: 0,  // Hide the `_id` field if not needed
                    party: '$_id',
                    saleDiscount: 1,
                    partyName: 1
                    // Include the totalDiscount
                }
            }
        ]);



        const PurchaseData = await Purchase.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    billDate: {
                        $gte: startDate,  // Start date
                        $lte: endDate     // End date
                    }
                }
            },
            {
                $unwind: '$items'  // Unwind the items array
            },

            {
                $addFields: {
                    totalAmount: {
                        $multiply: ['$items.price', '$items.quantity']  // Calculate total amount (price * quantity)
                    },
                    discountAmount: {
                        $multiply: [
                            { $divide: ['$items.discountPercent', 100] },  // Convert discountPercent to a fraction
                            { $multiply: ['$items.price', '$items.quantity'] }  // Apply discount to total amount
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$party',  // Group by party
                    purchaseDiscount: { $sum: '$discountAmount' },
                    partyName: { $first: '$partyName' }  // Sum the discountAmount for each party
                }
            },
            {
                $project: {
                    _id: 0,  // Hide the `_id` field if not needed
                    party: '$_id',
                    purchaseDiscount: 1,
                    partyName: 1
                    // Include the totalDiscount
                }
            }
        ]);

        console.log(PurchaseData, 'Purchase Data')
        console.log(SalesData, 'Sales Data')
        // Step 1: Merge both arrays into one
        const combinedData = [...PurchaseData, ...SalesData];

        // Step 2: Reduce the combined array and merge discounts for the same party
        const mergedData = combinedData.reduce((acc, curr) => {
            const existingParty = acc.find(item => item.party.equals(curr.party));

            if (existingParty) {
                // If the party already exists, merge discounts
                existingParty.purchaseDiscount = existingParty.purchaseDiscount || curr.purchaseDiscount || 0;
                existingParty.saleDiscount = existingParty.saleDiscount || curr.saleDiscount || 0;
            } else {
                // If the party doesn't exist, add a new entry
                acc.push({
                    partyName: curr.partyName,
                    party: curr.party,
                    purchaseDiscount: curr.purchaseDiscount || 0,
                    saleDiscount: curr.saleDiscount || 0
                });
            }

            return acc;
        }, []);

        console.log(mergedData, 'merged Data');

        res.status(200).json({ status: 'Successfully Retrieved Discount Report', data: mergedData });

        // console.log(Transaction, updatedData, '9jiji');
        // res.status(200).json({ status: 'Success', data: SalesData });
        // console.log(Transaction, 'Transactions')
    } catch (error) {
        console.log(error)
    }
}