let listNameMap = {};
let customFieldIdMap = {};

module.exports = {
  getListName: (id) => listNameMap[id],
  setListName: (id, name) => {
    listNameMap[id] = name;
  },
  getCustomFieldId: (name) => customFieldIdMap[name],
  setCustomFieldId: (name, id) => {
    customFieldIdMap[name] = id;
  },
  clearCache: () => {
    listNameMap = {};
    customFieldIdMap = {};
  },
};
