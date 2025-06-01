const { sendEmail } = require("../helpers/email");
require("dotenv").config();

module.exports = async function notifyChange(action) {
  const card = action.data.card;
  const board = action.data.board;
  const customField = action.data.customField;
  const customFieldItem = action.data.customFieldItem;
  const oldValueObj = action.data.old?.value || {};
  const newValueObj = customFieldItem?.value || {};

  // Extract values
  const updatedFieldName = customField.name;
  const oldValue = oldValueObj.text || oldValueObj.number || "0";
  const newValue = newValueObj.text || newValueObj.number || "0";
  const cardName = card.name;
  const cardUrl = `https://trello.com/c/${card.shortLink}`;

  const subject = `Trello Update: "${updatedFieldName}" changed on "${cardName}"`;
  const body = `
Hi ${process.env.EMAIL_TO_NAME || "Team"},

Please note that the Trello card has been updated with new values on ${new Date().toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  )}.

Updated Field:
${updatedFieldName}
Old Value: ${oldValue}
New Value: ${newValue}

Card Details:
Card Name: ${cardName}
Card URL: ${cardUrl}

Feel free to review the changes and reach out if you have any questions or need clarification.

Best regards,
Your Trello Notification System
`;

  await sendEmail({ subject, body, to:process.env.EMAIL_TO });
};
