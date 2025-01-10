const { createBillStream } = require('./invoicePdf');
const { fetchData } = require('./fetchData');
const { createExpensePdfStream } = require('./expensePdf');

const formatDate = require("../global/formatDate");

exports.generatePdf = async (req, res) => {
    try {

        let { id, documentType } = req.query;

        // Validate inputs
        if (!id || !documentType) {
            return res.status(400).json({ error: 'Invalid Query parameters. id and documentType are required.' });
        };

        let documentData = await fetchData(id, documentType);

        if (!documentData) return res.status(404).json({ status: "Failed", message: 'Data not Found' });

        if (documentData) {
            documentData = documentData.toObject();
        };

        documentData.businessProfile = req.businessProfile;

        if (documentType.toLowerCase() == 'sale') {
            documentData.items = documentData.items.map(item => {
                const { quantity, price, mrp, taxPercent } = item;
                const valueWithoutTax = (price > 0 ? price : mrp) * quantity;
                let taxRate = taxPercent ? taxPercent.rate : 0;
                let taxValue = (valueWithoutTax * taxRate) / 100

                return { ...item, valueWithoutTax: parseFloat(valueWithoutTax).toFixed(2), taxAmount: parseFloat(taxValue).toFixed(2) };
            });
        } else if (documentType.toLowerCase() == 'purchase') {
            documentData.items = documentData.items.map(item => {
                const { quantity, price,taxPercent } = item;
                const valueWithoutTax = price * quantity;
                let taxRate = taxPercent ? taxPercent.rate : 0;
                let taxValue = (valueWithoutTax * taxRate) / 100

                return { ...item, valueWithoutTax: parseFloat(valueWithoutTax).toFixed(2), taxAmount: parseFloat(taxValue).toFixed(2) };
            });
        }
        // else if (documentType.toLowerCase() == 'purchase') {
        //     documentData.billDate = formatDate(documentData.billDate);
        // }

        return res.status(200).json({ message: `Data Successfully Fetched For ${documentType}-${id}`, data: documentData });
        // let pdfStream;
        // switch (documentType.toLowerCase()) {
        //     case 'sale':
        //         pdfStream = createBillStream(documentData, documentType, req);
        //         break;
        //     case 'purchase':
        //         pdfStream = createBillStream(documentData, documentType, req);
        //         break;
        //     case 'paymentin':
        //         pdfStream = createBillStream(documentData, documentType, req);
        //         break;
        //     case 'paymentout':
        //         pdfStream = createBillStream(documentData, documentType, req);
        //         break;
        //     case 'expense':
        //         pdfStream = createExpensePdfStream(documentData, documentType, req);
        //         break;
        //     default:
        //         return res.status(400).json({ error: `Unsupported document type: ${documentType}` });
        // };

        // // Send the PDF in response
        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename="${documentType}-${id}.pdf"`);
        // pdfStream.pipe(res);

        // // Handle stream errors
        // pdfStream.on('error', (err) => {
        //     console.error('Error generating PDF:', err);
        //     res.status(500).send('Error generating PDF');
        // });

    }
    catch (error) {
        console.log(error, 'Error');
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}   