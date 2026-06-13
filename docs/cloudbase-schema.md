# 云开发数据模型草案

## cities

城市集合。

```json
{
  "_id": "guangzhou",
  "name": "广州",
  "province": "广东",
  "slogan": "老广今日食乜好",
  "sort": 10,
  "isOnline": true,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## dishes

美食集合。

```json
{
  "_id": "gz-tingzai-porridge",
  "city": "广州",
  "cityId": "guangzhou",
  "name": "艇仔粥",
  "category": "小吃",
  "taste": "鲜香",
  "mealTime": ["早餐", "夜宵"],
  "scene": ["一个人", "两个人"],
  "avoidTags": ["海鲜"],
  "tags": ["粥品", "老广", "清淡"],
  "localIndex": 5,
  "iconType": "bowl",
  "weight": 10,
  "phrase": "今日转到艇仔粥，胃先上岸。",
  "description": "广州传统粥品，配料丰富，口感鲜香。",
  "imageFileId": "",
  "isOnline": true,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## users

用户集合。首版只使用 openid，不强制头像昵称授权。

```json
{
  "_id": "openid",
  "openid": "openid",
  "createdAt": 1710000000000,
  "lastActiveAt": 1710000000000
}
```

## favorites

收藏集合。

```json
{
  "_id": "auto",
  "openid": "openid",
  "dishId": "gz-tingzai-porridge",
  "createdAt": 1710000000000
}
```

## spin_logs

转盘记录集合。

```json
{
  "_id": "auto",
  "openid": "openid",
  "city": "广州",
  "filters": {
    "mealTime": "早餐",
    "category": "小吃",
    "taste": "鲜香",
    "scene": "不限",
    "avoidTags": ["海鲜"]
  },
  "resultDishId": "gz-tingzai-porridge",
  "createdAt": 1710000000000
}
```

## polls

投票集合。

```json
{
  "_id": "auto",
  "creatorOpenid": "openid",
  "selectedIds": ["gz-tingzai-porridge", "gz-wonton-noodle"],
  "voteLimit": 1,
  "anonymous": true,
  "expiresAt": 1710086400000,
  "createdAt": 1710000000000
}
```

## poll_votes

投票记录集合。

```json
{
  "_id": "auto",
  "pollId": "poll-id",
  "openid": "openid",
  "dishIds": ["gz-tingzai-porridge"],
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## feedback

反馈集合。

```json
{
  "_id": "auto",
  "openid": "openid",
  "dishId": "gz-tingzai-porridge",
  "type": "信息有误",
  "content": "这里的忌口标签不太准",
  "status": "pending",
  "createdAt": 1710000000000
}
```

