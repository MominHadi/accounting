const Units = require("../models/unitModel");
const Products = require("../models/productModel");

const processItems = async (items, userId, session) => {
    try {
        for (const item of items) {
            // Checking if the unit exists or not
            let existingUnit = await Units.findOne({ name: item.unit, createdBy: userId });

            if (!existingUnit) {
                console.log(`Unit Not Found for ${item.unit}`);
                throw new Error('Unit not found');
            } else {
                item.unit = existingUnit._id;
            }

            // Checking if the item exists (if not, create a new one)
            let existingItem = await Products.findOne({
                itemName: { $regex: new RegExp("^" + item.name + "$", "i") },
                createdBy: userId
            });

            if (!existingItem) {
                console.log(`Item not found: ${item.name}`);

                let itemName = item.name;
                const saveItem = await Products.create([{
                    itemName,
                    stock: { price: item?.price || 0 },
                    salePrice:item?.price || 0,
                    createdBy: userId
                }], { session });

                if (!saveItem) {
                    throw new Error('Error during saving new Item');
                }

                console.log('New Item saved:', saveItem);
                item.itemId = saveItem[0]._id;
            } else {
                item.itemId = existingItem._id;
            }

            item.taxPercent = item.taxPercent ? item.taxPercent : null;
            delete item.name;
        }

        return items;
    } catch (error) {
        console.error('Error processing items:', error);
        throw new Error('Error processing items:' + error);
    }
};

module.exports = { processItems };
