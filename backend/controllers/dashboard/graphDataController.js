const Transactions = require('../../models/transactionModel');
const Sales = require('../../models/invoiceModel');
const mongoose = require('mongoose');

// exports.getSalesGraphData = async (req, res) => {

//     try {
//         let { months, years } = req.body;
//         let monthsArray = ["January", "February", "March", "April", "June",
//             'July', "August", "September", "October", "November", "December"];

//         // if (!duration) {
//         //     return res.status(400).json({ status: 'Failed', message: 'Duration is required' });
//         // };

//         // let dates = getDateRange(duration);
//         // console.log(dates, 'Dates');

//         let startDate;
//         let endDate;
//         // console.log(dates.length, `Dater Length`);

//         // if (dates.length) {
//         //     startDate = dates[0].startDate;


//         //     endDate = dates[dates.length - 1].endDate;
//         // };

//         // console.log(startDate, endDate, 'endDate')

//         let SalesTransactionList;
//         if (months) {
//             SalesTransactionList = await Transactions.aggregate([

//                 {
//                     $project: {
//                         month: { $month: "$transactionDate" }, // Extracting month from transactionDate]
//                         createdBy: 1,
//                         totalAmount: 1,
//                         transactionType: 1
//                     },
//                 },
//                 {
//                     $match: {
//                         month: { $in: months },
//                         createdBy: new mongoose.Types.ObjectId(req.user),
//                         transactionType: "Sale"
//                     },
//                 },
//                 {
//                     $group: {
//                         _id: "$month",
//                         totalSaleCount: { $sum: 1 },
//                         totalSalesAmount: { $sum: '$totalAmount' },
//                     },
//                 },
//                 {
//                     $sort: { _id: 1 }
//                 }]);

//             for (let data of SalesTransactionList) {
//                 data._id = monthsArray[data._id - 1]
//             };
//         } else if (years) {

//             if (years.length == 1) {
//                 let year = years[0];

//                 console.log(isValidYear(year), 'isValidYear(year)-0-0');


//                 if (!isValidYear(year)) {
//                     return res.status(400).json({ status: 'Failed', });
//                 }


//                 let firstDate = new Date(year, 0, 1);
//                 let lastDate = new Date(year, 11, 31);

//                 console.log(firstDate, lastDate, 'Last Date of seleted year')
//             }

//             var today = new Date();
//             var date = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1))

//         };



//         res.status(200).json({ message: "Sales Data Successfully Fetched for given Duration", data: SalesTransactionList })
//         // console.log(SalesTransactionList, 'Sales Transactions...');

//     }
//     catch (error) {
//         console.log(error);
//         res.status(500).json({
//             status: "Failed",
//             message: "Internal Server Error",
//             error: error.message || error
//         });
//     }
// };


// function getDateRange(selection, days = 0) {
//     const currentYear = new Date().getUTCFullYear();
//     const today = new Date();
//     let ranges = [];

//     if (Array.isArray(selection)) {
//         // Handle multiple months
//         ranges = selection.map(monthName => {
//             const monthIndex = new Date(`${monthName} 1, ${currentYear}`).getUTCMonth(); // Get the 0-indexed month
//             const startDate = new Date(Date.UTC(currentYear, monthIndex, 1)); // First day of the month in UTC
//             const endDate = new Date(Date.UTC(currentYear, monthIndex + 1, 0, 23, 59, 59, 999)); // Last day of the month in UTC
//             return { month: monthName, startDate, endDate };
//         });
//     } else if (selection === 'thisYear') {
//         // Handle the entire year
//         ranges.push({
//             year: currentYear,
//             startDate: new Date(Date.UTC(currentYear, 0, 1)), // January 1st
//             endDate: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999)), // December 31st
//         });
//     } else if (selection === 'day') {
//         // Handle day-based selection
//         if (days === 0 || days === 1) {
//             // Default: Today's data
//             const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); // Midnight today in UTC
//             const endDate = new Date(); // Now
//             ranges.push({ period: 'Today', startDate, endDate });
//         } else if (days > 1 && days <= 6) {
//             // Last N days
//             const startDate = new Date();
//             startDate.setUTCDate(today.getUTCDate() - (days - 1)); // Subtract (days-1)
//             startDate.setUTCHours(0, 0, 0, 0); // Start of the range in UTC

//             const endDate = new Date(today.setUTCHours(23, 59, 59, 999)); // End of today in UTC
//             ranges.push({ period: `${days} Days`, startDate, endDate });
//         } else {
//             throw new Error("For 'day' selection, valid range is 1-6 days.");
//         }
//     } else {
//         // Handle single month
//         // Handle single month
//         const monthIndex = new Date(`${selection} 1, ${currentYear}`).getMonth(); // Correct month index
//         ranges.push({
//             month: selection,
//             startDate: new Date(Date.UTC(currentYear, monthIndex, 1, 0, 0, 0)), // Start of the month in UTC
//             endDate: new Date(Date.UTC(currentYear, monthIndex + 1, 0, 23, 59, 59, 999)), // End of the month in UTC
//         });

//     }

//     return ranges;
// }



// function isValidYear(yearString) {

//     const year = parseInt(yearString);

//     return (year > 0 && year <= 9999);

// }

const moment = require('moment');

exports.getSalesGraphData = async (req, res) => {
    try {
        let { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" });
        }

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        // Generate all dates between fromDate and toDate
        let datesArray = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            datesArray.push(moment(currentDate).format('DD/MM/YYYY'));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log("Generated Date Range:", datesArray);

        // MongoDB aggregation
        let salesTransactions = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    transactionType: 'Sale',
                    transactionDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: '$transactionDate',
                    numberOfSales: { $sum: 1 },
                    totalSalesAmount: { $sum: '$totalAmount' }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: "%d/%m/%Y",
                            date: "$_id"
                        }
                    },
                    numberOfSales: 1,
                    totalSalesAmount: 1
                }
            }
        ]);

        console.log("Raw Sales Transactions:", salesTransactions);

        // Map the returned data by date
        let transactionsMap = new Map();
        salesTransactions.forEach(tx => {
            console.log("Mapping:", tx);
            transactionsMap.set(tx.date, tx);
        });

        // Merge missing dates with 0 sales data
        let finalData = datesArray.map(date => {
            if (transactionsMap.has(date)) {
                console.log("Using existing data for date:", date);
                return transactionsMap.get(date);
            }
            console.log("Adding zero data for date:", date);
            return {
                date,
                numberOfSales: 0,
                totalSalesAmount: 0
            };
        });

        console.log("Final Data to Respond:", finalData);

        // Respond with the completed data
        res.status(200).json({
            status: "Success",
            message: `Sales Transactions Fetched between ${fromDate} - ${toDate}`,
            data: finalData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};
