const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const {
  TRELLO_API_KEY,
  TRELLO_TOKEN,
  BOARD_ID,
  SUMMARY_CARD_ID,
  SUMMARY_CARD_ID_LONG,
} = process.env;

const trello = (path, params = "") =>
  `https://api.trello.com/1/${path}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}${params}`;

let cachedCustomFieldIds = {};

async function getCustomFieldIdByName(name) {
  if (cachedCustomFieldIds[name]) return cachedCustomFieldIds[name];

  const res = await axios.get(trello(`boards/${BOARD_ID}/customFields`));
  const field = res.data.find((f) => f.name === name);
  if (field) {
    cachedCustomFieldIds[name] = field.id;
    return field.id;
  }
  return null;
}

async function updateCustomField(cardId, fieldId, value) {
  await axios.put(
    `https://api.trello.com/1/card/${cardId}/customField/${fieldId}/item`,
    {
      value: { text: value.toString() },
    },
    {
      params: {
        key: TRELLO_API_KEY,
        token: TRELLO_TOKEN,
      },
    }
  );
}

async function getListIdByName(listName) {
  const res = await axios.get(trello(`boards/${BOARD_ID}/lists`));
  const list = res.data.find((l) => l.name === listName);
  return list ? list.id : null;
}

async function getCardCountInList(listId) {
  const res = await axios.get(trello(`lists/${listId}/cards`));
  return res.data.length;
}

async function getCustomFieldValueFromCard(cardId, fieldName) {
  const fieldId = await getCustomFieldIdByName(fieldName);
  const res = await axios.get(trello(`cards/${cardId}/customFieldItems`));
  const fieldItem = res.data.find((item) => item.idCustomField === fieldId);
  return fieldItem?.value?.text || fieldItem?.value?.number || "0";
}

app.get("/", (req, res) => {
  res.send("Trello webhook bot is running");
});

app.head("/webhook", (req, res) => {
  res.status(200).send();
});

app.post("/webhook", async (req, res) => {
  const action = req.body.action;
  const cardId = action?.data?.card?.id;
  if (cardId === SUMMARY_CARD_ID_LONG) {
    console.log("🔁 Ignored update from summary card to avoid loop");
    return res.status(200).send("Ignored summary card update");
  }

  if (
    action &&
    [
      "updateCard",
      "createCard",
      "deleteCard",
      "updateCustomFieldItem",
    ].includes(action.type)
  ) {
    try {
      await axios.get("http://localhost:3000/update-summary");
    } catch (e) {
      console.error("⚠️ Error triggering summary update from webhook", e);
    }
  }

  res.status(200).send("Webhook received");
});

app.get("/update-summary", async (req, res) => {
  try {
    console.log("🔄 Running summary update...");

    const fieldMappings = [
      { source: "Geidea in-stock quantity", summary: "Geidea (In-stock)" },
      { source: "Surepay in-stock quantity", summary: "Surepay (In-stock)" },
      {
        source: "Black Box in-stock quantity",
        summary: "Black Box (In-stock)",
      },
      {
        source: "Malahi Device in-stock quantity",
        summary: "Malahi Device (In-stock)",
      },
      {
        source: "Arcade in-stock quantity",
        summary: "Arcade games (In-stock)",
      },
      { source: "Arcade in-use quantity", summary: "Arcade games (In-use)" },
      { source: "Surepay in-use quantity", summary: "Surepay (In-use)" },
      { source: "Black box in-use quantity", summary: "Black box (In-use)" },
      {
        source: "Malahi device in-use quantity",
        summary: "Malahi device (In-use)",
      },
    ];

    const cardsRes = await axios.get(
      trello(`boards/${BOARD_ID}/cards`, "&customFieldItems=true")
    );
    const cards = cardsRes.data;

    // Get all custom field IDs
    const fieldIdMap = {};
    for (const mapping of fieldMappings) {
      fieldIdMap[mapping.source] = await getCustomFieldIdByName(mapping.source);
      fieldIdMap[mapping.summary] = await getCustomFieldIdByName(
        mapping.summary
      );
    }

    const totals = {};
    for (const mapping of fieldMappings) {
      totals[mapping.summary] = 0;
    }

    for (const card of cards) {
      if (card.id === SUMMARY_CARD_ID) continue;

      for (const item of card.customFieldItems || []) {
        for (const mapping of fieldMappings) {
          if (item.idCustomField === fieldIdMap[mapping.source]) {
            const value = item.value?.number || item.value?.text;
            totals[mapping.summary] += parseFloat(value || 0);
          }
        }
      }
    }

    for (const mapping of fieldMappings) {
      const fieldId = fieldIdMap[mapping.summary];
      const summaryValue = totals[mapping.summary].toString();
      console.log(`📌 Updating "${mapping.summary}" to ${summaryValue}`);
      await updateCustomField(SUMMARY_CARD_ID, fieldId, summaryValue);
    }

    // ➕ Add Arcade games (Onboard)
    const onboardListName = "Inventory (onboard games)";
    const arcadeOnboardFieldId = await getCustomFieldIdByName(
      "Games Quantity (Onboard)"
    );
    const arcadeSummaryFieldId = await getCustomFieldIdByName(
      "Arcade games (Onboard)"
    );
    let arcadeOnboardTotal = 0;

    for (const card of cards) {
      if (card.id === SUMMARY_CARD_ID) continue;
      const listRes = await axios.get(trello(`lists/${card.idList}`));
      if (listRes.data.name === onboardListName) {
        const item = (card.customFieldItems || []).find(
          (i) => i.idCustomField === arcadeOnboardFieldId
        );
        const value = item?.value?.number || item?.value?.text;
        arcadeOnboardTotal += parseFloat(value || 0);
      }
    }

    console.log(`🎯 Arcade games (Onboard): ${arcadeOnboardTotal}`);
    await updateCustomField(
      SUMMARY_CARD_ID,
      arcadeSummaryFieldId,
      arcadeOnboardTotal.toString()
    );

    // ➕ Add Total new location
    const prepListName = "Prep locations/المواقع قيد التجهيز";
    const totalLocationFieldId = await getCustomFieldIdByName(
      "Total new location"
    );
    let prepCardCount = 0;

    for (const card of cards) {
      if (card.id === SUMMARY_CARD_ID) continue;
      const listRes = await axios.get(trello(`lists/${card.idList}`));
      if (listRes.data.name === prepListName) {
        prepCardCount++;
      }
    }

    console.log(`📍 Total new location: ${prepCardCount}`);
    await updateCustomField(
      SUMMARY_CARD_ID,
      totalLocationFieldId,
      prepCardCount.toString()
    );

    res.send("✅ Summary fields updated successfully!");
  } catch (err) {
    console.error("❌ Error in /update-summary:", err.response?.data || err);
    res.status(500).send("Error updating summary.");
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
