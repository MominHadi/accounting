// utils/chequeUtils.js
const Cheque = require('../models/chequeModel');
const ChequeTransfer = require('../models/chequeTransferModel');


const createCheque = async (chequeData, session) => {
    const newCheque = new Cheque(chequeData);
    return await newCheque.save({ session });
};

const updateCheque = async (chequeId, chequeData, session) => {
    return await Cheque.findByIdAndUpdate(chequeId, chequeData, { new: true, session });
};

const updateChequeReference = async (paymentMethods, savedInvoice, session, type) => {
    try {
        let _id = type === 'Save' ? savedInvoice[0]._id : savedInvoice._id;

        for (const payment of paymentMethods) {
            if (payment.method === "Cheque" && payment.chequeId) {
                // Update the cheque's reference to point to the saved invoice
                await Cheque.findByIdAndUpdate(
                    payment.chequeId,
                    { reference: _id },
                    { session }
                );
            }
        }
        return true; // All updates were successful
    } catch (error) {
        console.error('Error updating cheque reference:', error);
        throw new Error('Error updating cheque reference');
    }
};

const checkDocumentCanDelete = async (documentId,userId) => {

    let isTransferExistforDocument = await ChequeTransfer.findOne({ sourceId: documentId, createdBy: userId });

    if (isTransferExistforDocument) {
        return false
    }
    else return true
};


const deleteChequesByReference = async (referenceId, session) => {
    try {
        const result = await Cheque.deleteMany(
            { reference: referenceId },
            { session }
        );

        return {
            success: true,
            deletedCount: result.deletedCount,
        };
    } catch (error) {
        console.error('Error deleting cheques by reference:', error);
        throw new Error('Failed to delete cheques by reference.');
    }
};


const handleChequeUpdates = async (existingPaymentMethods, updatedPaymentMethods, session) => {
    try { 
        const updatedChequeIds = new Set(
            updatedPaymentMethods
                .filter(payment => payment.method === "Cheque" && payment.chequeId)
                .map(payment => payment.chequeId.toString())
        );

        // Identify cheques to delete
        const chequesToDelete = existingPaymentMethods.filter(payment =>
            payment.method === "Cheque" &&
            payment.chequeId &&
            !updatedChequeIds.has(payment.chequeId.toString())
        );

        // Delete cheques that are no longer part of the payment method
        for (const cheque of chequesToDelete) {
            await Cheque.findOneAndDelete({ _id: cheque.chequeId }, { session });
        }

        return true;
    } catch (error) {
        console.error("Error while handling cheque updates:", error);
        throw new Error("Failed to update cheques");
    }
};

module.exports = { createCheque, updateCheque, updateChequeReference, deleteChequesByReference, checkDocumentCanDelete,handleChequeUpdates };
