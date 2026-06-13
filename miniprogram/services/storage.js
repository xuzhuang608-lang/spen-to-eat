function getList(key) {
  return wx.getStorageSync(key) || [];
}

function saveList(key, list) {
  wx.setStorageSync(key, list);
}

function addUnique(key, id) {
  const list = getList(key).filter((item) => item !== id);
  list.unshift(id);
  saveList(key, list.slice(0, 50));
}

function removeItem(key, id) {
  saveList(key, getList(key).filter((item) => item !== id));
}

function hasItem(key, id) {
  return getList(key).includes(id);
}

module.exports = {
  getList,
  saveList,
  addUnique,
  removeItem,
  hasItem
};
