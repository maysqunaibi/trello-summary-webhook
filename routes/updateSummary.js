const axios = require("axios");
const {
  getCustomFieldIdByName,
  updateCustomField,
} = require("../helpers/trello");

module.exports = async function handleSummaryUpdate() {
  const {
    BOARD_ID,
    SUMMARY_CARD_ID,
    SUMMARY_CARD_ID_LONG,
    TRELLO_API_KEY,
    TRELLO_TOKEN,
  } = process.env;

  const fieldMappings = [
    { source: "Geidea in-stock quantity", summary: "Geidea (In-stock)" },
    { source: "Geidea in-use quantity", summary: "Geidea (In-use)" },

    { source: "Surepay in-stock quantity", summary: "Surepay (In-stock)" },
    { source: "Black Box in-stock quantity", summary: "Black Box (In-stock)" },
    {
      source: "Malahi Device in-stock quantity",
      summary: "Malahi Device (In-stock)",
    },
    { source: "Arcade in-stock quantity", summary: "Arcade games (In-stock)" },

    { source: "Arcade in-use quantity", summary: "Arcade games (In-use)" },
    { source: "Surepay in-use quantity", summary: "Surepay (In-use)" },
    { source: "Black box in-use quantity", summary: "Black box (In-use)" },
    {
      source: "Malahi device in-use quantity",
      summary: "Malahi device (In-use)",
    },
  ];

  const cardsRes = await axios.get(
    `https://api.trello.com/1/boards/${BOARD_ID}/cards?customFieldItems=true&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  const cards = cardsRes.data;

  const listsRes = await axios.get(
    `https://api.trello.com/1/boards/${BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  const listIdToName = {};
  for (const list of listsRes.data) {
    listIdToName[list.id] = list.name;
  }

  const fieldIdMap = {};
  for (const mapping of fieldMappings) {
    fieldIdMap[mapping.source] = await getCustomFieldIdByName(mapping.source);
    fieldIdMap[mapping.summary] = await getCustomFieldIdByName(mapping.summary);
  }

  const totals = {};
  for (const mapping of fieldMappings) {
    totals[mapping.summary] = 0;
  }

  for (const card of cards) {
    if (card.id === SUMMARY_CARD_ID_LONG) {
      console.log(`🔁 Skipping summary card "${card.name}"`);
      continue;
    }

    const listName = listIdToName[card.idList] || "Unknown";

    for (const item of card.customFieldItems || []) {
      for (const mapping of fieldMappings) {
        if (item.idCustomField === fieldIdMap[mapping.source]) {
          const fieldName = mapping.source;
          const value = item.value?.number || item.value?.text;
          const numValue = parseFloat(value || 0);

          const lowerField = fieldName.toLowerCase();
          const shouldInclude =
            (lowerField.includes("in-use quantity") &&
              listName === "In-operation") ||
            (lowerField.includes("in-stock quantity") &&
              listName === "Inventory (In-stock)");

          if (shouldInclude) {
            totals[mapping.summary] += numValue;
            console.log(
              `✅ Counted ${value} from "${card.name}" in "${listName}" for "${fieldName}"`
            );
          } else {
            console.log(
              `⛔ Skipped "${fieldName}" in card "${card.name}" from list "${listName}"`
            );
          }
        }
      }
    }
  }

  for (const mapping of fieldMappings) {
    const summaryValue = totals[mapping.summary].toString();
    console.log(`📌 Updating summary "${mapping.summary}" to ${summaryValue}`);
    await updateCustomField(
      SUMMARY_CARD_ID,
      fieldIdMap[mapping.summary],
      summaryValue
    );
  }

  // Prep location summary
  const prepListName = "Prep locations/المواقع قيد التجهيز";
  const prepFieldId = await getCustomFieldIdByName("Total new location");
  const prepCardCount = cards.filter(
    (card) =>
      card.id !== SUMMARY_CARD_ID && listIdToName[card.idList] === prepListName
  ).length;

  console.log(`📍 Total new location cards: ${prepCardCount}`);
  await updateCustomField(
    SUMMARY_CARD_ID,
    prepFieldId,
    prepCardCount.toString()
  );
};
