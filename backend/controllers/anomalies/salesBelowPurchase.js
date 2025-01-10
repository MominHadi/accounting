let Sales = require("../../models/invoiceModel");
let Purchase = require("../../models/purchase/purchaseModel");
let formatDate=require("../../global/formatDate")

exports.detectSaleBelowPurchaseAnomalies = async (req, res) => {
    try {

        const sales = await Sales.find({ createdBy: req.user });
        const purchases = await Purchase.find({ createdBy: req.user });

        const anomalies = [];

        // Iterate through sale orders and purchases to compare prices
        sales.forEach(sale => {
            const saleTotalAmount = sale.totalAmount || 0;
            const salePartyName = sale.partyName || '';

            purchases.forEach(purchase => {
                if (purchase.partyName === salePartyName) {  // Compare by party name (you can adjust as per your matching criteria)
                    const purchaseTotalAmount = purchase.totalAmount || 0;

                    // Check if sale amount is less than purchase amount
                    if (saleTotalAmount < purchaseTotalAmount) {
                        anomalies.push({
                            sale_invoice_no: sale.invoiceNo,
                            invoice_date: formatDate(sale.invoiceDate),
                            purchase_bill_no: purchase.billNo,
                            date: formatDate(purchase.billDate),
                            sale_amount: saleTotalAmount,
                            purchase_amount: purchaseTotalAmount,
                            party: salePartyName
                        });
                    }
                }
            });
        });

        // return anomalies;
        res.status(200).json({data:anomalies});
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error...", error: error.message || error });
    }
}