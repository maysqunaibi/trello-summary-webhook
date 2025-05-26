const axios = require("axios");
const { TRELLO_API_KEY, TRELLO_TOKEN, BOARD_ID } = process.env;
const {
  getCustomFieldId,
  setCustomFieldId,
  getListName,
  setListName,
} = require("./cache");

const trello = (path, params = "") =>
  `https://api.trello.com/1/${path}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}${params}`;

async function getCustomFieldIdByName(name) {
  const cached = getCustomFieldId(name);
  if (cached) return cached;

  const res = await axios.get(trello(`boards/${BOARD_ID}/customFields`));
  const field = res.data.find((f) => f.name === name);
  if (field) {
    setCustomFieldId(name, field.id);
    return field.id;
  }
  return null;
}

async function updateCustomField(cardId, fieldId, value) {
  return axios.put(
    `https://api.trello.com/1/card/${cardId}/customField/${fieldId}/item`,
    { value: { text: value.toString() } },
    { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
  );
}

async function clearCustomField(cardId, fieldId) {
  return axios.delete(
    `https://api.trello.com/1/card/${cardId}/customField/${fieldId}/item`,
    { params: { key: TRELLO_API_KEY, token: TRELLO_TOKEN } }
  );
}

async function getListNameById(listId) {
  const cached = getListName(listId);
  if (cached) return cached;

  const res = await axios.get(trello(`lists/${listId}`));
  const listName = res.data.name;
  setListName(listId, listName);
  return listName;
}

module.exports = {
  getCustomFieldIdByName,
  updateCustomField,
  clearCustomField,
  getListNameById,
  trello,
};
