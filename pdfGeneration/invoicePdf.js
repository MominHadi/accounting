const PDFDocument = require('pdfkit');
const { toTitleCase, inWords } = require('../global/commonCode');
const formatDate = require('../global/formatDate');
const path = require('path');
let spaceFromTop = 0;
let businessProfile;
let documentType;
let printSettings;
let termsAndCondition = "";
let currency = '₹';
let currencyInWord = 'Rupees';
let showBankDetails = false;
let totalAndTaxes;
let companyFontSize = 10;

// Draw borders function
const drawRectangle = (doc, x, y, width, height, color) => {
    if (color)
        doc.rect(x, y, width, height).fill(color).stroke();
    else
        doc.rect(x, y, width, height).stroke();
};


const setDocumentTitle = (documentType) => {
    let documentTitle = ''
    switch (documentType.toLowerCase()) {
        case 'sale':
            documentTitle = printSettings.transactionNames.sale;
            termsAndCondition = printSettings.footer?.termsAndCondtion?.saleInvoice;
            break;
        case 'purchase':
            documentTitle = printSettings.transactionNames.purchase;
            termsAndCondition = printSettings.footer?.termsAndCondtion?.purchaseBill;

            break;
        case 'paymentin':
            documentTitle = printSettings.transactionNames.paymentIn;
            break;
        case 'paymentout':
            documentTitle = printSettings.transactionNames.paymentOut;
            break;
        default:
            documentTitle = printSettings.transactionNames.sale;
    };

    return documentTitle;
};


const createBillStream = (documentData, documentTypes, req) => {

    documentType = documentTypes;
    printSettings = req.printSettings;
    businessProfile = req.businessProfile;

    totalAndTaxes = printSettings?.totalAndTaxes;
    // printSettings.transactionNames;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    doc.registerFont('NotoSans', path.join(__dirname, '..', 'assets', 'fonts', 'Noto_Sans', 'static', 'NotoSans-Bold.ttf'));

    // Header Section
    //Heading
    doc.fontSize(16).font('Helvetica-Bold').text(setDocumentTitle(documentType), { align: 'center' });
    doc.moveDown(1);

    const startX = 48;
    spaceFromTop = doc.y;

    const startXRect = 40;

    //Company Name Section
    generateCompanyNameSection(doc, startX, startXRect, documentData);

    //Invoice Details Header
    generateDocumentHeaderSection(doc, startX, startXRect, documentData);

    // Item Detail Section
    if (documentType.toLowerCase() != 'paymentin' && documentType.toLowerCase() != 'paymentout') {
        spaceFromTop = spaceFromTop + 60;
        generateItemDetails(doc, startX, startXRect, documentData?.items);
    } else {
        spaceFromTop = spaceFromTop + 50;

    }

    //Calculation Summary Section
    if (documentType.toLowerCase() == 'paymentin' || documentType.toLowerCase() == 'paymentout')
        generatePaymentSummarySection(doc, startX, startXRect, documentData);

    else
        generateInvoiceSummarySection(doc, startX, startXRect, documentData);

    checkNewPageCondition(doc);

    // -----------------------------------------------------------------------
    // Footer

    spaceFromTop += 8;
    //Terms And Condition
    if (documentType.toLowerCase() != 'paymentin' && documentType.toLowerCase() != 'paymentout') generateTermsAndConditionSection(doc, startX, startXRect);

    createHorizontalLine(doc, startXRect, spaceFromTop, 560);

    //For bank details and signature

    //will be conditional

    if (showBankDetails) {
        drawRectangle(doc, startXRect, spaceFromTop, 260, 20, '#ECEBDE');
        createText(doc, 10, 'black', 'Helvetica-Bold', 'Bank Details:', startX, spaceFromTop + 6);
        drawRectangle(doc, startXRect, spaceFromTop, 260, 20);
    };

    if (printSettings.footer?.showSignatureText) {
        drawRectangle(doc, startXRect + 261, spaceFromTop, 259, 20, '#ECEBDE');
        createText(doc, 10, 'black', 'Helvetica-Bold', `For ${businessProfile?.businessName}:`, startX + 264, spaceFromTop + 6);
        drawRectangle(doc, startXRect + 261, spaceFromTop, 259, 20);

        checkNewPageCondition(doc);
    };

    //Bank Account rectangle

    createVerticalLine(doc, startXRect, spaceFromTop + 2, spaceFromTop + 90, 0);
    checkNewPageCondition(doc);
    createHorizontalLine(doc, startXRect, spaceFromTop + 90, 300);
    checkNewPageCondition(doc);
    createVerticalLine(doc, startXRect + 261, spaceFromTop + 2, spaceFromTop + 90, 0);

    //signature box
    if (printSettings.footer?.showSignatureText) {
        createVerticalLine(doc, startXRect + 261, spaceFromTop + 2, spaceFromTop + 90, 0);
        checkNewPageCondition(doc);
        createHorizontalLine(doc, startXRect + 261, spaceFromTop + 90, 560);
        checkNewPageCondition(doc);
        createVerticalLine(doc, startXRect + 520, spaceFromTop + 2, spaceFromTop + 90, 0);
        checkNewPageCondition(doc)
    }

    spaceFromTop += 10

    checkNewPageCondition(doc)


    //Signature Section
    console.log(printSettings.footer?.showSignatureText, 'printSettings?.showSignatureText')
    if (printSettings.footer?.showSignatureText) {
        //signature box
        // createVerticalLine(doc, startXRect + 290, spaceFromTop + 20, spaceFromTop + 70, 0);
        // checkNewPageCondition(doc);
        // createHorizontalLine(doc, startXRect + 290, spaceFromTop + 20, 400);
        // checkNewPageCondition(doc);
        // createVerticalLine(doc, startXRect + 400, spaceFromTop + 20, spaceFromTop + 70, 0);
        // checkNewPageCondition(doc);
        // createHorizontalLine(doc, startXRect + 290, spaceFromTop + 70, 400);

        doc.rect(startXRect + 320, spaceFromTop + 17, 140, 45).stroke('#D6CFB4');

        checkNewPageCondition(doc);

        createText(doc, 10, 'black', 'Helvetica-Bold', `${printSettings.footer?.signatureText}`, startX + 334, spaceFromTop + 68, { align: 'right' });

    }


    //Bank Details

    // doc
    //     .text('Thank you for doing business with us.', startX, spaceFromTop + 20)
    //     .text('Bank Details:', startX, spaceFromTop + 50)
    //     .text('Account No.: UU', startX, spaceFromTop + 65)
    //     .text('For Abdul Hadi Momin:', startX + 300, spaceFromTop + 50);

    // drawRectangle(doc, startX, spaceFromTop + 40, 240, 50); // Bank Details Box
    // drawRectangle(doc, startX + 300, spaceFromTop + 40, 240, 50); // Signature Box
    // doc.text('Authorized Signatory', startX + 310, spaceFromTop + 80);

    doc.end();
    return doc;
};

const createText = (doc, fontSize, color, font, text, startX, y, alignmentProperties) => {
    alignmentProperties ? doc.fontSize(fontSize).fillColor(color).font(font).text(text, startX, y, alignmentProperties) : doc.fontSize(fontSize).fillColor(color).font(font).text(text, startX, y);
};

const createVerticalLine = (doc, startX, y, end, index) => {
    if (index == 0) {
        doc.moveTo(startX, y - 4)
            .lineTo(startX, end)
            .stroke();
    }
};

const createHorizontalLine = (doc, startX, y, endX) => {
    doc.moveTo(startX, y)
        .lineTo(endX, y)
        .stroke();
};

const checkNewPageCondition = (doc) => {
    if (spaceFromTop > 795) {
        doc.addPage();
        spaceFromTop = 20;
    };
};

const generateCompanyNameSection = (doc, startX, startXRect) => {

    let pathToLogo = '';
    let existingLogo = false
    existingLogo = businessProfile?.logo ? true : false;

    let spaceFromLeft = existingLogo ? 130 : startX;

    if (existingLogo) {
        pathToLogo = path.join(__dirname, '..', 'tmp', 'images', businessProfile?.logo);

        doc.image(pathToLogo, startX, spaceFromTop + 5, { height: 50, width: 80 });
    };

    doc.fontSize(16).fillColor('grey').text(businessProfile?.businessName, existingLogo ? spaceFromLeft + 20 : spaceFromLeft, spaceFromTop + 5);
    doc.fontSize(9).font('Helvetica').fillColor('black').text(businessProfile?.businessAddress, existingLogo ? spaceFromLeft + 20 : spaceFromLeft, spaceFromTop + 21);

    if (businessProfile?.businessAddress) {
        createText(doc, 10, 'grey', 'Helvetica', 'Phone:', existingLogo ? spaceFromLeft + 20 : spaceFromLeft, spaceFromTop + 37);
        createText(doc, 10, 'black', 'Helvetica', '7387170010', existingLogo ? spaceFromLeft + 60 : spaceFromLeft + 39, spaceFromTop + 37);
        createText(doc, 10, 'grey', 'Helvetica', 'Email:', spaceFromLeft + 260, spaceFromTop + 37);
        createText(doc, 10, 'black', 'Helvetica-Bold', businessProfile?.email, spaceFromLeft + 290, spaceFromTop + 37);

    } else {
        createText(doc, 10, 'grey', 'Helvetica', 'Phone:', spaceFromLeft, spaceFromTop + 25);
        createText(doc, 10, 'black', 'Helvetica-Bold', '7387170010', spaceFromLeft + 39, spaceFromTop + 25);
        createText(doc, 10, 'grey', 'Helvetica', 'Email:', spaceFromLeft + 260, spaceFromTop + 25);
        createText(doc, 10, 'black', 'Helvetica-Bold', businessProfile?.email, spaceFromLeft + 290, spaceFromTop + 25);

    }
    existingLogo ?
        drawRectangle(doc, startXRect, spaceFromTop, 520, 70) : drawRectangle(doc, startXRect, spaceFromTop, 520, 50);

    //Spacing between
    spaceFromTop = existingLogo ? spaceFromTop + 80 : spaceFromTop + 60;
};


const generateDocumentHeaderSection = (doc, startX, startXRect, documentData) => {

    let documentNo;
    let documentDate;
    switch (documentType.toLowerCase()) {
        case 'sale':
            documentNo = documentData?.invoiceNo;
            documentDate = formatDate(documentData?.invoiceDate);
            break;
        case 'purchase':
            documentNo = documentData?.billNo;
            documentDate = formatDate(documentData?.billDate);
            break;
        case 'paymentin':
            documentNo = documentData?.receiptNo;
            documentDate = formatDate(documentData?.date);
            break;
        case 'paymentout':
            documentNo = documentData?.receiptNo;
            documentDate = formatDate(documentData?.date);
            break;
        default:
            console.log('Abc');
    };
    drawRectangle(doc, startXRect, spaceFromTop - 10, 520, 20, '#ECEBDE');

    if (documentType.toLowerCase() === 'sale') {
        doc.fillColor('black').text('Bill To:', startX, spaceFromTop - 4)
            .text('Invoice Details:', startX + 260, spaceFromTop - 4);
    } else if (documentType.toLowerCase() === 'purchase') {
        doc.fillColor('black').text('Bill From:', startX, spaceFromTop - 4)
            .text('Bill Details:', startX + 260, spaceFromTop - 4);
    } else if (documentType.toLowerCase() === 'paymentin') {
        doc.fillColor('black').text('Received From:', startX, spaceFromTop - 4)
            .text('Receipt Details:', startX + 260, spaceFromTop - 4);
    } else if (documentType.toLowerCase() === 'paymentout') {
        doc.fillColor('black').text('Paid To:', startX, spaceFromTop - 4)
            .text('Receipt Details:', startX + 260, spaceFromTop - 4);
    }
    createHorizontalLine(doc, startXRect, spaceFromTop + 8, 560);

    let partyName = '';

    //PartyName
    if (documentData?.partyName) partyName = toTitleCase(documentData?.partyName);

    createText(doc, 10, 'black', 'Helvetica-Bold', partyName, startX, spaceFromTop + 15);
    //Invoice No
    createText(doc, 10, 'grey', 'Helvetica', 'No:', startX + 260, spaceFromTop + 15);
    createText(doc, 10, 'black', 'Helvetica-Bold', documentNo, startX + 287, spaceFromTop + 15);



    //Phone No:

    if (documentData?.phoneNo) {
        createText(doc, 10, 'grey', 'Helvetica', 'Phone No. :', startX, spaceFromTop + 30);
        createText(doc, 10, 'black', 'Helvetica-Bold', documentData?.phoneNo, startX + 54, spaceFromTop + 30);
    }

    //Invoice Date
    createText(doc, 10, 'grey', 'Helvetica', 'Date:', startX + 260, spaceFromTop + 30);
    createText(doc, 10, 'black', 'Helvetica-Bold', documentDate, startX + 287, spaceFromTop + 30);

    drawRectangle(doc, startXRect, spaceFromTop - 10, 260, 50); // Billing Details Box
    drawRectangle(doc, startXRect + 260, spaceFromTop - 10, 260, 50); // Invoice Details Box
};


const generateInvoiceSummarySection = (doc, startX, startXRect, documentData) => {

    //new section
    let AmountinWords = `${toTitleCase(inWords(documentData?.totalAmount))} ${currencyInWord} only`;
    // let AmountinWords = `Seventeen Thousand Seven Hundred And Ninety Four Decimal Five Six sdyntu`;
    // console.log(AmountinWords.length, 'mountinWords.length');
    // console.log('Seventeen Thousand Seven Hundred And Ninety Four Decimal Five Six Only Rupees only', 'mountinWords.length');

    //main rectangle
    // Adjusting the size of rectange according to size of (amount in words)
    if (AmountinWords.length > 72) {
        console.log('called-0')

        createVerticalLine(doc, startXRect, spaceFromTop - 6, spaceFromTop + 138, 0);
        checkNewPageCondition(doc);
        createVerticalLine(doc, 560, spaceFromTop - 6, spaceFromTop + 138, 0);
        checkNewPageCondition(doc);
    }
    else if (AmountinWords.length > 28 && AmountinWords.length < 72) {
        console.log('called1')
        createVerticalLine(doc, startXRect, spaceFromTop - 6, spaceFromTop + 128, 0);
        checkNewPageCondition(doc);
        createVerticalLine(doc, 560, spaceFromTop - 6, spaceFromTop + 128, 0);
        checkNewPageCondition(doc);
    } else {
        console.log('called3')

        createVerticalLine(doc, startXRect, spaceFromTop - 6, spaceFromTop + 118, 0);
        checkNewPageCondition(doc);
        createVerticalLine(doc, 560, spaceFromTop - 6, spaceFromTop + 118, 0);
        checkNewPageCondition(doc);
    }

    // Summary Section

    createText(doc, 10, 'black', 'Helvetica', 'Sub Total', startX + 324, spaceFromTop - 4);
    //Showing Selected  Currency
    let currencyFontSize = 0;
    currency.length > 1 ? currencyFontSize = 11 : currencyFontSize = 12;
    createText(doc, currencyFontSize, 'black', 'NotoSans', currency, startX + 440, spaceFromTop - 10, { align: 'left' });
    createText(doc, 10, 'black', 'Helvetica-Bold', parseFloat(documentData?.totalAmount).toFixed(2), startX + 456, spaceFromTop - 4, { align: 'left', width: 60 });
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 15, 0);
    createHorizontalLine(doc, 365, spaceFromTop + 9, 560);
    checkNewPageCondition(doc);

    spaceFromTop += 20
    checkNewPageCondition(doc);

    createText(doc, 10, 'black', 'Helvetica-Bold', 'Total', startX + 324, spaceFromTop - 4);
    createText(doc, 10, 'black', 'Helvetica-Bold', 'Total', startX + 324, spaceFromTop - 4);
    createText(doc, currencyFontSize, 'black', 'NotoSans', currency, startX + 440, spaceFromTop - 10, { align: 'left' });
    createText(doc, 10, 'black', 'Helvetica-Bold', parseFloat(documentData?.totalAmount).toFixed(2), startX + 456, spaceFromTop - 4, { align: 'left', width: 60 });
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 14, 0);
    createHorizontalLine(doc, 365, spaceFromTop + 9, 560);

    checkNewPageCondition(doc);
    spaceFromTop += 20;
    checkNewPageCondition(doc);

    drawRectangle(doc, 365, spaceFromTop - 10, 195, 20, '#ECEBDE');
    let text = '';

    if (documentType.toLowerCase() === 'sale') text = 'Invoice Amount in Words'
    else if (documentType.toLowerCase() === 'purchase') text = 'Bill Amount in Words'
    createText(doc, 10, 'black', 'Helvetica-Bold', text, startX + 324, spaceFromTop - 4);
    // drawRectangle(doc, 365, spaceFromTop - 10, 195, 20);
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 14, 0);
    // createHorizontalLine(doc, 365, spaceFromTop + 9, 560);;

    checkNewPageCondition(doc);
    spaceFromTop += 20;
    checkNewPageCondition(doc);

    createHorizontalLine(doc, 365, spaceFromTop - 11, 560);

    //Amount in words
    createText(doc, 10, 'black', 'Helvetica', AmountinWords, startX + 324, spaceFromTop - 4);

    //Here box  is adjusted according to the size of the Amount In words text
    if (AmountinWords.length > 72) {

        createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 30, 0);
        createHorizontalLine(doc, 365, spaceFromTop + 29, 560);
        checkNewPageCondition(doc);
        spaceFromTop += 40
        checkNewPageCondition(doc);

    } else if (AmountinWords.length > 28 && AmountinWords.length < 72) {

        createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 19, 0);
        createHorizontalLine(doc, 365, spaceFromTop + 19, 560);
        checkNewPageCondition(doc);
        spaceFromTop += 30
        checkNewPageCondition(doc);

    } else {
        createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 15, 0);
        createHorizontalLine(doc, 365, spaceFromTop + 9, 560);
        checkNewPageCondition(doc);
        spaceFromTop += 20
        checkNewPageCondition(doc);
    };

    if (documentType.toLowerCase() == 'purchase') {
        createText(doc, 10, 'black', 'Helvetica', 'Paid', startX + 324, spaceFromTop - 4);
        createText(doc, currencyFontSize, 'black', 'NotoSans', currency, startX + 440, spaceFromTop - 10, { align: 'left' });
        createText(doc, 10, 'black', 'Helvetica', parseFloat(documentData?.paidAmount).toFixed(2), startX + 456, spaceFromTop - 4, { align: 'left', width: 60 })
    } else {
        createText(doc, 10, 'black', 'Helvetica', 'Received', startX + 324, spaceFromTop - 4);
        createText(doc, currencyFontSize, 'black', 'NotoSans', currency, startX + 440, spaceFromTop - 10, { align: 'left' });
        createText(doc, 10, 'black', 'Helvetica', parseFloat(documentData?.receivedAmount).toFixed(2), startX + 456, spaceFromTop - 4, { align: 'left', width: 60 });
    }

    createText(doc, 10, 'black', 'Helvetica', 'Balance', startX + 324, spaceFromTop + 17);
    createText(doc, currencyFontSize, 'black', 'NotoSans', currency, startX + 440, spaceFromTop + 13, { align: 'left' });
    createText(doc, 10, 'black', 'Helvetica', parseFloat(documentData?.balanceAmount).toFixed(2), startX + 456, spaceFromTop + 17, { align: 'left', width: 60 });
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 35, 0);

    checkNewPageCondition(doc);
    spaceFromTop += 40
    checkNewPageCondition(doc);

    //final horizontal divieder
    createHorizontalLine(doc, startXRect, spaceFromTop - 2, 560);
};

const generateItemDetails = (doc, startX, startXRect, items) => {

    if (items.length > 0) {
        const columnHeaders = ['#', 'Item Name', 'HSN/SAC', 'Quantity', `Price/Unit (${currency})`, `Amount (${currency})`];
        const columnWidths = [30, 150, 70, 70, 100, 100];
        let x = startX;
        columnHeaders.forEach((header, index) => {
            doc.font('NotoSans').text(header, x, spaceFromTop, { align: 'left' });
            x += columnWidths[index];
        });

        let rowLeft = startXRect;
        columnWidths.forEach((width) => {
            createVerticalLine(doc, rowLeft, spaceFromTop, spaceFromTop + 21, 0)
            rowLeft += width;
        });

        drawRectangle(doc, startXRect, spaceFromTop - 5, 520, 25); // Table header border

        // Table Rows   

        spaceFromTop = spaceFromTop + 25;

        items.forEach((item, i) => {
            let itemName = item?.itemId?.itemName;

            const row = [i + 1, toTitleCase(itemName), item?.itemId?.itemHsn, item.quantity, ` ${item.price.toFixed(2)}`, ` ${item.finalAmount.toFixed(2)}`];
            let x = startX;
            row.forEach((col, index) => {
                doc.text(col, x, spaceFromTop);
                x += columnWidths[index];
            });

            let rowLeft = startXRect;
            columnWidths.forEach((width) => {
                createVerticalLine(doc, rowLeft, spaceFromTop, spaceFromTop + 16, 0)
                rowLeft += width;
            });

            createVerticalLine(doc, startXRect + 520, spaceFromTop, spaceFromTop + 16, 0);
            createHorizontalLine(doc, startXRect, spaceFromTop + 14, 560);

            checkNewPageCondition(doc)
            spaceFromTop += 20;
            checkNewPageCondition(doc)
        });


        // Total Row
        doc.text('Total', startX + 31, spaceFromTop)
            .text(` ${items.reduce((sum, item) => sum + item.finalAmount, 0).toFixed(2)}`, startX + 420, spaceFromTop);

        createVerticalLine(doc, startXRect + 520, spaceFromTop, spaceFromTop + 16, 0);

        let totalRowLeft = startXRect;
        columnWidths.forEach((width) => {
            createVerticalLine(doc, totalRowLeft, spaceFromTop, spaceFromTop + 12, 0)
            totalRowLeft += width;
        });

        spaceFromTop += 21;
    }


    //Horizontal Line between table and  sub total
    createHorizontalLine(doc, startXRect, spaceFromTop - 10, 560);

}


const generateTermsAndConditionSection = (doc, startX, startXRect) => {

    const lineCount = termsAndCondition.split('\n');
    if (lineCount[0] === '') return;

    drawRectangle(doc, startXRect, spaceFromTop, 520, 20, '#ECEBDE');
    createText(doc, 10, 'black', 'Helvetica-Bold', 'Terms And Conditions:', startX, spaceFromTop + 6);
    checkNewPageCondition(doc);
    drawRectangle(doc, startXRect, spaceFromTop, 520, 20);
    spaceFromTop += 14;


    for (const condition of lineCount) {
        createText(doc, 11, 'black', 'Helvetica-Bold', condition, startX, spaceFromTop + 12);

        spaceFromTop += 15;
        checkNewPageCondition(doc);

        createVerticalLine(doc, startXRect, spaceFromTop - 5, spaceFromTop + 15, 0);
        checkNewPageCondition(doc);

        createVerticalLine(doc, startXRect + 520, spaceFromTop - 5, spaceFromTop + 15, 0);
        checkNewPageCondition(doc);

    };

    spaceFromTop += 15
};



const generatePaymentSummarySection = (doc, startX, startXRect, documentData) => {

    //new section
    let AmountinWords = documentType.toLowerCase() === 'paymentin' ?
        `${toTitleCase(inWords(documentData?.receivedAmount))} ${currencyInWord} only` :
        `${toTitleCase(inWords(documentData?.paidAmount))} ${currencyInWord} only`;

    //main rectangle
    console.log(AmountinWords.length, 'mountinWords.length');
    // Adjusting the size of box according to size of (amount in words)
    if (AmountinWords.length > 28) {
        createVerticalLine(doc, startXRect, spaceFromTop - 6, spaceFromTop + 128, 0);
        checkNewPageCondition(doc);
        createVerticalLine(doc, 560, spaceFromTop - 6, spaceFromTop + 128, 0);
        checkNewPageCondition(doc);
    } else {
        createVerticalLine(doc, startXRect, spaceFromTop - 6, spaceFromTop + 118, 0);
        checkNewPageCondition(doc);
        createVerticalLine(doc, 560, spaceFromTop - 6, spaceFromTop + 118, 0);
        checkNewPageCondition(doc);
    }

    // Summary Section

    createText(doc, 10, 'black', 'Helvetica', documentType.toLowerCase() === 'paymentin' ? "Received" : "Paid", startX + 324, spaceFromTop - 4);
    createText(doc, 10, 'black', 'Helvetica', documentType.toLowerCase() === 'paymentin' ? parseFloat(documentData?.receivedAmount).toFixed(2) : parseFloat(documentData?.paidAmount).toFixed(2), startX + 478, spaceFromTop - 4, { align: 'right' });
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 15, 0);
    createHorizontalLine(doc, 365, spaceFromTop + 9, 560);
    checkNewPageCondition(doc);

    spaceFromTop += 20
    checkNewPageCondition(doc);

    createText(doc, 10, 'black', 'Helvetica-Bold', 'Total', startX + 324, spaceFromTop - 4);
    createText(doc, 10, 'black', 'Helvetica-Bold', documentType.toLowerCase() === 'paymentin' ? parseFloat(documentData?.receivedAmount).toFixed(2) : parseFloat(documentData?.paidAmount).toFixed(2), startX + 478, spaceFromTop - 4, { align: "right" });
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 14, 0);
    createHorizontalLine(doc, 365, spaceFromTop + 9, 560);

    checkNewPageCondition(doc);
    spaceFromTop += 20;
    checkNewPageCondition(doc);

    drawRectangle(doc, 365, spaceFromTop - 10, 195, 20, '#ECEBDE');

    createText(doc, 10, 'black', 'Helvetica-Bold', 'Amount in Words', startX + 324, spaceFromTop - 4);
    // drawRectangle(doc, 365, spaceFromTop - 10, 195, 20);
    createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 14, 0);

    checkNewPageCondition(doc);
    spaceFromTop += 20;
    checkNewPageCondition(doc);

    createHorizontalLine(doc, 365, spaceFromTop - 11, 560);

    //Amount in words
    createText(doc, 10, 'black', 'Helvetica', AmountinWords, startX + 324, spaceFromTop - 4);

    //Here box  is adjusted according to the size of the Amount In words text
    if (AmountinWords.length > 28) {

        createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 19, 0);
        createHorizontalLine(doc, 365, spaceFromTop + 19, 560);
        checkNewPageCondition(doc);
        spaceFromTop += 28
        checkNewPageCondition(doc);

    } else {
        createVerticalLine(doc, 365, spaceFromTop - 7, spaceFromTop + 15, 0);
        createHorizontalLine(doc, 365, spaceFromTop + 9, 560);
        checkNewPageCondition(doc);
        spaceFromTop += 17
        checkNewPageCondition(doc);
    };

    // spaceFromTop += 40
    checkNewPageCondition(doc);

    //final horizontal divieder
    createHorizontalLine(doc, startXRect, spaceFromTop - 2, 560);
};

module.exports = { createBillStream };
