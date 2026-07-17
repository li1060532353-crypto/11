---
title: 在这里填写文章标题
publishedAt: 2026-07-17T09:00:00.000Z
summary: 用一句话概括这篇文章的核心内容。
coverTone: blue
coverAlt: 为文章头图填写无障碍说明
selected: false
category: 在这里填写分类
tags:
  - 标签一
  - 标签二
seoTitle: 可选 SEO 标题
seoDescription: 可选 SEO 描述
coverImage: ./cover.png
---
# 在这里填写文章标题

先写导语。正文里如果要插图，直接使用标准 Markdown 图片语法。

![示例图片](./diagram.png)

## 小节标题

这里写正文内容。建议：

- 每篇文章单独放一个目录
- `index.md` 只引用当前目录内的图片
- 如果已经明确分类和标签，直接在 frontmatter 手填
- 如果想交给规则自动分类，可以删除 `category` 或 `tags`

## 代码示例

```ts
export function helloStaticBlog() {
  return 'markdown import ready';
}
```

