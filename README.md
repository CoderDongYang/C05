# 功能开关与灰度发布控制台

一套面向开发、测试、产品经理的线上功能开关配置管理系统。支持三环境隔离、精细灰度策略、变更审计回滚、模拟调试等企业级能力。

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         前端控制台 (React 18)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ 登录鉴权  │ │ 开关列表  │ │ 策略配置  │ │ 模拟调试/变更记录  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────────┬──────────┘   │
│       │             │            │                  │              │
│  ┌────▼─────────────▼────────────▼──────────────────▼──────────┐  │
│  │  Zustand+Immer 状态  │  TanStack Query 缓存  │  SSE 实时刷新  │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │ HTTP /api/* + SSE
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                      后端服务 (NestJS, 可多实例)                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ 鉴权+权限   │  │ 开关 CRUD   │  │ SDK 拉取   │  │ SSE 推送    │   │
│  │ RolesGuard │  │ ChangeLog  │  │ 100%缓存   │  │ 广播刷新    │   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘   │
│        │                │               │                │         │
│  ┌─────▼────────────────▼───────────────▼────────────────▼──────┐  │
│  │  Redis 本地内存缓存 + Redis Pub/Sub 多实例同步                │  │
│  └─────────────────────┬────────────────────────────────────────┘  │
└────────────────────────┼───────────────────────────────────────────┘
                         │
           ┌─────────────┴──────────────┐
           ▼                            ▼
    ┌──────────────┐             ┌──────────────┐
    │ PostgreSQL   │             │    Redis     │
    │ (持久化存储) │             │ (快照+消息总线)│
    └──────────────┘             └──────────────┘
```

---

## 🚀 快速启动

### 前置要求
- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 第一步：启动后端

```bash
cd backend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的数据库和Redis连接：
#   DATABASE_URL="postgresql://user:password@localhost:5432/feature_toggle?schema=public"
#   REDIS_URL="redis://localhost:6379"
#   JWT_SECRET="请改成一个足够复杂的随机字符串"
#   PORT=3000

# 3. 初始化数据库
npm run prisma:generate   # 生成 Prisma Client
npm run prisma:migrate    # 执行数据库迁移建表
npm run seed              # 初始化角色+用户+示例开关数据

# 4. 启动开发服务器
npm run start:dev
```

后端启动后监听 `http://localhost:3000`

### 第二步：启动前端

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量（一般默认即可，已配置代理到后端3000端口）
cp .env.example .env

# 3. 启动开发服务器
npm run dev
```

前端启动后访问 `http://localhost:5173`

---

## 🔐 默认账号

| 用户名 | 密码 | 角色 | 权限说明 |
|-------|------|------|---------|
| `admin` | `admin123` | ADMIN | 全部权限，可管理用户和角色 |
| `developer` | `dev123` | DEVELOPER | DEV/STAGING 读写，PROD 只读，不可改 PROD |
| `tester` | `test123` | TESTER | DEV/STAGING 读写白名单，PROD 只读 |
| `product` | `pm123` | PRODUCT_MANAGER | 全环境可读，可改 PROD 开关状态和灰度比例 |

前端登录页可直接用简化测试账号：`admin` / `dev` / `tester` / `pm` 任意密码即可。

---

## ✨ 五大核心功能

### 功能一：三环境隔离管理

页面顶部三个 Tab 切换 **开发环境 / 预发环境 / 生产环境**，开关配置完全独立。
- 同一个开关 Key 在三个环境可以有完全不同的灰度策略
- 生产关着，开发和预发可以开着验证
- 支持按负责人（TreeSelect 多选）、按 Key 模糊搜索筛选

### 功能二：四级灰度策略（配置策略弹窗）

| 策略类型 | 说明 | 优先级 |
|---------|------|-------|
| **全量开关** | 一键全开/全关，最简单粗暴 | 最高（关则直接false） |
| **白名单精准命中** | 批量粘贴用户ID，逗号或换行分隔，名单内必中 | 次高（命中即true） |
| **多维属性规则** | AND/OR 嵌套组合，支持 eq/ne/in/gt/lt/contains 6种操作符，如 `(城市=北京 AND 会员=VIP) OR 内部测试=true` | 中（不通过则false） |
| **百分比灰度** | 0-100整数，基于 userId 哈希取模稳定分流 | 最低（最后判断） |

> 多维属性规则使用递归的 **ConditionBuilder** 组件，支持任意深度的嵌套条件组，操作体验顺滑。

### 功能三：SDK 高性能拉取接口

**专供公司其他业务系统调用，不查数据库，纯内存+Redis运算。**

```bash
# GET 方式（简单场景）
curl "http://localhost:3000/api/sdk/config?env=PROD&userId=12345"

# POST 方式（带 tags 复杂属性）
curl -X POST http://localhost:3000/api/sdk/config \
  -H "Content-Type: application/json" \
  -d '{
    "env": "PROD",
    "userId": "12345",
    "tags": {
      "city": "北京",
      "memberLevel": "VIP",
      "isInternal": true,
      "device": "iOS"
    }
  }'
```

返回示例：
```json
{
  "code": 0,
  "data": {
    "feature.checkout_v2": true,
    "feature.new_recommend": false,
    "feature.ai_chat": true
  }
}
```

**QPS 保障设计：**
- 本地内存缓存优先，Redis 做二级，定时订阅 Pub/Sub 刷新
- Redis 宕机优雅降级，返回 `{}` 并打 error log，不阻塞主流程
- 所有规则计算同步完成，无数据库 IO

### 功能四：变更审计 + 一键回滚

- 开关的每一次修改（创建/更新/删除/回滚）都写入 `ChangeLog` 表
- 变更记录包含：谁改的、哪个环境、旧值 vs 新值、时间戳
- 右侧抽屉展示历史时间线，**每条记录带「回滚」按钮**
- 点击回滚 = 开关状态直接穿越恢复到该版本，回滚操作本身也写一条 ChangeLog

### 功能五：模拟调试小工具

页面右上角「模拟调试」按钮弹出面板：
- **预设身份快速选择**：内部测试用户 / 普通用户 / VIP会员 / 新注册用户
- **自定义 userId** 和 **自定义 tags（key-value 动态添加）**
- 点击「预览命中结果」→ 真实调后端 SDK 接口
- 表格展示该用户视角下 **每个开关的 true/false 命中状态**
- 发版前产品/开发自己拖拽规则，立刻验证是否生效

---

## 🧱 技术栈清单

### 前端
| 技术 | 用途 |
|-----|------|
| React 18 + TypeScript | 主框架，严格类型 |
| Vite 5 | 构建工具，开发秒启 |
| Ant Design 5 + @ant-design/pro-components | UI 库，ProTable 做开关列表 |
| Zustand + Immer | 状态管理，深层嵌套灰度规则无痛修改 |
| axios + @tanstack/react-query | 请求+缓存，列表自动去重刷新 |
| React Router v6 | 路由 |
| 原生 EventSource | SSE 接收后端广播的 refresh 信号 |

### 后端
| 技术 | 用途 |
|-----|------|
| NestJS 10 + TypeScript | 企业级 Node 框架 |
| Prisma 5 + PostgreSQL | ORM + 持久化 |
| ioredis + Redis Pub/Sub | 缓存快照 + 多实例缓存同步 |
| Passport + JWT | 鉴权 |
| @nestjs/schedule | 定时清理过期日志 |
| class-validator + class-transformer | DTO 参数校验 |
| RolesGuard + Permissions | 细粒度 RBAC 权限控制 |
| SSE | 向前端广播开关变更信号 |

---

## 📁 目录结构

```
C05/
├── backend/                          # NestJS 后端
│   ├── prisma/
│   │   ├── schema.prisma             # 数据模型定义
│   │   └── seed.ts                   # 初始化种子数据
│   └── src/
│       ├── common/                   # 公共：枚举/装饰器/守卫/拦截器/工具
│       └── modules/                  # 业务模块
│           ├── prisma/               # Prisma 模块
│           ├── redis/                # Redis + 缓存 + Pub/Sub
│           ├── auth/                 # 登录鉴权 JWT
│           ├── users/ roles/         # 用户角色管理
│           ├── feature-toggles/      # 开关 CRUD（核心）
│           ├── change-logs/          # 变更记录 + 回滚
│           ├── sdk/                  # SDK 高性能拉取接口
│           ├── sse/                  # SSE 实时推送
│           └── schedule/             # 定时任务
│
└── frontend/                         # React 前端
    └── src/
        ├── types/                    # 核心类型（开关/规则/日志）
        ├── api/                      # axios + 接口定义
        ├── store/                    # Zustand stores
        ├── hooks/                    # usePermission / useSse
        ├── guards/                   # 路由守卫
        ├── utils/                    # 工具函数
        ├── components/               # ConditionBuilder / 弹窗 / 抽屉
        └── pages/                    # Login / ToggleList 主页面
```

---

## 🔌 API 速查

| 方法 | 路径 | 说明 | 鉴权 |
|-----|------|------|------|
| POST | `/api/auth/login` | 登录获取 JWT | ❌ |
| GET | `/api/auth/me` | 获取当前用户信息 | ✅ |
| GET | `/api/feature-toggles` | 开关列表（environment/owner/key 筛选） | ✅ |
| POST | `/api/feature-toggles` | 创建开关 | ✅ + 环境权限 |
| PUT | `/api/feature-toggles/:id` | 更新开关（自动写ChangeLog+刷新Redis） | ✅ + 字段权限 |
| DELETE | `/api/feature-toggles/:id` | 删除开关 | ✅ |
| GET | `/api/change-logs/toggle/:toggleId` | 某开关的变更历史（时间倒序） | ✅ |
| POST | `/api/change-logs/:id/rollback` | 回滚到某版本 | ✅ + 回滚权限 |
| **GET** | **`/api/sdk/config`** | **SDK 接口（简单场景）** | ❌ |
| **POST** | **`/api/sdk/config`** | **SDK 接口（带 tags 复杂场景）** | ❌ |
| GET | `/api/events` | SSE 实时刷新推送 | ✅ |

---

## 🧪 灰度算法执行顺序（重要）

```
对单个开关，按以下顺序依次判断：

1. isGloballyEnabled === false
   → 直接返回 false（全量关了一切免谈）

2. userId 在 whitelist 中
   → 直接返回 true（白名单必过）

3. 配置了 attributeRules 且规则不通过
   → 返回 false（属性规则拦了）

4. hash(userId) % 100 < rolloutPercentage
   → true，否则 false（百分比分流）
```

> 理解这个顺序对正确配置策略至关重要！比如：想让某个用户始终命中某开关，直接加白名单就行，不用管百分比和属性规则。

---

## 📌 设计亮点

1. **Redis 双层缓存**：本地内存 Map + Redis，SDK 接口优先读本地内存，Redis Pub/Sub 广播时才刷新，扛万级 QPS 无压力
2. **Prisma 零调用**：SDK 接口路径上绝对不查数据库，Redis 挂了也只是返回空配置，不崩溃
3. **细粒度 RBAC**：RolesGuard + Permission 配置，四种角色在三个环境上的字段级权限完全独立
4. **回滚也是变更**：回滚操作本身写一条 ROLLBACK 类型的 ChangeLog，审计链完整
5. **ConditionBuilder 递归**：多维属性规则的 UI 和类型定义完全匹配，任意深度嵌套的 AND/OR 组合
6. **SSE 主动刷新**：开关变更后端广播，前端所有打开的页面自动刷新列表，无脏数据
7. **TypeScript Strict**：前后端都是严格模式，开关的复杂配置对象类型安全，重构不怕改漏
