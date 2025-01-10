const SaleOrders = require('../../../models/saleOrderModel');
const PurchaseOrders = require('../../../models/purchase/purchaseOrderModel');



exports.getOrderReport = async (req, res) => {
    try {
        let { fromDate, toDate, partyName, orderType, orderStatus } = req.query;

        if (!orderType || !['Sale', 'Purchase'].includes(orderType)) {
            return res.status(400).json({ status: 'Failed', message: "Valid Order type is required" })
        }

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "FromDate and toDate are required" })
        }
        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);


        let findConditions = {
            createdBy: req.user,
            orderDate: {
                $gte: startDate,
                $lte: endDate
            }
        };

        // Conditionally add partyName if it's provided
        if (partyName) {
            findConditions.partyName = partyName;
        };

        if (orderStatus) {
            findConditions.status = orderStatus?.toLowerCase() == 'open' ? 'Order Open' : 'Order Closed';
        };

        let orderDetails;

        if (orderType === 'Sale') {

            orderDetails = await SaleOrders.find(findConditions).sort({ orderDate: -1 }).select('orderName orderDate dueDate totalAmount advanceAmount status balanceAmount partyName');

        } else if (orderType === 'Purchase') {
            orderDetails = await PurchaseOrders.find(findConditions).sort({ orderDate: -1 }).select('orderName orderDate  dueDate totalAmount advanceAmount status balanceAmount partyName');;

        }

        return res.status(200).json({ status: 'Success', data: orderDetails });


    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}