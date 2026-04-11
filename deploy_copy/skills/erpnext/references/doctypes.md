# ERPNext DocType 参考

## 主数据 (Master Data)

### Customer (客户)

```bash
erpnext list Customer
erpnext get Customer CUST-00001
```

**关键字段:**
- `name`: 客户编号 (自动生成)
- `customer_name`: 客户名称
- `customer_type`: 客户类型 (Company / Individual)
- `customer_group`: 客户组
- `territory`: 区域
- `customer_primary_contact`: 主联系人
- `customer_primary_email`: 主邮箱

### Supplier (供应商)

```bash
erpnext list Supplier
erpnext create Supplier '{"supplier_name":"ACME Corp","supplier_type":"Company"}'
```

**关键字段:**
- `name`: 供应商编号
- `supplier_name`: 供应商名称
- `supplier_type`: 类型 (Company / Individual)
- `supplier_group`: 供应商组

### Item (物料)

```bash
erpnext list Item
erpnext create Item '{"item_code":"ITEM-001","item_name":"Test Item","item_group":"All Item Groups","stock_uom":"Nos"}'
```

**关键字段:**
- `item_code`: 物料编码
- `item_name`: 物料名称
- `item_group`: 物料组
- `stock_uom`: 库存单位
- `is_stock_item`: 是否库存物料
- `valuation_rate`:  valuation_rate

---

## 销售模块

### Sales Order (销售订单)

```bash
erpnext list "Sales Order" --filters '{"status":"Open"}'
erpnext get "Sales Order" SO-00001
```

**关键字段:**
- `name`: 订单编号
- `customer`: 客户
- `transaction_date`: 订单日期
- `delivery_date`: 交货日期
- `status`: 状态 (Draft / Submitted / Part Delivered / Delivered / Closed / Cancelled)
- `per_delivered`: 已交货百分比
- `grand_total`: 订单总额
- `items`: 订单明细

### Sales Invoice (销售发票)

```bash
erpnext list "Sales Invoice"
erpnext create "Sales Invoice" '{"customer":"CUST-00001","is_pos":0}'
```

### Quotation (报价单)

```bash
erpnext list Quotation --filters '{"docstatus":1}'
```

### Delivery Note (交货单)

```bash
erpnext list "Delivery Note" --filters '{"status":["!=","Cancelled"]}'
```

---

## 采购模块

### Purchase Order (采购订单)

```bash
erpnext list "Purchase Order" --filters '{"status":"Open"}'
erpnext create "Purchase Order" '{"supplier":"SUP-00001","schedule_date":"2024-02-01"}'
```

### Purchase Invoice (采购发票)

### Supplier Quotation (供应商报价)

---

## 库存模块

### Stock Entry (库存交易)

```bash
erpnext list "Stock Entry" --filters '{"stock_entry_type":"Material Receipt"}'
```

**stock_entry_type 值:**
- `Material Receipt` - 物料入库
- `Material Issue` - 物料出库
- `Material Transfer` - 物料调拨
- `Manufacture` - 生产

### Warehouse (仓库)

```bash
erpnext list Warehouse
erpnext create Warehouse '{"warehouse_name":"Store - NYC","is_group":0}'
```

### Stock Ledger Entry (库存台账)

---

## 财务模块

### Journal Entry (凭证)

### Payment Entry (付款单)

---

## 项目模块

### Project (项目)

```bash
erpnext list Project --filters '{"status":"Open"}'
erpnext create Project '{"project_name":"New Project","status":"Open"}'
```

### Task (任务)

---

## 常用过滤器示例

```bash
# 开放的客户订单
erpnext list "Sales Order" --filters '{"status":"Open"}'

# 特定客户的订单
erpnext list "Sales Order" --filters '{"customer":"CUST-00001"}'

# 已取消的单据
erpnext list "Sales Order" --filters '{"docstatus":0}'

# 日期范围
erpnext list "Sales Order" --filters '{"transaction_date":["between",["2024-01-01","2024-12-31"]]}'

# 模糊搜索
erpnext list Customer --filters '{"customer_name":["like","%Corp%"]}'
```
