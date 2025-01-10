const Category = require("../models/categoryModel");
const Products = require('../models/productModel');
const mongoose = require("mongoose");

exports.getAllCategory = async (req, res) => {
  try {

    const data = await Category.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(req.user),
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',  // Category _id from the current collection
          foreignField: 'category',
          as: 'productDetails'
        }
      },
      {
        $project: {
          name: 1,
          productCount: {
            $size: {
              $filter: {
                input: "$productDetails",
                as: "product",
                cond: {
                  $in: [
                    "$_id",
                    {
                      $cond: {
                        if: { $isArray: "$$product.category" },
                        then: "$$product.category",
                        else: ["$$product.category"]
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    ]
    );

    // if (!data.length) {
    //     return res.status(404).json({ message: "Data not found!" });
    // }

    res.status(200).json({
      status: 'Success',
      message: "Categories fetched successfully",
      data: data
    });
  } catch (error) {
    res.status(500).json({
      status: "Failed",
      message: "Internal server error",
      error: error.message
    });
  }
};


exports.getCategoryById = async (req, res) => {

  try {
    const { categoryId } = req.params;

    const data = await Category.findOne({ _id: categoryId, createdBy: req.user }).select("-createdAt -updatedAt -__v");

    if (!data) {
      return res.status(200).json({ message: "Category not Found!!!" })
    }

    res.status(200).json({ status: 'Success', message: "Category Fetched Successfully", data: data })

  } catch (error) {
    console.log(error)
    res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error })
  }
}


exports.createCategory = async (req, res) => {

  try {
    const { categoryName } = req.params

    if (!categoryName) {
      return res.status(400).json({ message: 'Enter Category Name' });
    }

    //Finding Duplicate Entry
    let checkDuplicate = await Category.findOne({
      name: { $regex: new RegExp("^" + categoryName + "$", "i") }, createdBy: req.user
    })

    if (checkDuplicate) {
      return res.status(409).json({ status: "Failed", message: 'Duplicate Entry Found' })
    }

    const saveCategory = await Category.create({ name: categoryName, createdBy: req.user });


    res.status(201).json({ status: "Success", message: 'Category Saved Successfully', data: saveCategory });

  }
  catch (error) {
    res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error })

  }

}

exports.updateCategory = async (req, res) => {

  try {
    const { categoryId } = req.params;
    const { category } = req.body;

    if (!categoryId || !category) {
      return res.status(400).json({ message: 'All Fields are required' });
    }

    const updatedCategory = await Category.findOneAndUpdate({ _id: categoryId, createdBy: req.user },
      { name: category, updatedAt: Date.now() },
      { runValidators: true, new: true })

    if (!updatedCategory) {
      return res.status(404).json({ status: 'Failed', message: 'Category Not Found' });
    }

    res.status(200).json({ status: "Success", message: 'Category Updated Successfully', data: updatedCategory });

  }
  catch (error) {
    res.status(500).json({ status: "Failed", message: "Internal Server Error", error: error || error.message })

  }

}

exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate if categoryId is provided
    if (!categoryId) {
      return res.status(400).json({ status: 'Failed', message: 'Category ID is required' });
    }

    const isCategoryExist = await Category.findById(categoryId);

    if (!isCategoryExist) {
      return res.status(404).json({ status: 'Failed', message: 'Category Not Found' });
    }

    // Delete the category
    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({ status: 'Success', message: 'Category Deleted Successfully' });
  } catch (error) {

    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message
    });

  }
};

//on delete category remove categpry from product

//Add items to Category Controllers
exports.addItemsToCategory = async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let { category } = req.params;
    const { items } = req.body;
    console.log(items, 'Items')

    if (!category || typeof category !== "string") {
      return res.status(400).json({ status: 'Failed', message: 'Category is required and must be a string' });
    };

    if (!Array.isArray(items) || items.length === 0 || items.some(item => typeof item !== "string")) {
      return res.status(400).json({ status: "Failed", message: "Items must be a non-empty array of strings." });
    }

    const categoryDetails = await Category.findOne({
      createdBy: req.user,
      name: { $regex: new RegExp("^" + category + "$", "i") }
    });

    if (!categoryDetails) {
      return res.status(404).json({ status: 'Failed', message: 'Category Not Found' })
    };

    category = categoryDetails._id;

    // Find and update items in batch without Uisng loop or iteration
    const updateResult = await Products.updateMany(
      {
        createdBy: req.user,
        itemName: { $in: items.map(item => new RegExp("^" + item + "$", "i")) }
      },
      { $addToSet: { category: category } },
      { session }
    );

    if (updateResult.matchedCount !== items.length) {
      throw new Error(
        `Failed to update some items. Found: ${updateResult.matchedCount}, Expected: ${items.length}`
      );
    }

    // Commit the transaction
    await session.commitTransaction();
    res.status(200).json({
      status: "Success", message: "Category added to all specified items.",
      updatedCount: updateResult.modifiedCount
    })

  } catch (error) {

    // Rollback the transaction on error
    await session.abortTransaction();

    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message
    });

  }
};

exports.getItemsExcludingCategory = async (req, res) => {
  try {

    let { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({ status: "Failed", message: "Category ID is required." });
    };

    let items = await Products.find({
      createdBy: req.user,
      category: { $ne: categoryId }
    }).select('itemName');

    if (items.length === 0) {
      return res.status(404).json({ status: "Failed", message: "No items found excluding this category." });
    };

    res.status(200).json({
      status: "Success",
      message: "Items excluding the specified category retrieved successfully.",
      data: items
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message
    });

  };
};

exports.getItemsIncludingCategory = async (req, res) => {
  try {

    let { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({ status: "Failed", message: "Category ID is required." });
    };

    let items = await Products.find({
      createdBy: req.user,
      category: { $eq: categoryId }
    }).select('itemName');

    if (items.length === 0) {
      return res.status(404).json({ status: "Failed", message: "No items found including this category." });
    };

    res.status(200).json({
      status: "Success",
      message: "Items including the specified category retrieved successfully.",
      data: items
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message
    });

  };
};