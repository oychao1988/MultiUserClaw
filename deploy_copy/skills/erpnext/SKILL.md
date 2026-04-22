---
name: erpnext
description: ERPNext API client for managing ERP data. Use when user needs to query, create, update, or delete ERPNext records like customers, suppliers, items, sales orders, purchase orders, stock data, or any DocType operations. Triggers include "查询客户", "创建销售订单", "获取库存", "操作 ERPNext", "ERP 数据管理" and similar requests.
allowed-tools: Bash(erpnext:*), Bash(python3:*)
---

# ERPNext API Client

## Quick Start

ERPNext 凭证从 SCMClaw Gateway API 获取，Skill 自动处理认证。

```bash
# 列出所有客户
erpnext list Customer

# 获取单个客户
erpnext get Customer CUST-00001

# 创建客户
erpnext create Customer '{"customer_name":"Test Corp","customer_type":"Company"}'

# 列出销售订单
erpnext list "Sales Order" --filters '{"status":"Open"}'
```

## Credential Management

凭证优先从容器环境变量获取（用户级），回退到 Gateway API（全局共享）：

```bash
# 容器内自动注入（推荐方式）:
# ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET

# 查看当前凭证状态
erpnext credentials

# 测试连接
erpnext ping
```

**凭证优先级**: 容器环境变量 > Gateway API

**网络要求**: ERPNext 服务必须与 User 容器网络互通，或使用外部可访问地址。

## Core Commands

### `erpnext list <doctype>`

列出 DocType 文档（支持过滤、分页）。

```bash
# 基础列表（默认返回 20 条）
erpnext list Customer

# 指定字段
erpnext list Customer --fields '["name","customer_name","customer_type"]'

# 过滤条件（V2 格式）
erpnext list "Sales Order" --filters '{"status":"Open"}'

# 分页
erpnext list Customer --limit 50 --start 0
```

### `erpnext get <doctype> <name>`

获取单个文档详情。

```bash
erpnext get Customer CUST-00001
erpnext get "Sales Order" SO-00001
```

### `erpnext create <doctype> <json>`

创建新文档。

```bash
erpnext create Customer '{"customer_name":"New Customer","customer_type":"Company","customer_group":"Commercial","territory":"All Territories"}'
```

### `erpnext update <doctype> <name> <json>`

更新现有文档。

```bash
erpnext update Customer CUST-00001 '{"customer_name":"Updated Name"}'
```

### `erpnext delete <doctype> <name>`

删除文档。

```bash
erpnext delete Customer CUST-00003
```

### `erpnext call <method> <json>`

调用白名单 Python 方法。

```bash
# 获取当前登录用户
erpnext call frappe.auth.get_logged_user

# 获取字段值
erpnext call frappe.client.get_value '{"doctype":"Customer","fieldname":"customer_name","filters":{"name":"CUST-00001"}}'
```

## Common DocTypes

| DocType | 说明 | 关键字段 |
|---------|------|----------|
| `Customer` | 客户 | customer_name, customer_type, customer_group |
| `Supplier` | 供应商 | supplier_name, supplier_type, supplier_group |
| `Item` | 物料 | item_code, item_name, item_group, stock_uom |
| `Sales Order` | 销售订单 | customer, delivery_date, per_delivered |
| `Purchase Order` | 采购订单 | supplier, schedule_date |
| `Sales Invoice` | 销售发票 | customer, is_pos |
| `Delivery Note` | 交货单 | customer, against_sales_order |
| `Stock Entry` | 库存交易 | stock_entry_type, items |
| `Warehouse` | 仓库 | warehouse_name |

## Filter Operators

V1 过滤器格式：
```
[["DocType", "field", "operator", "value"]]
```

支持的运算符：`=`, `!=`, `>`, `<`, `>=`, `<=`, `like`, `in`, `not in`, `between`

V2 过滤器格式（推荐）：
```json
{"field": "value", "field2": "value2"}
```

## Output Formats

```bash
# JSON 输出（默认）
erpnext list Customer

# 格式化输出
erpnext list Customer --format table

# 只显示 data 字段
erpnext list Customer --compact
```

## Error Handling

```bash
# 查看详细错误
erpnext get Customer INVALID-NAME --verbose

# 检查凭证状态
erpnext credentials --verbose
```

## Reference Documentation

| 文档 | 说明 |
|------|------|
| [references/api.md](references/api.md) | 完整 API 参考 |
| [references/doctypes.md](references/doctypes.md) | DocType 字段说明 |
