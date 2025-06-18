const axios = require("axios");
const {
  getCustomFieldIdByName,
  updateCustomField,
} = require("../helpers/trello");
const { retryAsync } = require("../helpers/retry");
const { notifyError } = require("./notifyError");
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
    { source: "Surepay in-use quantity", summary: "Surepay (In-use)" },
    { source: "Black Box in-stock quantity", summary: "Black Box (In-stock)" },
    { source: "Black box in-use quantity", summary: "Black box (In-use)" },
    {
      source: "R-pay in-stock quantity",
      summary: "R-pay (In-stock)",
    },
    {
      source: "R-pay in-use quantity",
      summary: "R-pay (In-use)",
    },
    { source: "Arcade in-stock quantity", summary: "Arcade games (In-stock)" },
    { source: "Arcade in-use quantity", summary: "Arcade games (In-use)" },
    {
      source: "Games Quantity (Onboard)",
      summary: "Total onboard arcade games",
    },
    {
      source: "Games Quantity (Targeted Locations)",
      summary: "Games Quantity(Targeted Locations)",
    },
      {
      source: "Device Quantity (Targeted Locations)",
      summary: "Device Quantity(Targeted Locations)",
    },
  ];

  // Fetch all cards and lists
  const [cardsRes, listsRes] = await Promise.all([
    axios.get(
      `https://api.trello.com/1/boards/${BOARD_ID}/cards?customFieldItems=true&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    ),
    axios.get(
      `https://api.trello.com/1/boards/${BOARD_ID}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
    ),
  ]);

  const cards = cardsRes.data;
  const lists = listsRes.data;
  const listIdMap = Object.fromEntries(lists.map((l) => [l.name, l.id]));

  const allowedLists = {
    "in-stock quantity": listIdMap["Inventory (In-stock)"],
    "in-use quantity": listIdMap["In-operation"],
    "Games Quantity (Onboard)": listIdMap["Inventory (onboard games)"],
  };

  // Fetch all custom field IDs
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
    const isSummaryCard =
      card.id === SUMMARY_CARD_ID || card.id === SUMMARY_CARD_ID_LONG;
    if (isSummaryCard) {
      console.log(`🔁 Skipping summary card "${card.name}"`);
      continue;
    }

    for (const item of card.customFieldItems || []) {
      for (const mapping of fieldMappings) {
        const isMatch = item.idCustomField === fieldIdMap[mapping.source];
        if (!isMatch) continue;

        const expectedListId = Object.entries(allowedLists).find(([key]) =>
          mapping.source.includes(key)
        )?.[1];

        if (!expectedListId || card.idList !== expectedListId) {
          console.log(
            `⛔ Skipped "${mapping.source}" from wrong list: ${card.name}`
          );
          continue;
        }

        const value = item.value?.number || item.value?.text;
        const parsed = parseFloat(value || 0);
        totals[mapping.summary] += parsed;
        console.log(
          `✅ Added ${parsed} to "${mapping.summary}" from "${card.name}"`
        );
      }
    }
  }

  for (const mapping of fieldMappings) {
    const value = totals[mapping.summary].toString();
    await updateCustomField(
      SUMMARY_CARD_ID,
      fieldIdMap[mapping.summary],
      value
    );
    console.log(`📌 Updated summary field "${mapping.summary}" to ${value}`);
  }

  // Count prep locations
  const prepListName = "Prep locations/المواقع قيد التجهيز";
  const prepListId = listIdMap[prepListName];
  const prepFieldId = await getCustomFieldIdByName("Total new location");

  const prepCardCount = cards.filter(
    (c) => c.idList === prepListId && c.id !== SUMMARY_CARD_ID
  ).length;

  await updateCustomField(
    SUMMARY_CARD_ID,
    prepFieldId,
    prepCardCount.toString()
  );
  console.log(`📌 Updated "Total new location" to ${prepCardCount}`);
};
