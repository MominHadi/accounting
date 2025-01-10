module.exports= function YYYY(date) {
    if (!(date instanceof Date)) return date; // Check if it's a date object
    return date.toLocaleDateString('en-GB'); // Format as DD/MM/YYYY
}