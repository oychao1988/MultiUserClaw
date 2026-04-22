#!/usr/bin/env python3
"""
ERPNext API Client CLI

从 SCMClaw Gateway API 获取凭证，调用 ERPNext REST API。

用法:
    erpnext <command> [args...]

命令:
    list <doctype>           列出文档
    get <doctype> <name>     获取单个文档
    create <doctype> <json>  创建文档
    update <doctype> <name> <json>  更新文档
    delete <doctype> <name>   删除文档
    call <method> [json]     调用方法
    credentials              显示当前凭证
    ping                     测试连接
"""

import json
import os
import re
import socket
import sys
import argparse
from typing import Optional

import requests

# Gateway API 地址
GATEWAY_URL = os.environ.get("PLATFORM_GATEWAY_URL", "http://gateway:8080")


def resolve_erpnext_url(url: str) -> str:
    """解析 ERPNext URL，处理容器内访问的情况。

    如果 URL 中的主机名无法解析或访问，则尝试使用 host.docker.internal。
    """
    if not url:
        return url

    try:
        # 解析 URL
        parsed = re.match(r'^(https?://)([^:/]+)(:\d+)?(/.*)?$', url)
        if not parsed:
            return url

        scheme, host, port, path = parsed.groups()

        # 检查是否是本机地址
        if host in ('localhost', '127.0.0.1', 'host.docker.internal'):
            return url

        # 尝试解析主机名
        try:
            socket.gethostbyname(host)
            return url  # 可以解析，直接返回
        except socket.gaierror:
            pass

        # 无法解析，尝试 host.docker.internal
        try:
            socket.gethostbyname("host.docker.internal")
            new_port = port or ":8000"
            return f"{scheme}host.docker.internal{new_port}{path or '/'}"
        except socket.gaierror:
            pass

        return url
    except Exception:
        return url


def get_credentials() -> dict:
    """Get ERPNext credentials. Priority: environment variables > Gateway API."""
    # 1. Try environment variables first (user-level credentials in container)
    env_url = os.environ.get("ERPNEXT_URL", "")
    env_key = os.environ.get("ERPNEXT_API_KEY", "")
    env_secret = os.environ.get("ERPNEXT_API_SECRET", "")

    if env_url and env_key:
        return {
            "url": env_url,
            "api_key": env_key,
            "api_secret": env_secret,
        }

    # 2. Fallback to Gateway API (legacy/global credentials)
    try:
        resp = requests.get(f"{GATEWAY_URL}/api/erpnext/credentials", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return {
            "url": data.get("url", ""),
            "api_key": data.get("api_key", ""),
            "api_secret": data.get("api_secret", ""),
        }
    except Exception as e:
        print(f"获取凭证失败: {e}", file=sys.stderr)
        return {"url": "", "api_key": "", "api_secret": ""}


def get_erpnext_client(creds: dict) -> "ERPNextClient":
    """创建 ERPNext API 客户端"""
    if not creds["url"] or not creds["api_key"]:
        raise ValueError("ERPNext 凭证未配置，请先在设置页面配置")
    # 解析 URL，处理容器内访问
    resolved_url = resolve_erpnext_url(creds["url"])
    if resolved_url != creds["url"]:
        print(f"URL 已解析: {creds['url']} -> {resolved_url}", file=sys.stderr)
    return ERPNextClient(resolved_url, creds["api_key"], creds["api_secret"])


class ERPNextClient:
    """ERPNext API 客户端"""

    def __init__(self, url: str, api_key: str, api_secret: str):
        self.url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"token {api_key}:{api_secret}",
            "Content-Type": "application/json",
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """发送请求"""
        url = f"{self.url}{endpoint}"
        try:
            resp = self.session.request(method, url, timeout=30, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            try:
                error_data = e.response.json()
                print(f"API 错误: {error_data}", file=sys.stderr)
            except:
                print(f"HTTP 错误: {e}", file=sys.stderr)
            raise

    def list(self, doctype: str, filters: Optional[dict] = None,
             fields: Optional[list] = None, limit: int = 20,
             start: int = 0, use_v2: bool = True) -> dict:
        """列出文档"""
        if use_v2:
            params = {"limit": limit, "start": start}
            if filters:
                params["filters"] = filters
            if fields:
                params["fields"] = fields
            return self._request("GET", f"/api/v2/document/{doctype}", params=params)
        else:
            params = {"limit_page_length": limit, "limit_start": start}
            if filters:
                # V1 格式转换
                v1_filters = [[doctype, k, "=", v] for k, v in filters.items()]
                params["filters"] = json.dumps(v1_filters)
            if fields:
                params["fields"] = json.dumps(fields)
            return self._request("GET", f"/api/resource/{doctype}", params=params)

    def get(self, doctype: str, name: str) -> dict:
        """获取单个文档"""
        return self._request("GET", f"/api/resource/{doctype}/{name}")

    def create(self, doctype: str, data: dict) -> dict:
        """创建文档"""
        return self._request("POST", f"/api/resource/{doctype}", json=data)

    def update(self, doctype: str, name: str, data: dict) -> dict:
        """更新文档"""
        return self._request("PUT", f"/api/resource/{doctype}/{name}", json=data)

    def delete(self, doctype: str, name: str) -> dict:
        """删除文档"""
        return self._request("DELETE", f"/api/resource/{doctype}/{name}")

    def call(self, method: str, data: Optional[dict] = None) -> dict:
        """调用白名单方法"""
        return self._request("POST", f"/api/method/{method}", json=data or {})

    def ping(self) -> dict:
        """测试连接"""
        return self.call("frappe.auth.get_logged_user")


def format_output(data: dict, format_type: str = "json") -> str:
    """格式化输出"""
    if format_type == "json":
        return json.dumps(data, ensure_ascii=False, indent=2)
    elif format_type == "compact":
        if "data" in data:
            return json.dumps(data["data"], ensure_ascii=False)
        return json.dumps(data, ensure_ascii=False)
    return str(data)


def cmd_list(args: list) -> int:
    """列出文档"""
    creds = get_credentials()
    client = get_erpnext_client(creds)

    filters = None
    if args.filters:
        try:
            filters = json.loads(args.filters)
        except json.JSONDecodeError:
            print(f"过滤器格式错误: {args.filters}", file=sys.stderr)
            return 1

    fields = None
    if args.fields:
        try:
            fields = json.loads(args.fields)
        except json.JSONDecodeError:
            print(f"字段格式错误: {args.fields}", file=sys.stderr)
            return 1

    result = client.list(
        args.doctype,
        filters=filters,
        fields=fields,
        limit=args.limit or 20,
        start=args.start or 0,
        use_v2=not args.v1,
    )

    print(format_output(result, args.format))
    return 0


def cmd_get(args: list) -> int:
    """获取单个文档"""
    creds = get_credentials()
    client = get_erpnext_client(creds)
    result = client.get(args.doctype, args.name)
    print(format_output(result, args.format))
    return 0


def cmd_create(args: list) -> int:
    """创建文档"""
    try:
        data = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"JSON 格式错误: {e}", file=sys.stderr)
        return 1

    creds = get_credentials()
    client = get_erpnext_client(creds)
    result = client.create(args.doctype, data)
    print(format_output(result, args.format))
    return 0


def cmd_update(args: list) -> int:
    """更新文档"""
    try:
        data = json.loads(args.data)
    except json.JSONDecodeError as e:
        print(f"JSON 格式错误: {e}", file=sys.stderr)
        return 1

    creds = get_credentials()
    client = get_erpnext_client(creds)
    result = client.update(args.doctype, args.name, data)
    print(format_output(result, args.format))
    return 0


def cmd_delete(args: list) -> int:
    """删除文档"""
    creds = get_credentials()
    client = get_erpnext_client(creds)
    result = client.delete(args.doctype, args.name)
    print(format_output(result, args.format))
    return 0


def cmd_call(args: list) -> int:
    """调用方法"""
    data = None
    if args.data:
        try:
            data = json.loads(args.data)
        except json.JSONDecodeError as e:
            print(f"JSON 格式错误: {e}", file=sys.stderr)
            return 1

    creds = get_credentials()
    client = get_erpnext_client(creds)
    result = client.call(args.method, data)
    print(format_output(result, args.format))
    return 0


def cmd_credentials(args: list) -> int:
    """显示凭证状态"""
    creds = get_credentials()

    if args.verbose:
        print("ERPNext 凭证状态:")
        print(f"  URL: {creds['url'] or '(未配置)'}")
        print(f"  API Key: {creds['api_key'][:8] + '...' if creds['api_key'] else '(未配置)'}")
        print(f"  API Secret: {'已配置' if creds['api_secret'] else '(未配置)'}")
    else:
        if creds["url"] and creds["api_key"]:
            print(f"已配置: {creds['url']}")
        else:
            print("未配置 ERPNext 凭证")
            return 1
    return 0


def cmd_ping(args: list) -> int:
    """测试连接"""
    creds = get_credentials()
    if not creds["url"] or not creds["api_key"]:
        print("ERPNext 凭证未配置", file=sys.stderr)
        return 1

    try:
        client = get_erpnext_client(creds)
        result = client.ping()
        user = result.get("message") or result.get("data") or result
        print(f"连接成功! 当前用户: {user}")
        return 0
    except Exception as e:
        print(f"连接失败: {e}", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="ERPNext API Client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  erpnext list Customer
  erpnext get Customer CUST-00001
  erpnext create Customer '{"customer_name":"Test","customer_type":"Company"}'
  erpnext list "Sales Order" --filters '{"status":"Open"}'
  erpnext credentials
  erpnext ping
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # list
    p_list = subparsers.add_parser("list", help="列出文档")
    p_list.add_argument("doctype", help="DocType 名称")
    p_list.add_argument("--filters", "-f", help="过滤条件 (JSON 格式)")
    p_list.add_argument("--fields", help="返回字段 (JSON 数组)")
    p_list.add_argument("--limit", "-l", type=int, help="返回数量")
    p_list.add_argument("--start", "-s", type=int, help="起始位置")
    p_list.add_argument("--v1", action="store_true", help="使用 V1 API")
    p_list.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # get
    p_get = subparsers.add_parser("get", help="获取单个文档")
    p_get.add_argument("doctype", help="DocType 名称")
    p_get.add_argument("name", help="文档名称")
    p_get.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # create
    p_create = subparsers.add_parser("create", help="创建文档")
    p_create.add_argument("doctype", help="DocType 名称")
    p_create.add_argument("data", help="文档数据 (JSON 格式)")
    p_create.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # update
    p_update = subparsers.add_parser("update", help="更新文档")
    p_update.add_argument("doctype", help="DocType 名称")
    p_update.add_argument("name", help="文档名称")
    p_update.add_argument("data", help="更新数据 (JSON 格式)")
    p_update.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # delete
    p_delete = subparsers.add_parser("delete", help="删除文档")
    p_delete.add_argument("doctype", help="DocType 名称")
    p_delete.add_argument("name", help="文档名称")
    p_delete.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # call
    p_call = subparsers.add_parser("call", help="调用方法")
    p_call.add_argument("method", help="方法名 (如 frappe.auth.get_logged_user)")
    p_call.add_argument("data", nargs="?", help="参数 (JSON 格式)")
    p_call.add_argument("--format", default="json", choices=["json", "compact"], help="输出格式")

    # credentials
    p_creds = subparsers.add_parser("credentials", help="显示凭证状态")
    p_creds.add_argument("--verbose", "-v", action="store_true", help="详细信息")

    # ping
    p_ping = subparsers.add_parser("ping", help="测试连接")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    commands = {
        "list": cmd_list,
        "get": cmd_get,
        "create": cmd_create,
        "update": cmd_update,
        "delete": cmd_delete,
        "call": cmd_call,
        "credentials": cmd_credentials,
        "ping": cmd_ping,
    }

    if args.command in commands:
        return commands[args.command](args)
    else:
        print(f"未知命令: {args.command}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
