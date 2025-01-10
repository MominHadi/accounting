// middleware/fileUpload.js
const multer = require('multer');
const path = require('path');

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'uploads';
        console.log(req,file, 'Data tesing');
        // Check file type to determine folder
        if (['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
            folder = 'uploads/images';
        } else if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)) {
            folder = 'uploads/docs';
        }

        cb(null, path.join(__dirname, '../', folder));
    },
    filename: (req, file, cb) => {
        const safeFilename = new Date().toISOString().replace(/:/g, '-') + path.extname(file.originalname);
        cb(null, safeFilename);
    }
});


const filterType = (req, file, cb) => {
    if (['image/png', 'image/jpg', 'image/jpeg', 'application/pdf', 'application/msword'].includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

// Middleware for specific fields
const uploadFields = multer({ storage: fileStorage, fileFilter: filterType }).fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
]);

// Middleware for general files
const uploadArray = multer({ storage: fileStorage, fileFilter: filterType }).array('files');

module.exports = {
    uploadFields,
    uploadArray
};
