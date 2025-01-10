const Sale = require('../models/invoiceModel');
const Purchase = require("../models/purchase/purchaseModel");
const PaymentIn = require("../models/paymentInModel");
const Expense = require("../models/purchase/expenseModel");
const PaymentOut = require("../models/purchase/paymentOutModel");
const mongoose = require('mongoose');


exports.fetchData = async (id, documentType) => {
    let data;

    switch (documentType.toLowerCase()) {
        case 'sale':
            data = await Sale.findById(id)
                .populate('items.itemId', 'itemName itemHsn')
                .populate('items.unit', 'name shortName')
                .populate('items.taxPercent')
                .populate('party', 'name billingAddress shippingAddress contactDetails gstIn')
                .select('-__v -createdAt -updatedAt');
            break;
        case 'purchase':
            data = await Purchase.findById(id)
                .populate('items.itemId', 'itemName itemHsn')
                .populate('items.unit', 'name shortName')
                .populate('items.taxPercent')
                .populate('party', 'name billingAddress shippingAddress contactDetails gstIn')
                .select('-__v -createdAt -updatedAt');
            break;
        case 'paymentin':
            data = await PaymentIn.findById(id).populate('party', 'name billingAddress shippingAddress contactDetails gstIn').select('-__v -createdAt -updatedAt');
            break;
        case 'paymentout':
            data = await PaymentOut.findById(id).populate('party', 'name billingAddress shippingAddress contactDetails gstIn').select('-__v -createdAt -updatedAt');
            break;
        case 'expense':
            data = await Expense.findById(id).populate('party', 'name contactDetails').populate('items.itemId').select('-__v -createdAt -updatedAt');
            break;
        default:
            throw new Error(`Unsupported document type: ${documentType}`)
    }




    return data;

}