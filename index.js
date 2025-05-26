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

const handleSummaryUpdate = require("./routes/updateSummary");

app.get("/", (req, res) => {
  res.send("Trello webhook bot is running");
});

app.head("/webhook", (req, res) => {
  res.status(200).send();
});

app.post("/webhook", async (req, res) => {
  console.log(
    "📥 Webhook received from Trello:",
    req.body.action?.type || "unknown action"
  );

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
      await handleSummaryUpdate();
    } catch (e) {
      console.error("⚠️ Error triggering summary update from webhook", e);
    }
  }

  res.status(200).send("Webhook received");
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
