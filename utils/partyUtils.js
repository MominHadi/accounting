const Parties = require('../models/partyModel');

/**
 * Finds a party by name and createdBy, or creates a new one if not found.
 * @param {string} partyName - The name of the party.
 * @param {string} userId - The ID of the user creating the party.
 * @param {object} session - The MongoDB session object (optional).
 * @returns {Promise<string>} - The ID of the found or created party.
 */

const findOrCreateParty = async (partyName, userId, session = null) => {
    try {
        const partyDetails = await Parties.findOne({ name: partyName, createdBy: userId });

        if (partyDetails) {
            return partyDetails._id;
        }

        console.log('Party not found. Creating a new one.');
        
        const newParty = await Parties.create(
            [{ name: partyName, gstType: 'Unregistered/Consumer', createdBy: userId }],
            { session }
        );

        if (!newParty || newParty.length === 0) {
            throw new Error('Error during saving new Party');
        }

        return newParty[0]._id;
    } catch (error) {
        console.error('Error in findOrCreateParty:', error);
        throw error;
    }
};

module.exports = { findOrCreateParty };
