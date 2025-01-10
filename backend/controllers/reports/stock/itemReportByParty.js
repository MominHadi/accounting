const Products = require('../../../models/productModel');
const Parties = require('../../../models/partyModel');
const Sales = require('../../../models/invoiceModel');
const Purchase = require('../../../models/purchase/purchaseModel');
const mongoose = require('mongoose');

exports.getItemByPartyReport = async (req, res) => {
    try {
        const { fromDate, toDate, partyName, sortBy } = req.query;


        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: 'fromDate and toDate are required' });
        };


        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        if (!partyName) {

            const salesData = await Sales.aggregate([
                {
                    $match: {
                        createdBy: new mongoose.Types.ObjectId(req.user),
                        invoiceDate: {
                            $gte: startDate,
                            $lte: endDate
                        },
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.itemId',
                        foreignField: '_id',
                        as: 'itemDetails'
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $unwind: '$itemDetails'
                },
                {
                    $group: {
                        _id: '$items.itemId',
                        name: { $first: '$itemDetails.itemName' },
                        saleQty: { $sum: '$items.quantity' },
                        saleAmount: { $sum: '$totalAmount' }
                    }
                }
            ]);

            const purchaseData = await Purchase.aggregate([
                {
                    $match: {
                        createdBy: new mongoose.Types.ObjectId(req.user),
                        billDate: {
                            $gte: startDate,
                            $lte: endDate
                        },
                    }
                },

                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.itemId',
                        foreignField: '_id',
                        as: 'itemDetails'
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $unwind: '$itemDetails'
                },
                {
                    $group: {
                        _id: '$items.itemId',
                        name: { $first: '$itemDetails.itemName' },
                        purchaseQty: { $sum: '$items.quantity' },
                        purchaseAmount: { $sum: '$totalAmount' }
                    }
                }
            ]);


            // Combine the two arrays, setting default values for missing properties
            const result = [...salesData, ...purchaseData].reduce((acc, item) => {
                const found = acc.find(obj => obj.name === item.name);

                if (found) {
                    // If object exists, update the existing saleQty or purchaseQty
                    found.name = item.name || found.name;
                    found.saleQty = item.saleQty || found.saleQty || 0;
                    found.purchaseQty = item.purchaseQty || found.purchaseQty || 0;
                    found.purchaseAmount = item.purchaseAmount || found.purchaseAmount || 0;
                    found.saleAmount = item.saleAmount || found.saleAmount || 0;
                } else {
                    acc.push({
                        _id: item._id,
                        name: item.name,
                        saleQty: item.saleQty || 0,
                        purchaseQty: item.purchaseQty || 0,
                        purchaseAmount: item.purchaseAmount || 0,
                        saleAmount: item.saleAmount || 0
                    });
                }

                return acc;
            }, []);

            //Applying sort filter by default sorting by name
            switch (sortBy?.toLowerCase()) {
                case 'purchase quantity':
                    result.sort((a, b) => b.purchaseQty - a.purchaseQty);
                    break
                case 'sale quantity':
                    result.sort((a, b) => b.saleQty - a.saleQty);
                    break
                case 'name':
                    result.sort((a, b) => a.name.localeCompare(b.name));
                    break
                default:
                    console.log("not applied")
            }


            return res.status(200).json({ status: "Success", data: result });

        } {

            console.log(partyName, req.user, '333')
            //Finding Party Id
            let partyId = await Parties.findOne({ name: partyName, createdBy: req.user });
            if (!partyId) {
                return res.status(404).json({ status: 'Failed', message: 'Party Not Found' })
            }
            partyId = partyId._id;



            const salesData = await Sales.aggregate([
                {
                    $match: {
                        createdBy: new mongoose.Types.ObjectId(req.user),
                        party: new mongoose.Types.ObjectId(partyId),
                        invoiceDate: {
                            $gte: startDate,
                            $lte: endDate
                        },
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.itemId',
                        foreignField: '_id',
                        as: 'itemDetails'
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $unwind: '$itemDetails'
                },
                {
                    $group: {
                        _id: '$items.itemId',
                        name: { $first: '$itemDetails.itemName' },
                        saleQty: { $sum: '$items.quantity' },
                        saleAmount: { $sum: '$totalAmount' }
                    }
                }
            ]);


            const purchaseData = await Purchase.aggregate([
                {
                    $match: {
                        createdBy: new mongoose.Types.ObjectId(req.user),
                        party: new mongoose.Types.ObjectId(partyId),
                        billDate: {
                            $gte: startDate,
                            $lte: endDate
                        },
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.itemId',
                        foreignField: '_id',
                        as: 'itemDetails'
                    }
                },
                {
                    $unwind: '$items'
                },
                {
                    $unwind: '$itemDetails'
                },
                {
                    $group: {
                        _id: '$items.itemId',
                        name: { $first: '$itemDetails.itemName' },
                        purchaseQty: { $sum: '$items.quantity' },
                        purchaseAmount: { $sum: '$totalAmount' }
                    }
                }
            ]);


            const result = [...salesData, ...purchaseData].reduce((acc, item) => {
                const found = acc.find(obj => obj.name === item.name);

                if (found) {
                    // If object exists, update the existing saleQty or purchaseQty
                    found.name = item.name || found.name;
                    found.saleQty = item.saleQty || found.saleQty || 0;
                    found.purchaseQty = item.purchaseQty || found.purchaseQty || 0;
                    found.purchaseAmount = item.purchaseAmount || found.purchaseAmount || 0;
                    found.saleAmount = item.saleAmount || found.saleAmount || 0;
                } else {
                    acc.push({
                        _id: item._id,
                        name: item.name,
                        saleQty: item.saleQty || 0,
                        purchaseQty: item.purchaseQty || 0,
                        purchaseAmount: item.purchaseAmount || 0,
                        saleAmount: item.saleAmount || 0
                    });
                }

                return acc;
            }, []);

            //Applying sort filter by default sorting by name
            switch (sortBy?.toLowerCase()) {
                case 'purchase quantity':
                    result.sort((a, b) => b.purchaseQty - a.purchaseQty);
                    break
                case 'sale quantity':
                    result.sort((a, b) => b.saleQty - a.saleQty);
                    break
                case 'name':
                    result.sort((a, b) => a.name.localeCompare(b.name));
                    break
                default:
                    result.sort((a, b) => a.name.localeCompare(b.name));

            }

            res.status(200).json({ status: "Success", data: result });
        }


    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}
