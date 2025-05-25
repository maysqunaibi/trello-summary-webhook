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

// Helper: build Trello API URLs
const trello = (path, params = "") =>
  `https://api.trello.com/1/${path}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}${params}`;

let cachedCustomFieldIds = {};

// Helper to get and cache custom field IDs
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

// Helper to update a custom field on a card
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

app.get("/", (req, res) => {
  res.send("Trello webhook bot is running");
});

app.head("/webhook", (req, res) => {
  res.status(200).send();
});

// Trello will POST here on card changes
app.post("/webhook", async (req, res) => {
  console.log(
    "📥 Webhook received from Trello:",
    req.body.action?.type || "unknown action"
  );

  const action = req.body.action;

  // ✅ Prevent loop: ignore changes from the summary card itself
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
      {
        source: "Arcade in-use quantity",
        summary: "Arcade games (In-use)",
      },
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

    // Resolve field IDs
    const fieldIdMap = {};
    for (const mapping of fieldMappings) {
      fieldIdMap[mapping.source] = await getCustomFieldIdByName(mapping.source);
      fieldIdMap[mapping.summary] = await getCustomFieldIdByName(
        mapping.summary
      );
    }

    // Calculate totals for each source field
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

    // Update summary fields
    for (const mapping of fieldMappings) {
      const summaryValue = totals[mapping.summary].toString();
      const fieldId = fieldIdMap[mapping.summary];
      console.log(`📌 Updating "${mapping.summary}" to ${summaryValue}`);

      await axios.put(
        trello(`cards/${SUMMARY_CARD_ID}/customField/${fieldId}/item`),
        { value: { text: summaryValue } }
      );
    }

    res.send("✅ All summary fields updated!");
  } catch (err) {
    console.error("❌ Error in /update-summary:", err.response?.data || err);
    res.status(500).send("Error updating summary.");
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
