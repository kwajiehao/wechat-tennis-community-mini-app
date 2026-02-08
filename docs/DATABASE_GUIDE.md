# Cloud Database Guide / 云开发数据库操作指南

This document explains how to view and modify the cloud database in WeChat DevTools.

本文档介绍如何在微信开发者工具中查看和修改云数据库。

---

## Opening the Cloud Console / 打开云开发控制台

### Option 1: Via WeChat DevTools / 通过微信开发者工具

**English:**
1. Open **WeChat DevTools**
2. Click the **"Cloud Development"** button in the top toolbar (cloud icon)
3. First-time users need to activate a cloud environment

**中文：**
1. 打开**微信开发者工具**
2. 点击顶部工具栏的**「云开发」**按钮（云朵图标）
3. 首次使用需要开通云开发环境

### Option 2: Via Web Browser / 通过网页浏览器

**English:**
1. Go to https://tcb.cloud.tencent.com/
2. Log in with your WeChat account (scan QR code)
3. Select your cloud environment from the list
4. Click **"Database"** in the left menu

**中文：**
1. 访问 https://tcb.cloud.tencent.com/
2. 使用微信账号登录（扫描二维码）
3. 从列表中选择你的云开发环境
4. 点击左侧菜单的**「数据库」**

---

## Viewing the Database / 查看数据库

**English:**
1. In the Cloud Console left menu, click **"Database"**
2. The left panel shows all collections (similar to Excel worksheets):
   - `players` - Player profiles
   - `events` - Event information
   - `signups` - Signup records
   - `matches` - Match pairings
   - `results` - Match results
   - `stats` - Player statistics
   - `seasons` - Season information
   - `settings` - System settings

3. Click any collection name to view all records in that collection

**中文：**
1. 在云开发控制台左侧菜单，点击**「数据库」**
2. 左侧会显示所有数据集合（类似Excel的工作表）：
   - `players` - 球员信息
   - `events` - 活动信息
   - `signups` - 报名记录
   - `matches` - 比赛对阵
   - `results` - 比赛结果
   - `stats` - 球员统计
   - `seasons` - 赛季信息
   - `settings` - 系统设置

3. 点击任意集合名称，右侧会显示该集合的所有记录

---

## Viewing a Single Record / 查看单条记录

**English:**
1. In the record list, click any row
2. The record details will expand on the right
3. You can see all fields and their values

**中文：**
1. 在记录列表中，点击任意一行
2. 右侧会展开该记录的详细信息
3. 可以看到所有字段和对应的值

---

## Modifying Records / 修改记录

**English:**
1. Click the record you want to modify to expand details
2. Click the **"Edit"** button in the top right
3. Modify the field values directly
4. Click **"Save"** to confirm changes

**中文：**
1. 点击要修改的记录，展开详情
2. 点击右上角的**「编辑」**按钮
3. 直接修改字段的值
4. 点击**「保存」**按钮确认修改

### Common Modification Scenarios / 常见修改场景

**Modifying a player's NTRP rating / 修改球员NTRP等级：**

*English:*
1. Go to the `players` collection
2. Find the player's record
3. Modify the `ntrp` field value (e.g., 3.5, 4.0)

*中文：*
1. 进入 `players` 集合
2. 找到对应球员的记录
3. 修改 `ntrp` 字段的值（如 3.5、4.0）

**Setting an administrator / 设置管理员：**

*English:*
1. Go to the `settings` collection
2. Find the record with `_id` of `core`
3. Add the user's OpenID to the `adminOpenIds` array

*中文：*
1. 进入 `settings` 集合
2. 找到 `_id` 为 `core` 的记录
3. 在 `adminOpenIds` 数组中添加用户的 OpenID

---

## Adding New Records / 添加新记录

**English:**
1. Click the **"Add Record"** button in the top right of the collection
2. Enter data in JSON format
3. Click **"Confirm"** to save

**中文：**
1. 点击集合右上角的**「添加记录」**按钮
2. 输入 JSON 格式的数据
3. 点击**「确定」**保存

---

## Deleting Records / 删除记录

**English:**
1. In the record list, check the records you want to delete
2. Click the **"Delete"** button
3. Confirm the deletion

**中文：**
1. 在记录列表中，勾选要删除的记录
2. 点击**「删除」**按钮
3. 确认删除操作

**Warning / 注意：** Deletion cannot be undone. Proceed with caution! / 删除操作不可撤销，请谨慎操作！

---

## Searching Records / 搜索记录

**English:**
1. There is a search box above the record list
2. Enter query conditions in JSON format, for example:
   - Find a specific player: `{"name": "John"}`
   - Find male players: `{"gender": "male"}`
   - Find signups for a specific event: `{"eventId": "xxx"}`

**中文：**
1. 在记录列表上方有搜索框
2. 输入查询条件，格式为 JSON，例如：
   - 查找特定球员：`{"name": "张三"}`
   - 查找男性球员：`{"gender": "male"}`
   - 查找特定活动的报名：`{"eventId": "xxx"}`

---

## Exporting Data / 导出数据

**English:**
1. Select the collection to export
2. Click the **"Export"** button in the top right
3. Choose the export format (JSON or CSV)
4. Download the exported file

**中文：**
1. 选择要导出的集合
2. 点击右上角**「导出」**按钮
3. 选择导出格式（JSON 或 CSV）
4. 下载导出的文件

---

## FAQ / 常见问题

**Q: Can't find the Cloud Development button? / 找不到云开发按钮？**

A: Make sure you're using WeChat DevTools version 2.2.3 or higher. / 确保使用的是微信开发者工具 2.2.3 或更高版本

**Q: Changes not taking effect? / 修改后数据没有生效？**

A: Refresh the mini program or recompile to load the latest data. / 刷新小程序或重新编译，确保读取最新数据

**Q: How to modify data in bulk? / 如何批量修改数据？**

A: Export data as JSON, modify it, then re-import; or use cloud functions for batch operations. / 可以导出数据为 JSON，修改后重新导入；或使用云函数批量操作
