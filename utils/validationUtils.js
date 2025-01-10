
const validatePaymentMethods = (paymentMethod, res) => {
    if (paymentMethod.length > 0) {
        for (const payment of paymentMethod) {
            // Validate payment method
            if (!["Cash", "Cheque", "Bank"].includes(payment.method)) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Invalid payment method. Allowed values are 'Cash', 'Cheque', or 'Bank'.`
                });
            }

            // Validate bank name for 'Bank' method
            if (payment.method === "Bank" && !payment.bankName) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Bank name is required when the payment method is 'Bank'.`
                });
            }

            // Validate payment amount
            if (payment.amount <= 0 || !payment.amount) {
                return res.status(400).json({
                    status: "Failed",
                    message: `Payment amount must be greater than zero.`
                });  
            }


            if (!['Bank'].includes(payment.method)){
                
                delete payment.bankName
            }
        }
    }
    return true;
};

module.exports = { validatePaymentMethods };
