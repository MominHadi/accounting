const mongoose = require('mongoose');
const Banks = require('../../models/bankModel');
const Transactions = require('../../models/transactionModel');

exports.addBank = async (req, res) => {

    try {

        let { accountDisplayName, openingBalance, asOfDate, printBankDetailsOnInvoice, printUPIQRCodeOnInvoice, accountNumber, ifscCode, upiIDForQRCode, branchName, accountHolderName } = req.body;


        if (!accountDisplayName) {
            return res.status(400).json({ status: 'Failed', message: 'Account Display Name is required' });
        };

        const existingBank = await Banks.findOne({
            bankName: { $regex: new RegExp("^" + accountDisplayName + "$", "i") }
            , createdBy: req.user
        });

        if (existingBank) {
            return res.status(409).json({ status: "Failed", message: "Bank Already Exists" })
        };

        // if (printBankDetailsOnInvoice) {
        //     if (!accountNumber) {
        //         return res.status(400).json({ status: 'Failed', message: 'Bank Account Number is required' })
        //     }
        // };

        // if (printUPIQRCodeOnInvoice) {
        //     if (!upiIDForQRCode) {
        //         return res.status(400).json({ status: 'Failed', message: 'UPI QR Code is required' })
        //     }
        // };

        const savedBankAccount = await Banks.create([{
            bankName: accountDisplayName,
            openingBalance,
            asOfDate,
            printBankDetailsOnInvoice,
            printUPIQRCodeOnInvoice,
            accountNumber,
            ifscCode,
            branchName,
            upiIDForQRCode,
            accountHolderName,
            createdBy: req.user
        }]);

        if (!savedBankAccount) {
            return res.status(400).json({ status: "Failed", message: 'Bank Account not Saved' });
        }

        res.status(201).json({ status: 'Success', message: 'Bank Account Saved', bankDetails: savedBankAccount });
 
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Internal Server Error", error: error })

    }
};

exports.editBank = async (req, res) => {
    try {
        const {
            accountDisplayName,
            openingBalance,
            asOfDate,
            printBankDetailsOnInvoice,
            printUPIQRCodeOnInvoice,
            accountNumber,
            ifscCode,
            upiIDForQRCode,
            branchName,
            accountHolderName
        } = req.body;

        const { bankId } = req.params;

        if (!bankId) {
            return res.status(400).json({ status: 'Failed', message: 'Bank ID is required' });
        }

        // Find the bank account by ID and make sure it exists
        const bankAccount = await Banks.findOne({ _id: bankId, createdBy: req.user });

        if (!bankAccount) {
            return res.status(404).json({ status: 'Failed', message: 'Bank Account not found' });
        }

        // Update only the fields that are provided in the request body
        bankAccount.bankName = accountDisplayName || bankAccount.bankName;
        bankAccount.openingBalance = openingBalance || bankAccount.openingBalance;
        bankAccount.asOfDate = asOfDate || bankAccount.asOfDate;
        bankAccount.printBankDetailsOnInvoice = (typeof printBankDetailsOnInvoice !== 'undefined')
            ? printBankDetailsOnInvoice
            : bankAccount.printBankDetailsOnInvoice;
        bankAccount.printUPIQRCodeOnInvoice = (typeof printUPIQRCodeOnInvoice !== 'undefined')
            ? printUPIQRCodeOnInvoice
            : bankAccount.printUPIQRCodeOnInvoice;
        bankAccount.accountNumber = accountNumber || bankAccount.accountNumber;
        bankAccount.ifscCode = ifscCode || bankAccount.ifscCode;
        bankAccount.upiIDForQRCode = upiIDForQRCode || bankAccount.upiIDForQRCode;
        bankAccount.branchName = branchName || bankAccount.branchName;
        bankAccount.accountHolderName = accountHolderName || bankAccount.accountHolderName;

        // Validations for required fields if print options are enabled
        if (bankAccount.printBankDetailsOnInvoice && !bankAccount.accountNumber) {
            return res.status(400).json({ status: 'Failed', message: 'Bank Account Number is required when printing bank details on invoice' });
        }

        if (bankAccount.printUPIQRCodeOnInvoice && !bankAccount.upiIDForQRCode) {
            return res.status(400).json({ status: 'Failed', message: 'UPI QR Code is required when printing UPI QR code on invoice' });
        }

        // Save the updated bank account
        const updatedBankAccount = await bankAccount.save();

        res.status(200).json({ status: 'Success', message: 'Bank Account Updated', bankDetails: updatedBankAccount });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: 'Failed', message: 'Internal Server Error', error: error.message });
    }
};


exports.deleteBank = async (req, res) => {
    try {
        const { bankId } = req.params;

        if (!bankId) {
            return res.status(400).json({ status: 'Failed', message: 'Bank ID is required' });
        }

        // Find the bank by ID
        const bankAccount = await Banks.findOne({ _id: bankId, createdBy: req.user });

        if (!bankAccount) {
            return res.status(404).json({ status: 'Failed', message: 'Bank Account not found' });
        }

        // Check if the bank is used in any transactions
        const relatedTransactions = await Transactions.findOne({ bankName: bankId, createdBy: req.user });

        if (relatedTransactions) {
            return res.status(400).json({ status: 'Failed', message: 'Cannot delete bank account. It is being used in transactions.' });
        }

        // Delete the bank if no transactions are found
        const deletedBank = await Banks.deleteOne({ _id: bankId });

        if (deletedBank.deletedCount === 0) {
            return res.status(400).json({ status: 'Failed', message: 'Bank account deletion failed' });
        }

        res.status(200).json({ status: 'Success', message: 'Bank account deleted successfully' });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: 'Failed', message: 'Internal Server Error', error: error.message });
    }
};

exports.getAllBanks = async (req, res) => {
    try {
        const bankAccounts = await Banks.find({ createdBy: req.user })
            .select('bankName openingBalance accountHolderName accountNumber');

        if (!bankAccounts) {
            return res.status(200).json({ message: 'Data not found' });
        }
        
        res.status(200).json({ status: 'Success', data: bankAccounts });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: 'Failed', message: 'Internal Server Error', error: error.message });
    }
}

exports.getBankDetailsById = async (req, res) => {
    try {

        const { bankId } = req.params;

        const bankAccounts = await Banks.findOne({ _id: bankId, createdBy: req.user });

        if (!bankAccounts) {
            return res.status(200).json({ message: 'Bank not found' });
        }

        res.status(200).json({ status: 'Success', data: bankAccounts });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: 'Failed', message: 'Internal Server Error', error: error.message });
    }
}