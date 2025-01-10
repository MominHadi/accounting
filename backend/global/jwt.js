const jwt = require('jsonwebtoken');
require("dotenv").config();
const secret = process.env.JWT_SECRET;
const BusinessProfile = require("../models/businessProfile");
const printSettings = require("../models/printSettingsModel");
const itemSettings = require("../models/settings/itemSettings.Model");


const generateToken = (user) => {
  return jwt.sign({ id: user._id, isClient: user.isClient }, secret);
};

// Middleware to protect routes
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Get token from header
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded.id;

    // Fetch business profile associated with the user
    const businessProfile = await BusinessProfile.findOne({ createdBy: req.user }).select('-createdAt -updatedAt -createdBy -__v');
    const PrintSettings = await printSettings.findOne({ createdBy: req.user });
    const ItemSettings = await itemSettings.findOne({ createdBy: req.user });
    // if (!businessProfile) {
    //   return res.status(404).json({ message: 'Business profile not found' });
    // }

    // Attach business profile to req object
    req.businessProfile = businessProfile;
    req.printSettings = PrintSettings;
    req.itemSettings = ItemSettings;
    next(); 
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = { generateToken, verifyToken };
