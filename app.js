const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path')
const app = express();
const routes = require('./routes/index')

require('dotenv').config();

const PORT = process.env.PORT || 8081;

app.use(cors());

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api", routes);

// Middleware for serving static images
app.use('/tmp/images', express.static(path.join(__dirname, 'tmp/images')));

// Alternatively, you can add another route for serving docs if needed:
app.use('/tmp/docs', express.static(path.join(__dirname, 'tmp/docs')));

mongoose.connect(process.env.Mongo_URI)
    .then(response => {
        console.log(`App Listening to port ${PORT}`)
        app.listen(PORT)
    })
    .catch(err => {
        console.log(err);

    });