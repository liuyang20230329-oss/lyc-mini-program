# LYC 小宇宙学堂架构说明

## 产品定位

`LYC` 是一个为小朋友设计的"听、读、学"型微信小程序，通过 AI 智能分段技术将音视频内容按段落切分，让孩子可以逐段学习、跟读和复习。

## 项目结构

```
D:\yicen-tools\
├── server/                    后端服务 (Node.js + Express)
│   ├── server.js              入口
│   ├── config/database.js     SQLite 数据库 + Schema
│   ├── middleware/auth.js     JWT 认证 + 管理员鉴权
│   ├── routes/
│   │   ├── content.js         内容管理 API (分类/课程/段落)
│   │   ├── upload.js          文件上传 (单文件 + 分片)
│   │   ├── media.js           流式播放 (Range 206)
│   │   ├── progress.js        学习进度同步
│   │   ├── favorites.js       收藏管理
│   │   └── ai.js              AI 分析 (ASR + 智能分段)
│   ├── services/
│   │   ├── storage/           存储抽象层
│   │   │   ├── index.js       工厂 (local/oss 切换)
│   │   │   ├── local-storage  本地磁盘 (开发)
│   │   │   └── oss-storage    阿里云 OSS (生产)
│   │   └── ai/                AI 服务
│   │       ├── asr-service    阿里云智能语音 ASR
│   │       └── segmenter      智能分段引擎
│   └── .env.example           配置模板
├── utils/                     小程序工具层
│   ├── content-data.js        内容数据 (本地演示 + 云端拉取)
│   └── media-service.js       统一媒体服务 (CDN/缓存)
├── pages/                     小程序页面
│   ├── tool/                  内容详情 + 段落播放
│   ├── about/                 家长中心
│   └── history/               成长记录
├── components/                小程序组件
│   ├── segment-player/        段落播放器
│   └── video-player/          视频播放器
└── scripts/                   辅助脚本
```

## 快速启动

### 1. 后端服务

```bash
# 进入后端目录
cd D:\yicen-tools\server

# 安装依赖
npm install

# 复制配置文件并编辑
copy .env.example .env
# 编辑 .env 填入实际配置

# 开发模式 (本地存储，无需 OSS)
set STORAGE_MODE=local
npm run dev

# 生产模式 (阿里云 OSS + CDN)
set STORAGE_MODE=oss
npm run dev

# 初始化数据库
npm run init-db

# 导入演示数据
npm run seed
```

### 2. 环境配置 (.env)

```ini
# 存储: local=本地开发 | oss=阿里云生产
STORAGE_MODE=local

# 阿里云 OSS (生产模式必填)
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=lyc-media

# CDN 加速域名 (可选)
CDN_DOMAIN=cdn.lyc.example.com

# AI 服务 (阶段二)
ALIYUN_ASR_APP_KEY=你的ASR_AppKey
ALIYUN_ASR_ACCESS_KEY=你的ASR_AccessKey
ALIYUN_ASR_ACCESS_SECRET=你的ASR_AccessSecret
DASHSCOPE_API_KEY=你的通义千问APIKey
```

### 3. 小程序端

在 `app.js` 的 `onLaunch` 中配置后端地址：

```js
var mediaService = require('./utils/media-service');
var contentData = require('./utils/content-data');

App({
  onLaunch: function () {
    // 开发环境
    mediaService.setConfig({
      env: 'dev',
      apiBaseUrl: 'http://你的开发机IP:3002',
      localAudioBaseUrl: 'http://你的开发机IP:8123'
    });

    // 生产环境
    // mediaService.setConfig({
    //   env: 'prod',
    //   apiBaseUrl: 'https://你的生产域名'
    // });

    contentData.setApiBaseUrl(mediaService.API_BASE_URL);
  }
});
```

## API 接口一览

### 内容管理 (公开)
```
GET  /api/v1/content/categories          获取分类列表
GET  /api/v1/content/courses             获取课程列表 (?categoryId=&page=&pageSize=)
GET  /api/v1/content/courses/:id         获取课程详情 + 段落
```

### 管理接口 (需 X-Admin-Key)
```
POST   /api/v1/content/categories        创建分类
PUT    /api/v1/content/categories/:id    更新分类
DELETE /api/v1/content/categories/:id    删除分类
POST   /api/v1/content/courses           创建课程
PUT    /api/v1/content/courses/:id       更新课程
DELETE /api/v1/content/courses/:id       删除课程
POST   /api/v1/content/courses/:id/segments  添加段落
PUT    /api/v1/content/segments/:id      更新段落
DELETE /api/v1/content/segments/:id      删除段落
```

### 文件上传 (需 X-Admin-Key)
```
POST  /api/v1/upload/single              单文件上传
POST  /api/v1/upload/init                分片上传初始化
POST  /api/v1/upload/chunk               分片上传
POST  /api/v1/upload/complete            合并分片
POST  /api/v1/upload/abort               取消分片上传
```

### 媒体播放 (公开)
```
GET  /api/v1/media/stream/:key           流式播放 (支持 Range)
GET  /api/v1/media/signed-url/:fileId    获取签名 URL
```

### AI 分析 (需 X-Admin-Key)
```
POST  /api/v1/ai/analyze/:courseId       触发 ASR + 分段
GET   /api/v1/ai/status/:courseId        查询分析进度
PUT   /api/v1/ai/segments/:courseId      人工调整段落
```

### 用户接口 (需 Bearer Token)
```
POST /api/v1/progress/sync               同步学习进度
GET  /api/v1/progress/:courseId          获取单课进度
GET  /api/v1/progress/                   获取全部进度
POST /api/v1/favorites/:courseId         添加收藏
DELETE /api/v1/favorites/:courseId       取消收藏
GET  /api/v1/favorites/                  获取收藏列表
```

## 阿里云服务清单

| 服务 | 用途 | 配置项 |
|------|------|--------|
| OSS | 音视频文件存储 | OSS_BUCKET, OSS_REGION |
| CDN | 全国加速分发 | CDN_DOMAIN |
| 智能语音交互 | ASR 语音转文字 | ALIYUN_ASR_APP_KEY |
| 通义千问 | 语义分段优化 | DASHSCOPE_API_KEY |
| MPS 媒体处理 | 转码/裁剪 (阶段四) | MPS_PIPELINE_ID |
