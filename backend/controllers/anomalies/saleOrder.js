let SaleOrders = require("../../models/saleOrderModel");


exports.detectSaleOrderAnomalies = async (req, res) => {
    try {
        let anomalies = [];

        let saleOrders = await SaleOrders.find({ createdBy: req.user }).populate('createdBy');


        for (const document of saleOrders) {
            const docId = document._id;

            if (document.totalAmount < 0) {
                anomalies.push({ _id: docId, issue: "Negative total amount" });
            }

            if (document.balanceAmount < 0) {
                anomalies.push({ _id: docId, issue: "Negative balance amount" });
            }

            if (new Date(document.dueDate) < new Date(document.orderDate)) {
                anomalies.push({ _id: docId, issue: "Due date is earlier than order date" });
            };

            if (!["Order Open", "Order Closed", "Order Cancelled"].includes(document.status)) {
                anomalies.push({ _id: docId, issue: "Invalid status value" });
            }

            for (const payment of document.paymentMethod || []) {
                if (payment.amount <= 0) {
                    anomalies.push({ _id: docId, issue: "Invalid payment amount" });
                }
            }
        }


        return res.status(200).json({ status: 'Succcess', data: anomalies })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error...", error: error.message || error });
    }
}