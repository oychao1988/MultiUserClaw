# ERPNext REST API 参考

## 认证

### Token 认证 (推荐)

```http
Authorization: token api_key:api_secret
```

凭证从 SCMClaw Gateway API 获取：
```
GET http://gateway:8080/api/erpnext/credentials
```

**注意**: 在 User 容器中运行时，Gateway API 通过 Docker 网络可访问 (`http://gateway:8080`)。

## 网络要求

ERPNext 服务必须与 User 容器网络互通。确保：

1. ERPNext 和 MultiuserClaw 在同一 Docker 网络，或
2. ERPNext 使用外部可访问地址（如 `http://host.docker.internal:8000`）

配置示例：
```bash
# 设置 ERPNext URL（如果使用外部地址）
export ERPNEXT_URL=http://host.docker.internal:8000
```

## API 端点

### V2 API (推荐)

| 操作 | 端点 | 方法 |
|------|------|------|
| 列表 | `/api/v2/document/{doctype}` | GET |
| 获取 | `/api/v2/document/{doctype}/{name}` | GET |
| 创建 | `/api/v2/document/{doctype}` | POST |
| 更新 | `/api/v2/document/{doctype}/{name}` | PUT |
| 删除 | `/api/v2/document/{doctype}/{name}` | DELETE |

### V1 API (旧版)

| 操作 | 端点 | 方法 |
|------|------|------|
| 列表 | `/api/resource/{doctype}` | GET |
| 获取 | `/api/resource/{doctype}/{name}` | GET |
| 创建 | `/api/resource/{doctype}` | POST |
| 更新 | `/api/resource/{doctype}/{name}` | PUT/PATCH |
| 删除 | `/api/resource/{doctype}/{name}` | DELETE |

## 列表参数

### V2 参数

```json
{
  "filters": {"status": "Open", "customer": "CUST-00001"},
  "fields": ["name", "customer_name", "grand_total"],
  "limit": 20,
  "start": 0,
  "order_by": "creation desc"
}
```

### V1 参数

```json
{
  "filters": [["Sales Order", "status", "=", "Open"]],
  "fields": ["name", "customer_name", "grand_total"],
  "limit_page_length": 20,
  "limit_start": 0
}
```

## 过滤器运算符

| 运算符 | 说明 |
|--------|------|
| `=` | 等于 |
| `!=` | 不等于 |
| `>` | 大于 |
| `<` | 小于 |
| `>=` | 大于等于 |
| `<=` | 小于等于 |
| `like` | 模糊匹配 |
| `in` | 在列表中 |
| `not in` | 不在列表中 |
| `between` | 范围 |

## 方法端点

```http
GET/POST /api/method/{module}.{function}
```

### 常用方法

| 方法 | 说明 |
|------|------|
| `frappe.auth.get_logged_user` | 获取当前登录用户 |
| `frappe.client.get_value` | 获取单个字段值 |
| `frappe.client.get_list` | 获取文档列表 |
| `frappe.client.get` | 获取单个文档 |
| `frappe.client.insert` | 插入文档 |
| `frappe.client.set_value` | 设置字段值 |
| `frappe.client.delete` | 删除文档 |

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 权限不足 |
| 404 | 文档不存在 |
| 417 | 业务逻辑错误 |
| 500 | 服务器内部错误 |
