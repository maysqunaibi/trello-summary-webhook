const express = require("express");
const axios = require("axios");
require("dotenv").config();
const app = express();
app.use(express.json());

const handleSummaryUpdate = require("./routes/updateSummary");
const notifyChange = require("./routes/notifyChange");
const retry = require("./helpers/retry");
const notifyError = require("./routes/notifyError");

const { TRELLO_API_KEY, TRELLO_TOKEN, SUMMARY_CARD_ID_LONG, LOCATION_TARGETED_LIST_ID, RESPONSIBILITY_FIELD_ID } = process.env;

const monitoredListIds = (process.env.MONITORED_LIST_IDS || "").split(",");

app.get("/", (req, res) => {
  res.send("Trello webhook bot is running");
});

app.head("/webhook", (req, res) => {
  res.status(200).send();
});

app.post("/webhook", async (req, res) => {
  console.log(
    "📥 Webhook received:",
    req.body.action?.type || "unknown action"
  );

  const action = req.body.action;
  if (
    action &&
    [
      "updateCard",
      "createCard",
      "deleteCard",
      "updateCustomFieldItem",
    ].includes(action.type)
  ) {
    const cardId = action?.data?.card?.id;
    let listId = "";

    if (!action || !cardId) return res.status(200).send("No valid action");
    if (cardId === SUMMARY_CARD_ID_LONG) {
      return res.status(200).send("🔁 Ignored summary card update");
    }
    try {
      const cardRes = await retry(() =>
        axios.get(
          `https://api.trello.com/1/cards/${cardId}?fields=idList,name,url&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
        )
      );
      listId = cardRes.data.idList;
      console.log(`📥 Fetched listId: ${listId}`);
    } catch (err) {
      await notifyError("Fetching card listId", err);
      return res.status(200).send("Card fetch failed");
    }

if (action.type === "updateCard" && action.data.listBefore && action.data.listAfter) {
  const { listBefore, listAfter, card } = action.data;

  if (listBefore.id === LOCATION_TARGETED_LIST_ID && listAfter.id !== LOCATION_TARGETED_LIST_ID) {
    try {
      // Get custom field items for the card
      const cfRes = await retry(() =>
        axios.get(
          `https://api.trello.com/1/cards/${card.id}/customFieldItems?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
        )
      );

      const responsibilityField = cfRes.data.find(
        (item) => item.idCustomField === RESPONSIBILITY_FIELD_ID
      );

      const hasResponsibility = responsibilityField?.value?.text;

      if (!hasResponsibility) {
        // Move card back to Location Parking
        await retry(() =>
          axios.put(
            `https://api.trello.com/1/cards/${card.id}?idList=${LOCATION_TARGETED_LIST_ID}&key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
          )
        );

        // Add comment
        await retry(() =>
          axios.post(
            `https://api.trello.com/1/cards/${card.id}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
            { text: `⚠️ Please fill out the "Responsibility" field before moving this card.` }
          )
        );

        console.log("🚫 Card moved back due to missing Responsibility field.");
        return res.status(200).send("Moved back due to missing Responsibility");
      }
    } catch (err) {
      await notifyError("Responsibility field check", err);
      return res.status(200).send("Failed Responsibility check");
    }
  }
}

    try {
      await retry(() => handleSummaryUpdate());
    } catch (err) {
      console.error("⚠️ Error in summary update", err);
      await notifyError("Summary update", err);
    }

    if (monitoredListIds.includes(listId)) {
      try {
        await retry(() => notifyChange(action));
      } catch (err) {
        console.error("⚠️ Error in notifyChange", err);
        await notifyError("Email notifyChange", err);
      }
    }
  }

  res.status(200).send("Webhook received");
});

app.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
