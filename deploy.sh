#!/bin/bash
set -e

echo "🚀 Cognitive Space 一键部署"
echo ""

# 1. Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  .env 不存在，正在从 .env.example 创建..."
    cp .env.example .env
    echo "✅ 已创建 .env"
    echo ""
    echo "📝 请务必编辑 .env 文件，至少配置以下项："
    echo "   - OPENAI_API_KEY 或 DEEPSEEK_API_KEY"
    echo "   - JWT_SECRET_KEY（生产环境必须修改）"
    echo ""
    echo "部署已暂停。请编辑 .env 后重新运行："
    echo "   ./deploy.sh"
    exit 1
fi

# 2. Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装: https://docs.docker.com/compose/install/"
    exit 1
fi

# 3. Build & run
echo "🔨 开始构建镜像并启动服务..."
echo ""

if docker compose version &> /dev/null; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址："
echo "   前端: http://$(hostname -I | awk '{print $1}' | head -1)"
echo "   后端: http://$(hostname -I | awk '{print $1}' | head -1):8000"
echo ""
echo "📊 查看日志："
echo "   docker compose logs -f backend"
echo "   docker compose logs -f frontend"
echo ""
echo "🛑 停止服务："
echo "   docker compose down"
echo ""
