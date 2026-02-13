const userValidation = require('./user.validation');
const bookingValidation = require('./booking.validation');
const propertyValidation = require('./property.validation');
const unitValidation = require('./unit.validation');
const leadValidation = require('./lead.validation');
const agentValidation = require('./agent.validation');
const workspaceValidation = require('./workspace.validation');
const miscValidation = require('./misc.validation');

module.exports = {
    ...userValidation,
    ...bookingValidation,
    ...propertyValidation,
    ...unitValidation,
    ...leadValidation,
    ...agentValidation,
    ...workspaceValidation,
    ...miscValidation,
};
