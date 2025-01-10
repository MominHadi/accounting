const mongoose = require('mongoose');


exports.getBusinessCategories = async (req, res) => {
    try {
        let db = mongoose.connection.db;

        let collection = db.collection('businessCategories');


        const data = await collection.find().toArray();
        res.json(data)

    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message || error });
    }
};

exports.getBusinessTypes= async (req, res) => {
    try {
        let db = mongoose.connection.db;

        let collection = db.collection('businessTypes');

        const data = await collection.find().toArray();

        res.json(data);

    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message || error });

    }
}



