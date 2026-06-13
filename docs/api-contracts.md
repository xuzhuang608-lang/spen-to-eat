# 云函数接口草案

## getDishes

按城市和筛选条件获取候选美食。

请求：

```json
{
  "city": "广州",
  "filters": {
    "mealTime": "早餐",
    "category": "小吃",
    "taste": "鲜香",
    "scene": "不限",
    "avoidTags": ["海鲜"]
  }
}
```

响应：

```json
{
  "items": []
}
```

## spinDish

执行加权随机，并记录转盘日志。

请求：

```json
{
  "city": "广州",
  "filters": {}
}
```

响应：

```json
{
  "dish": {}
}
```

## createPoll

创建投票。

请求：

```json
{
  "selectedIds": ["gz-tingzai-porridge"],
  "voteLimit": 1,
  "anonymous": true
}
```

响应：

```json
{
  "pollId": "poll-id"
}
```

## submitVote

提交投票。

请求：

```json
{
  "pollId": "poll-id",
  "dishIds": ["gz-tingzai-porridge"]
}
```

响应：

```json
{
  "ok": true
}
```

## submitFeedback

提交反馈。

请求：

```json
{
  "dishId": "gz-tingzai-porridge",
  "type": "信息有误",
  "content": "标签不准"
}
```

响应：

```json
{
  "ok": true
}
```

