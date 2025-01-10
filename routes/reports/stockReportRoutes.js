const Router = require('express').Router();
const { getStockSummaryReport } = require('../../controllers/reports/stock/stockSummary');
const { getItemByPartyReport } = require('../../controllers/reports/stock/itemReportByParty');
const { getLowStockSummary } = require('../../controllers/reports/stock/lowStockSummary');
const { getStockDetails } = require('../../controllers/reports/stock/stockDetailReport');
const { getStockSummaryByCategory } = require('../../controllers/reports/stock/stockSummaryByCategory');
const { getItemwiseDiscountReport, getDiscountDetailsForItem } = require('../../controllers/reports/stock/itemwiseDiscount');
const { generateItemProfitLossReport } = require('../../controllers/reports/stock/item-wise-Profit-Loss');
const { getSalePurchaseReportByItemCategory } = require('../../controllers/reports/stock/salePurchaseByItemCategory');
const { generateItemDetailsReport } = require('../../controllers/reports/stock/item-details');
const { verifyToken } = require("../../global/jwt");

Router.get('/summary', verifyToken, getStockSummaryReport);
Router.get('/itemByParty', verifyToken, getItemByPartyReport);
Router.get('/lowStockSummary', verifyToken, getLowStockSummary);
Router.get('/stockDetails', verifyToken, getStockDetails);
Router.get('/summary-by-category', verifyToken, getStockSummaryByCategory);
Router.get('/item-wise-discount', verifyToken, getItemwiseDiscountReport);
Router.get('/item-wise-discount/:itemId', verifyToken, getDiscountDetailsForItem);
Router.get('/itemwise-profit-loss', verifyToken, generateItemProfitLossReport);
Router.get('/sale-purchase-by-category', verifyToken, getSalePurchaseReportByItemCategory);
Router.get('/item-details', verifyToken, generateItemDetailsReport);

module.exports = Router;