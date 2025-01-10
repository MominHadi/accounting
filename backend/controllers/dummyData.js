const fs = require("fs");
const { ObjectId } = require("mongodb");

const generateDummyData = () => {
  const dummyData = [];
  for (let i = 1; i <= 1000; i++) {
    dummyData.push({
      _id: new ObjectId(), // Generate unique ObjectId for each record
      poReference: {
        poId: null,
        poNumber: ``,
        date: ``
      },
      orderNo: `SO${i.toString().padStart(4, "0")}`,
      orderDate: `2024-12-${Math.floor(Math.random() * 15 + 1).toString().padStart(2, "0")}`,
      dueDate: `2025-01-${Math.floor(Math.random() * 15 + 16).toString().padStart(2, "0")}`,
      party: "676966f183e6f7d7b30babd3",
      partyName: `Party ${String.fromCharCode(65 + (i % 26))}`,
      billingAddress: `${i} Main St, City ${String.fromCharCode(65 + (i % 26))}`,
      phoneNo: `12345${Math.floor(100000 + Math.random() * 900000).toString()}`,
      stateOfSupply: null,
      image: ``,
      document: ``,
      description: `Sale Order for Party ${String.fromCharCode(65 + (i % 26))}`,
      paymentMethod: [
        {
          method: ["Cash", "Cheque", "Bank"][Math.floor(Math.random() * 3)],
          amount: Math.floor(Math.random() * 5000 + 1000),
          bankName: "676a8d841a3251c344cf9750",
          referenceNo: Math.random() < 0.5 ? `Ref${i}` : null,
          chequeId: Math.random() < 0.5 ? `64839f19c24aaf0012d${i % 10}f` : null
        }
      ],
      items: [
        {
          itemId: "676a8d841a3251c344cf9750",
          quantity: Math.floor(Math.random() * 10 + 1),
          unit: "676966303ac0afe500a65dd9",
          price: Math.floor(Math.random() * 500 + 10),
          discountPercent: Math.floor(Math.random() * 20),
          taxPercent: null
        }
      ],
      totalAmount: Math.floor(Math.random() * 10000 + 1000),
      advanceAmount: Math.floor(Math.random() * 5000),
      balanceAmount: Math.floor(Math.random() * 5000),
      status: ["Order Overdue", "Order Open", "Order Closed"][Math.floor(Math.random() * 3)],
      isConverted:false,
      conversionDetails: {
        documentId: null,
        documentType: null,
        documentNo:  null,
        isDeleted: false
      },
      createdBy: "676966303ac0afe500a65dc9"
    });
  }
  return dummyData;
};

const data = generateDummyData();
fs.writeFileSync("sale_orders.json", JSON.stringify(data, null, 2), "utf-8");
console.log("Dummy data with _id generated and saved to sale_orders.json");



