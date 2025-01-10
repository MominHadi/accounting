const fs = require('fs');
const path = require('path');
const deleteFile = (filename, fileType) => {
    return new Promise((resolve, reject) => {

        const filePath = path.join(__dirname, '../', 'uploads', fileType, filename);
        console.log(filePath, 'Path ');
        fs.unlink(filePath, (err) => {
            if (err) {
                reject(new Error(`Error deleting file: ${err.message}`));
            } else {
                resolve(`File ${filename} deleted successfully!`);
            }
        });

    })
}

module.exports.deleteFile = deleteFile;