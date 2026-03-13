#!/usr/bin/env python3
"""OpenClaw 本地开发启动脚本（跨平台：macOS / Linux / Windows）。

一键启动所有本地开发服务：
  1. PostgreSQL (Docker 容器, 端口 5432)
  2. openclaw bridge 后端 (端口 18080)
  3. platform gateway (端口 8080)
  4. frontend dev server (端口 3080)

用法:
  # 启动所有服务（默认局域网可访问）
  python start_local.py

  # 仅启动部分服务
  python start_local.py --only db,gateway,frontend

  # 跳过某些服务
  python start_local.py --skip bridge

  # 停止所有服务
  python start_local.py --stop
"""

import argparse
import os
import shutil
import signal
import subprocess
import sys
import threading
import time

# ── 平台检测 ─────────────────────────────────────────────────────────
IS_WINDOWS = sys.platform == "win32"

# ── 颜色输出 ──────────────────────────────────────────────────────────
GREEN = "\033[32m"
RED   = "\033[31m"
YELLOW = "\033[33m"
CYAN  = "\033[36m"
BOLD  = "\033[1m"
DIM   = "\033[2m"
RESET = "\033[0m"

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 服务配置 ──────────────────────────────────────────────────────────
SERVICES = {
    "db": {
        "name": "PostgreSQL",
        "port": 5432,
        "color": "\033[34m",
    },
    "bridge": {
        "name": "OpenClaw Bridge",
        "port": 18080,
        "color": "\033[35m",
    },
    "gateway": {
        "name": "Platform Gateway",
        "port": 8080,
        "color": "\033[36m",  # cyan
    },
    "frontend": {
        "name": "Frontend Dev",
        "port": 3080,
        "color": "\033[33m",  # yellow
    },
}


# ── 工具函数 ──────────────────────────────────────────────────────────

def log(msg: str, color: str = CYAN):
    print(f"{color}{BOLD}▸{RESET} {msg}")


def success(msg: str):
    print(f"{GREEN}✓{RESET} {msg}")


def error(msg: str):
    print(f"{RED}✗{RESET} {msg}")


def warn(msg: str):
    print(f"{YELLOW}⚠{RESET} {msg}")


def is_port_in_use(port: int) -> bool:
    """检查端口是否被占用。"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_for_port(port: int, timeout: int = 30, name: str = "") -> bool:
    """等待端口可用。"""
    for i in range(timeout):
        if is_port_in_use(port):
            return True
        time.sleep(1)
        sys.stdout.write(f"\r  等待 {name or f'端口 {port}'}... ({i + 1}/{timeout}s)")
        sys.stdout.flush()
    print()
    return False


def _base_env(**extra) -> dict:
    """构建子进程环境变量，Windows 上额外注入 PYTHONIOENCODING=utf-8。"""
    env = {**os.environ}
    if IS_WINDOWS:
        env["PYTHONIOENCODING"] = "utf-8"
    env.update(extra)
    return env


# ── PostgreSQL ────────────────────────────────────────────────────────

def start_postgres() -> bool:
    """启动 PostgreSQL Docker 容器。"""
    log("启动 PostgreSQL...")

    # 检查是否已有容器在运行
    result = subprocess.run(
        ["docker", "ps", "-q", "--filter", "name=^openclaw-local-postgres$"],
        capture_output=True, text=True,
    )
    if result.stdout.strip():
        success("PostgreSQL 已在运行")
        return True

    # 检查是否有已停止的容器
    result = subprocess.run(
        ["docker", "ps", "-aq", "--filter", "name=^openclaw-local-postgres$"],
        capture_output=True, text=True,
    )
    if result.stdout.strip():
        log("启动已有的 PostgreSQL 容器...")
        subprocess.run(["docker", "start", "openclaw-local-postgres"], check=True)
    else:
        log("创建新的 PostgreSQL 容器...")
        subprocess.run([
            "docker", "run", "-d",
            "--name", "openclaw-local-postgres",
            "-e", "POSTGRES_USER=nanobot",
            "-e", "POSTGRES_PASSWORD=nanobot",
            "-e", "POSTGRES_DB=nanobot_platform",
            "-v", "openclaw-local-pgdata:/var/lib/postgresql/data",
            "-p", "5432:5432",
            "postgres:16-alpine",
        ], check=True)

    if wait_for_port(5432, timeout=15, name="PostgreSQL"):
        success("PostgreSQL 就绪 (端口 5432)")
        return True
    else:
        error("PostgreSQL 启动超时")
        return False


def stop_postgres():
    """停止 PostgreSQL 容器。"""
    subprocess.run(["docker", "stop", "openclaw-local-postgres"], capture_output=True)
    success("PostgreSQL 已停止")


# ── OpenClaw Bridge ───────────────────────────────────────────────────

def start_bridge(env: dict) -> "subprocess.Popen | None":
    log("启动 OpenClaw Bridge 后端 (端口 18080)...")

    if is_port_in_use(18080):
        warn("端口 18080 已被占用，跳过 bridge")
        return None

    bridge_dir = os.path.join(PROJECT_DIR, "openclaw")

    # 优先使用 tsx 开发模式，否则使用编译后的 JS
    tsx_path = shutil.which("tsx")
    if tsx_path:
        cmd = [tsx_path, "bridge/start.ts"]
    else:
        npx_path = shutil.which("npx")
        if npx_path:
            cmd = [npx_path, "tsx", "bridge/start.ts"]
        else:
            cmd = ["node", "bridge/dist/start.js"]

    proc = subprocess.Popen(
        cmd,
        cwd=bridge_dir,
        env=_base_env(**env),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    log(f"  PID: {proc.pid}")

    # 等待就绪再启动 gateway，避免 gateway 代理时返回 503
    # 首次启动可能需要编译 openclaw（较慢），后续启动会快很多
    if wait_for_port(18080, timeout=120, name="OpenClaw Bridge"):
        success("OpenClaw Bridge 就绪 (端口 18080)")
    else:
        warn("OpenClaw Bridge 尚未就绪（首次启动需要编译 openclaw），继续启动其他服务")

    return proc


# ── Platform Gateway ──────────────────────────────────────────────────

def start_gateway(env: dict) -> "subprocess.Popen | None":
    log("启动 Platform Gateway (端口 8080)...")

    if is_port_in_use(8080):
        warn("端口 8080 已被占用，跳过 gateway")
        return None

    proc_env = _base_env(
        PLATFORM_DATABASE_URL="postgresql+asyncpg://nanobot:nanobot@localhost:5432/nanobot_platform",
        # 本地开发模式：直接代理到本机 openclaw web，跳过 Docker 容器管理
        PLATFORM_DEV_OPENCLAW_URL="http://127.0.0.1:18080",
        # WebSocket 直连 OpenClaw Gateway（跳过 Bridge 的聊天中转）
        PLATFORM_DEV_GATEWAY_URL="ws://127.0.0.1:18789",
        **env,
    )

    # 从项目根目录 .env 读取配置并注入 PLATFORM_ 前缀
    # 需要转发的变量：所有 *_API_KEY、*_API_BASE、JWT_SECRET、DEFAULT_MODEL
    _EXTRA_ENV_KEYS = {"JWT_SECRET", "DEFAULT_MODEL"}
    env_path = os.path.join(PROJECT_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    key, val = key.strip(), val.strip().strip("'\"")
                    if key.endswith(("_API_KEY", "_API_BASE")) or key in _EXTRA_ENV_KEYS:
                        platform_key = f"PLATFORM_{key}"
                        proc_env.setdefault(platform_key, val)

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", "8080", "--reload"],
        cwd=os.path.join(PROJECT_DIR, "platform"),
        env=proc_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    log(f"  PID: {proc.pid}")
    return proc


# ── Frontend Dev Server ───────────────────────────────────────────────

def start_frontend() -> "subprocess.Popen | None":
    log("启动 Frontend Dev Server (端口 3080)...")

    if is_port_in_use(3080):
        warn("端口 3080 已被占用，跳过 frontend")
        return None

    frontend_dir = os.path.join(PROJECT_DIR, "frontend")

    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        log("安装前端依赖...")
        # shell=True + 字符串命令在两个平台都能正确找到 npm / npm.cmd
        subprocess.run("npm install", cwd=frontend_dir, shell=True, check=True)

    # 让 vite 明确绑定到指定网卡，支持其他设备访问
    dev_cmd = f"npm run dev -- --host {frontend_host} --port 3080"
    proc = subprocess.Popen(
        dev_cmd,
        cwd=frontend_dir,
        env=_base_env(VITE_API_URL=api_url),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=True,
        **({"start_new_session": True} if not IS_WINDOWS else {}),
    )
    log(f"  PID: {proc.pid}")
    return proc


# ── 日志输出（跨平台：threading，不依赖 selectors/os.set_blocking）────

def tail_output(procs: dict):
    stop_event = threading.Event()

    def _reader(name: str, proc: "subprocess.Popen"):
        svc = SERVICES.get(name, {})
        color = svc.get("color", CYAN)
        try:
            for raw in iter(proc.stdout.readline, b""):
                if stop_event.is_set():
                    break
                text = raw.decode("utf-8", errors="replace").rstrip()
                if text:
                    print(f"{color}[{name:>8}]{RESET} {text}", flush=True)
        except (OSError, ValueError):
            pass

    threads = []
    for name, proc in procs.items():
        if proc and proc.stdout:
            t = threading.Thread(target=_reader, args=(name, proc), daemon=True)
            t.start()
            threads.append(t)

    try:
        while any(p.poll() is None for p in procs.values() if p):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        for t in threads:
            t.join(timeout=2)


# ── 停止所有服务 ──────────────────────────────────────────────────────

def stop_all():
    log("停止所有本地服务...")
    stop_postgres()

    if IS_WINDOWS:
        _stop_all_windows()
    else:
        _stop_all_unix()

    success("所有服务已停止")


def _stop_all_unix():
    patterns = ["bridge/start", "openclaw gateway", "uvicorn app.main:app", "vite.*3080"]
    for pattern in patterns:
        result = subprocess.run(
            f"pgrep -f '{pattern}'",
            shell=True, capture_output=True, text=True,
        )
        for pid in result.stdout.strip().split("\n"):
            pid = pid.strip()
            if pid.isdigit():
                try:
                    os.kill(int(pid), signal.SIGTERM)
                    log(f"  终止进程 {pid} ({pattern})")
                except (ProcessLookupError, ValueError):
                    pass


def _stop_all_windows():
    # 进程名 → 用 tasklist 过滤
    image_names = ["openclaw.exe", "python.exe", "node.exe"]
    for image in image_names:
        try:
            result = subprocess.run(
                f'tasklist /FI "IMAGENAME eq {image}" /FO CSV /NH',
                shell=True, capture_output=True, text=True,
            )
            for line in result.stdout.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("INFO:") or "," not in line:
                    continue
                parts = line.split(",")
                if len(parts) >= 2:
                    pid = parts[1].strip('"').strip()
                    if pid.isdigit():
                        try:
                            os.kill(int(pid), signal.SIGTERM)
                            log(f"  终止进程 {pid} ({image})")
                        except (ProcessLookupError, PermissionError, OSError):
                            pass
        except Exception:
            pass


# ── deploy_copy 同步 ─────────────────────────────────────────────────

def sync_deploy_copy():
    """将 deploy_copy 目录中的模板文件同步到 ~/.openclaw/。

    仅在目标文件不存在时复制（不覆盖用户已有配置）。
    openclaw_defaults.json 中的配置项会合并到 openclaw.json（不覆盖已有项）。
    """
    deploy_dir = os.path.join(PROJECT_DIR, "deploy_copy")
    if not os.path.isdir(deploy_dir):
        return

    openclaw_home = os.path.join(os.path.expanduser("~"), ".openclaw")
    log("同步 deploy_copy 模板文件...")

    copied = 0

    # 1. 同步 workspace/ 目录（AGENTS.md, SOUL.md, USER.md 等）
    src_workspace = os.path.join(deploy_dir, "workspace")
    dst_workspace = os.path.join(openclaw_home, "workspace")
    if os.path.isdir(src_workspace):
        os.makedirs(dst_workspace, exist_ok=True)
        copied += _sync_dir(src_workspace, dst_workspace)

    # 2. 同步 skills/ 目录
    src_skills = os.path.join(deploy_dir, "skills")
    dst_skills = os.path.join(openclaw_home, "skills")
    if os.path.isdir(src_skills):
        os.makedirs(dst_skills, exist_ok=True)
        copied += _sync_dir(src_skills, dst_skills)

    # 3. 合并 openclaw_defaults.json 到 openclaw.json
    defaults_path = os.path.join(deploy_dir, "openclaw_defaults.json")
    config_path = os.path.join(openclaw_home, "openclaw.json")
    if os.path.isfile(defaults_path):
        _merge_openclaw_defaults(defaults_path, config_path)

    if copied > 0:
        success(f"同步了 {copied} 个模板文件到 ~/.openclaw/")
    else:
        success("deploy_copy 模板已就绪（无新文件需同步）")


def _sync_dir(src: str, dst: str) -> int:
    """递归同步目录，仅复制目标不存在的文件。返回复制的文件数。"""
    copied = 0
    for root, dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        dst_root = os.path.join(dst, rel) if rel != "." else dst
        os.makedirs(dst_root, exist_ok=True)
        for f in files:
            src_file = os.path.join(root, f)
            dst_file = os.path.join(dst_root, f)
            if not os.path.exists(dst_file):
                shutil.copy2(src_file, dst_file)
                log(f"  + {os.path.relpath(dst_file, os.path.expanduser('~'))}")
                copied += 1
    return copied


def _merge_openclaw_defaults(defaults_path: str, config_path: str):
    """将 defaults 中的配置项浅合并到 openclaw.json（不覆盖已有顶层 key）。"""
    try:
        with open(defaults_path) as f:
            defaults = json.load(f)
    except (json.JSONDecodeError, OSError):
        return

    if not os.path.isfile(config_path):
        return

    try:
        with open(config_path) as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError):
        return

    changed = False
    for key, value in defaults.items():
        if key not in config:
            config[key] = value
            changed = True
        elif isinstance(value, dict) and isinstance(config[key], dict):
            # 二级合并：仅添加不存在的子 key
            for sub_key, sub_value in value.items():
                if sub_key not in config[key]:
                    config[key][sub_key] = sub_value
                    changed = True

    if changed:
        with open(config_path, "w") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        log("  合并 openclaw_defaults.json → openclaw.json")


# ── 主入口 ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="OpenClaw 本地开发启动脚本")
    parser.add_argument("--stop", action="store_true", help="停止所有本地服务")
    parser.add_argument("--only", type=str, help="仅启动指定服务，逗号分隔 (db,bridge,gateway,frontend)")
    parser.add_argument("--skip", type=str, help="跳过指定服务，逗号分隔")
    parser.add_argument("--no-tail", action="store_true", help="不跟踪日志输出")
    parser.add_argument(
        "--public",
        action="store_true",
        help="开启局域网访问（frontend 绑定 0.0.0.0，并自动使用本机 LAN IP 作为 API 地址）",
    )
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="强制仅本机访问（frontend 绑定 127.0.0.1，API 使用 127.0.0.1）",
    )
    parser.add_argument(
        "--frontend-host",
        type=str,
        default="",
        help="前端 dev server 绑定地址（默认自动 0.0.0.0，可手动指定）",
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default="",
        help="前端访问的 Gateway 地址（默认自动使用探测到的局域网 IP）",
    )
    args = parser.parse_args()

    if args.stop:
        stop_all()
        return

    # 解析要启动的服务
    all_services = ["db", "bridge", "gateway", "frontend"]
    enabled = [s.strip() for s in args.only.split(",")] if args.only else list(all_services)
    if args.skip:
        skip = {s.strip() for s in args.skip.split(",")}
        enabled = [s for s in enabled if s not in skip]

    platform_label = "Windows" if IS_WINDOWS else ("macOS" if sys.platform == "darwin" else "Linux")
    print(f"\n{BOLD}🔧 OpenClaw 本地开发环境 ({platform_label}){RESET}\n")

    # 同步 deploy_copy 模板文件到 ~/.openclaw/, 用于部署时初始化，方便新用户不必每次都安装
    # sync_deploy_copy()
    # print()

    # ── 网络模式 ──────────────────────────────────────────────────────
    lan_ip = _detect_lan_ip()

    # 前端监听地址：手动指定 > local-only > 默认公网友好(0.0.0.0)
    if args.frontend_host:
        frontend_host = args.frontend_host
    elif args.local_only:
        frontend_host = "127.0.0.1"
    else:
        frontend_host = "0.0.0.0"

    # 前端 API 地址：手动指定 > local-only > 默认使用探测 LAN IP
    if args.api_url:
        frontend_api_url = args.api_url.rstrip("/")
    elif args.local_only:
        frontend_api_url = "http://127.0.0.1:8080"
    else:
        frontend_api_url = f"http://{lan_ip}:8080"

    # 启动前打印网络模式与 IP 探测结果，便于排障
    log(f"探测到局域网 IP: {lan_ip}")
    mode_label = "局域网可访问" if not args.local_only else "仅本机访问"
    log(f"访问模式: {mode_label}")
    if lan_ip == "127.0.0.1" and not args.local_only:
        warn("未探测到有效局域网 IP，已回退到 127.0.0.1；如需外部访问请手动指定 --api-url")

    log(f"启动服务: {', '.join(enabled)}")

    processes: dict = {}
    extra_env: dict = {}

    # Read .env and forward model config to bridge
    env_path = os.path.join(PROJECT_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    key, val = key.strip(), val.strip().strip("'\"")
                    if key == "DEFAULT_MODEL" and val:
                        # Strip provider prefix (e.g. "dashscope/qwen3-coder-plus" → "qwen3-coder-plus")
                        model = val.split("/", 1)[-1] if "/" in val else val
                        extra_env["NANOBOT_AGENTS__DEFAULTS__MODEL"] = model

    try:
        # 1. PostgreSQL
        if "db" in enabled:
            result = subprocess.run("docker info", shell=True, capture_output=True)
            if result.returncode != 0:
                error("Docker 未运行，无法启动 PostgreSQL")
                error("请先启动 Docker，或使用 --skip db 跳过")
                sys.exit(1)
            if not start_postgres():
                sys.exit(1)

        # 2. OpenClaw Bridge 后端（含就绪等待，gateway 代理依赖它）
        if "bridge" in enabled:
            proc = start_bridge(extra_env)
            if proc:
                processes["bridge"] = proc

        # 3. Platform Gateway
        if "gateway" in enabled:
            proc = start_gateway(extra_env)
            if proc:
                processes["gateway"] = proc

        # 短暂等待 gateway 启动，frontend 依赖它
        if "gateway" in enabled and "frontend" in enabled:
            time.sleep(2)

        # 4. Frontend
        if "frontend" in enabled:
            proc = start_frontend(frontend_host=frontend_host, api_url=frontend_api_url)
            if proc:
                processes["frontend"] = proc

        if not processes:
            success("所有服务已就绪（使用已有实例）")
            return

        # 打印访问信息
        display_host = "127.0.0.1" if args.local_only else lan_ip
        print(f"\n{BOLD}{'=' * 52}{RESET}")
        print(f"{BOLD}  本地开发环境已启动{RESET}")
        print(f"{'=' * 52}")
        for svc_id in enabled:
            svc = SERVICES[svc_id]
            if svc_id == "db":
                pid_info = "Docker 容器"
            elif svc_id in processes and processes[svc_id]:
                pid_info = f"PID {processes[svc_id].pid}"
            else:
                pid_info = "已有实例"
            print(f"  {svc['color']}{svc['name']:>20}{RESET}  http://{display_host}:{svc['port']}  ({pid_info})")
        if "frontend" in enabled:
            print(f"  {DIM}Frontend 绑定: {frontend_host} | VITE_API_URL={frontend_api_url}{RESET}")
        if not args.local_only and lan_ip != "127.0.0.1":
            print(f"  {DIM}局域网访问: http://{lan_ip}:3080{RESET}")
        print(f"{'=' * 52}")
        print(f"  {DIM}按 Ctrl+C 停止所有服务{RESET}\n")

        if not args.no_tail:
            tail_output(processes)
        else:
            # 等待所有进程
            for proc in processes.values():
                if proc:
                    proc.wait()

    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}正在停止服务...{RESET}")
    finally:
        # 清理进程
        for name, proc in processes.items():
            if proc and proc.poll() is None:
                log(f"停止 {name} (PID {proc.pid})...")
                # shell=True + start_new_session 的进程需要 kill 整个进程组
                if not IS_WINDOWS and name == "frontend":
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    except (ProcessLookupError, PermissionError):
                        proc.terminate()
                else:
                    proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    if not IS_WINDOWS and name == "frontend":
                        try:
                            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                        except (ProcessLookupError, PermissionError):
                            proc.kill()
                    else:
                        proc.kill()

        # 如果启动了 db，也停止它
        if "db" in enabled:
            stop_postgres()

        success("所有服务已停止")


if __name__ == "__main__":
    main()
