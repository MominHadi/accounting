const Products = require("../../models/productModel");
const Categories = require("../../models/categoryModel");
const Transactions = require("../../models/transactionModel");
const StockAdjustment = require("../../models/itemAdjustments");
const Units = require("../../models/unitModel");
const formatDate = require("../../global/formatDate");
const mongoose = require('mongoose');

exports.getTransactionForItem = async (req, res) => {
    try {

        const { itemId } = req.params;

        const ProductList = await Transactions.find({
            createdBy: req.user,
        }).populate({
            path: "reference.documentId",
            match: { "items.itemId": itemId },
            select: "items"
        }).populate({
            path: "party",
            select: "name"
        });


        let adjustmentData = await StockAdjustment.find({ createdBy: req.user, itemId }).select('-createdAt -__V');

        const filteredTransactions = ProductList.filter(transaction => transaction.reference?.documentId);

        const itemQuantities = filteredTransactions.map(transaction => {

            const matchingItems = transaction.reference.documentId.items.filter(item => item.itemId.toString() === itemId);

            console.log(matchingItems, 'matchingItems');

            const totalQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);

            const pricePerUnit = matchingItems.length > 0 ? matchingItems[0].price : null;

            let newReference = {
                documentNo: transaction.reference?.documentNumber,
                documentId: transaction.reference?.documentId?._id,
            };

            return {
                transactionId: transaction._id,
                type: transaction.transactionType,
                partyName: transaction.party.name,
                quantity: totalQuantity || null,
                pricePerUnit,
                transactionDate: formatDate(transaction.transactionDate),
                reference: newReference,
                totalAmount: transaction.totalAmount,
                status: transaction.balance > 0 ? 'UnPaid' : "Paid",
            };
        });


        console.log(itemQuantities, 'itemQuantities')

        if (adjustmentData.length > 0) {
            adjustmentData.map(item => {

                itemQuantities.push({
                    transactionId: item._id,
                    type: `${item.action.toUpperCase()} Stock`,
                    quantity: item.totalQty,
                    totalAmount: 0,
                    transactionDate: formatDate(item.adjustmentDate),
                    reference: {}
                })
            });
        }

        // itemQuantities.push(adjustmentData);

        const OpeningStockDetails = await Products.findById(itemId).select('stock createdAt updatedAt');

        if (OpeningStockDetails) {

            if (OpeningStockDetails.stock.openingQuantity > 0) {
                let stockDetails = {
                    transactionId: null,
                    type: `Opening Stock`,
                    partyName: 'Opening Stock',
                    quantity: OpeningStockDetails.stock.openingQuantity,
                    totalAmount: OpeningStockDetails.stock.openingQuantity * OpeningStockDetails.stock.price,
                    transactionDate: formatDate(OpeningStockDetails.createdAt),
                    reference: {}
                };

                itemQuantities.push(stockDetails);
            };
        };

        let sortedTransactionList = itemQuantities.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

        if (sortedTransactionList.length === 0) {
            return res.status(200).json({ error: "No transactions found with the specified itemId." });
        };
        res.status(200).json({ status: "Success", data: sortedTransactionList });

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error })

    }

}


exports.getItemById = async (req, res) => {

    try {
        const { itemId } = req.params;

        if (!itemId) {
            return res.status(400).json({ status: "Failed", message: "Item Id is required" })
        };

        const ProductList = await Products.find({ _id: itemId, createdBy: req.user }).populate('unit', `name shortName _id`).populate('category', 'name').select("-createdAt -updatedAt").populate('taxRate')

        if (!ProductList) {
            return res.status(404).json({ error: "Product not Found!!!!" })
        };

        const formattedStock = ProductList.map(item => {
            delete item.stock
            return {
                ...item._doc,
            };
        });

        res.status(200).json({ status: "Success", data: formattedStock });
    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error });

    }
}

exports.getAllItems = async (req, res) => {
    try {
        const ProductList = await Products.find({ createdBy: req.user, type: 'Product' }).select("-createdAt -updatedAt").populate('category').populate('unit', 'name shortName').populate('taxRate')

        if (!ProductList) {
            return res.status(200).json({ error: "Products not Found!!!!" })
        };

        res.status(200).json({ status: "Success", data: ProductList });

    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Failed", message: "An error occurred while fetching Items. Please try again", error: error.message || error })
    }
}

exports.saveItem = async (req, res) => {
    try {

        let { itemName, itemHsn, category, itemCode, unit, mrp, salePrice, salePriceIncludesTax, discountValue, discountType, purchasePrice, purchasePriceIncludesTax, openingQuantity, stockPrice, minStockToMaintain, taxRate, location, type } = req.body;
        console.log(req.body, 'Req.body');
        const images = [];

        if (req.files && req.files.length > 0) {
            for (const image of req.files) {
                images.push(image.filename);
            }
        };

        category = category ? JSON.parse(category) : [];

        let existingProduct = await Products.findOne({
            itemName: { $regex: new RegExp("^" + itemName.trim() + "$", "i") }
            , createdBy: req.user
        });

        if (existingProduct) {
            return res.status(409).json({ status: "Failed", message: 'Item Already Exists' });
        }

        if (category.length) {
            for (const data of category) {

                let categoryDetails = await Categories.findOne({
                    name: { $regex: new RegExp("^" + data + "$", "i") },
                    createdBy: req.user
                });

                if (!categoryDetails) {

                    return res.status(404).json({ status: "Failed", message: `Category - ${data} not Found` })
                }

                else if (categoryDetails) {

                    let index = category.indexOf(data)
                    category[index] = categoryDetails._id;
                }

            }
        }

        console.log(category, 'Category Array');
        // return

        // let existingCategory = await Categories.findOne({
        //     _id: category, 
        //     createdBy: req.user
        // });

        // if (!existingCategory) {
        //     return res.status(404).json({ status: "Failed", message: 'Category Not Found' });
        // }


        unit = unit ? unit : null;
        if (unit) {

            let existingUnit = await Units.findOne({
                _id: unit,
                createdBy: req.user
            });

            if (!existingUnit) {
                return res.status(404).json({ status: "Failed", message: 'Unit Not Found' });
            };

        }

        let totalQuantity = openingQuantity ? openingQuantity : 0;

        // Prepare stock details
        const stockDetails = {
            openingQuantity,
            price: stockPrice,
            minStockToMaintain,
            saleQuantity: 0,
            location,
            totalQuantity
        };

        mrp = mrp ? mrp : 0;

        taxRate = taxRate ? taxRate : null;

        const newProduct = await Products.create({ type, itemName, itemHsn, category, itemCode, unit, mrp, salePrice, salePriceIncludesTax, discountValue, discountType, purchasePrice, purchasePriceIncludesTax, stock: stockDetails, taxRate, image: images, createdBy: req.user })

        if (newProduct) {
            res.status(201).json({ status: "Success", message: "Item Saved Successfully", data: newProduct });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: "Failed", message: "An error occurred while saving the item. Please try again", error: error.message || error })
    }
}

exports.updateItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        let {
            itemName,
            itemHsn,
            category,
            itemCode,
            unit,
            salePrice,
            salePriceIncludesTax,
            discountValue,
            discountType,
            purchasePrice,
            purchasePriceIncludesTax,
            openingQuantity,
            stockPrice,
            minStockToMaintain,
            taxRate,
            location,
            mrp
        } = req.body;

        category = category ? JSON.parse(category) : [];
        discountValue = discountValue ? discountValue : 0;
        unit = unit ? unit : null;
        taxRate = taxRate ? taxRate : null;

        const images = [];

        if (req.files && req.files.length > 0) {
            for (const image of req.files) {
                const imagePath = image.path.replace(image.destination, "images/").replace(/\\/g, "/");
                images.push(imagePath);
            }
        };

        let product = await Products.findOne({ _id: itemId, createdBy: req.user });
        if (!product) {
            return res.status(404).json({ status: "Failed", message: "Item not found" });
        }

        if (unit) {

            console.log(unit, 'Unit');
            let existingUnit = await Units.findOne({
                _id: unit,
                createdBy: req.user
            });

            if (!existingUnit) {
                return res.status(404).json({ status: "Failed", message: 'Unit Not Found' });
            };

        }


        if (category.length) {
            for (const data of category) {

                let categoryDetails = await Categories.findOne({
                    name: { $regex: new RegExp("^" + data + "$", "i") },
                    createdBy: req.user
                });

                if (!categoryDetails) {

                    return res.status(404).json({ status: "Failed", message: `Category - ${data} not Found` })
                }

                else if (categoryDetails) {

                    let index = category.indexOf(data)
                    category[index] = categoryDetails._id;
                }

            }
        };

        const stockDetails = {
            openingQuantity: openingQuantity || product.stock.openingQuantity,
            totalQuantity: openingQuantity || product.stock.totalQuantity,
            price: stockPrice || product.stock.price,
            minStockToMaintain: minStockToMaintain || product.stock.minStockToMaintain,
            location: location || product.stock.location
        };

        product.itemName = itemName || product.itemName;
        product.itemHsn = itemHsn || product.itemHsn;
        product.category = category || product.category;
        product.itemCode = itemCode || product.itemCode;
        product.unit = unit || product.unit;
        product.salePrice = salePrice || product.salePrice;
        product.salePriceIncludesTax = salePriceIncludesTax !== undefined ? salePriceIncludesTax : product.salePriceIncludesTax;
        product.discount.value = discountValue !== undefined ? discountValue : product.discount.value;
        product.discount.type = discountType || product.discount.type;
        product.purchasePrice = purchasePrice || product.purchasePrice;
        product.purchasePriceIncludesTax = purchasePriceIncludesTax !== undefined ? purchasePriceIncludesTax : product.purchasePriceIncludesTax;
        product.stock = stockDetails;
        product.taxRate = taxRate || product.taxRate;
        product.mrp = mrp || product.mrp;
        product.image = images || product.image;  // If new images provided, update; otherwise, keep existing
        product.stock.saleQuantity = 0;

        // Save updated product
        await product.save();

        return res.status(200).json({ status: "Success", message: "Item updated successfully", data: product });

    } catch (error) {
        console.log(error, 'Errrorerorrr')
        res.status(500).json({
            status: "Failed",
            message: "An error occurred while updating the item. Please try again.",
            error: error.message || error
        });
    }
};

exports.deleteItem = async (req, res) => {

    try {
        const { itemId } = req.params;

        // Validate if partyId is provided
        if (!itemId) {
            return res.status(400).json({ status: 'Failed', message: "Party ID is required" });
        }

        const findProduct = await Products.findById(itemId)

        if (!findProduct) {
            return res.status(404).json({ status: 'Failed', message: "Item Not Found" })
        }

        await Products.findByIdAndDelete(itemId)


        res.status(200).json({ status: "Success", message: "Item Deleted Successfully" })

    } catch (error) {
        console.log(error)
        res.status(500).json({
            status: "Failed",
            message: "An error occurred while deleting the item. Please try again.",
            error: error.message || error
        });
    }

}


