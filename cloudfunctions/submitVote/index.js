const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const { pollId, dishIds = [] } = event;
  if (!pollId || !dishIds.length) {
    return { ok: false, message: "缺少投票参数" };
  }

  const existed = await db.collection("poll_votes").where({
    pollId,
    openid: wxContext.OPENID
  }).limit(1).get();

  if (existed.data.length) {
    await db.collection("poll_votes").doc(existed.data[0]._id).update({
      data: {
        dishIds,
        updatedAt: Date.now()
      }
    });
  } else {
    await db.collection("poll_votes").add({
      data: {
        pollId,
        openid: wxContext.OPENID,
        dishIds,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  }

  return { ok: true };
};
