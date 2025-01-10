const Products = require('../../../models/productModel');
const Category = require('../../../models/categoryModel');


exports.getLowStockSummary = async (req, res) => {
    try {

        let { category, byStock, status } = req.query;
        let searchConditions = {
            'stock.totalQuantity': {
                $lte: 0
            },
            createdBy: req.user
        };

        let categoryId;


        if (category && category.toUpperCase() !== 'ALL' && category.toUpperCase() !== 'UNCATEGORIZED') {
            let CategoryDetails = await Category.findOne({ name: category, createdBy: req.user });

            if (!CategoryDetails) {
                return res.status(404).json({ status: "Failed", message: 'Category Not Found' });
            };

            categoryId = CategoryDetails._id;

            searchConditions.category = {
                $in: categoryId
            };
        } else if (category && category.toUpperCase() == 'UNCATEGORIZED') {
            searchConditions.category = [];
        };


        if (status && status.toUpperCase() !== 'ALL') {
            searchConditions.isActive = status.toUpperCase() === 'ACTIVE' ? true : false;
        };

        console.log(searchConditions, `Search Conditions`);
        let lowStockProducts = await Products.find(searchConditions).select('itemName stock.totalQuantity  salePrice');


        lowStockProducts = lowStockProducts.map(obj => ({
            itemName: obj.itemName,
            quantity: obj.stock.totalQuantity,
            stockValue: parseFloat(obj.salePrice) * parseFloat(obj.stock.totalQuantity)
        }));

        res.status(200).json({ status: 'Success', data: lowStockProducts })

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}