const Products = require('../../../models/productModel');

exports.getStockSummaryReport = async (req, res) => {
    try {
        let { date, category, byStock, status } = req.query;

        if (!date) date = Date.now();

        const endDate = new Date(date);

        let searchConditions = {
            createdBy: req.user,
            createdAt: {
                $lte: endDate
            }
        };

        if (category && category !== 'All') {
            if (category.toUpperCase().trim() === 'UNCATEGORIZED')
                searchConditons.category = []
            else {
                searchConditions.category = {
                    $in: [category]
                }
            }
        };

        if (byStock && byStock.toUpperCase().trim() !== "ALL") {
            searchConditions['stock.totalQuantity'] = byStock.trim() === "In-Stock Items" ? { $gt: 0 } : { $lte: 0 };
        };

        if (status && status.trim().toUpperCase() !== "ALL")
            searchConditions.isActive = status.toLowerCase() === "active" ? true : false


        console.log(searchConditions, 'Search COndiiton')

        const ProductList = await Products.find(searchConditions).populate('category', 'name -_id')
            .select('itemName category salePrice purchasePrice stock.openingQuantity stock.totalQuantity');


        let totalLowStockQty = 0;
        let totalStockItems = 0;
        let totalStockValue = 0;


        if (ProductList.length) {
            ProductList.map(item => {
                item?.totalQuantity <= 0 ? totalLowStockQty += 1 : 0;

                totalStockItems += 1;
                let stockValue = item.stock.totalQuantity >= 0 ? parseFloat(item.salePrice) * parseFloat(item.stock.totalQuantity) : 0

                totalStockValue += parseFloat(stockValue);
            })
        }

        const updatedList = ProductList.map(obj => (

            {
                itemId: obj._id,
                itemName: obj.itemName,
                category: obj.category,
                salePrice: obj.salePrice,
                purchasePrice: obj.purchasePrice,
                stockQuantity: obj.stock.totalQuantity,
                stockValue: obj.stock.totalQuantity >= 0 ? parseFloat(obj.salePrice) * parseFloat(obj.stock.totalQuantity) : 0,

            }));

        res.status(200).json({ status: 'Success', ProductList: updatedList, loweStockItems: totalLowStockQty, noOfItems: totalStockItems, totalStockValue });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

