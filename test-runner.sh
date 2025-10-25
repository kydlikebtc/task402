#!/bin/bash

# Task402 完整测试运行脚本
# 包含智能合约测试、后端测试和前端测试

set -e  # 遇到错误立即退出

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              Task402 完整测试套件                                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 打印分隔线
print_separator() {
    echo "────────────────────────────────────────────────────────────────"
}

# 打印测试标题
print_test_title() {
    echo -e "${BLUE}🧪 $1${NC}"
    print_separator
}

# 打印成功消息
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 打印警告消息
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 打印错误消息
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查依赖
check_dependencies() {
    print_test_title "检查测试依赖"

    local missing_deps=()

    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi

    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "缺少依赖: ${missing_deps[*]}"
        echo "请先安装缺少的依赖"
        exit 1
    fi

    print_success "所有依赖已安装"
    echo ""
}

# 1. 智能合约测试
test_contracts() {
    print_test_title "1️⃣  智能合约测试 (Hardhat)"

    cd packages/contracts

    # 检查是否安装了依赖
    if [ ! -d "node_modules" ]; then
        print_warning "未安装依赖,正在安装..."
        npm install
    fi

    # 运行测试
    echo "运行测试..."
    if npm test 2>&1 | tee test-output.log; then
        print_success "智能合约测试通过"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_error "智能合约测试失败"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    cd ../..
    echo ""
}

# 2. 后端 API 测试
test_api() {
    print_test_title "2️⃣  后端 API 测试 (Mocha + Chai)"

    cd apps/api

    # 检查是否安装了依赖
    if [ ! -d "node_modules" ]; then
        print_warning "未安装依赖,正在安装..."
        npm install
    fi

    # 安装测试依赖
    if ! npm list mocha &> /dev/null; then
        print_warning "安装测试依赖..."
        npm install --save-dev mocha chai sinon
    fi

    # 运行测试
    echo "运行测试..."
    if npm test 2>&1 | tee test-output.log; then
        print_success "后端 API 测试通过"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_warning "后端 API 测试失败(可能未配置)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    cd ../..
    echo ""
}

# 3. 代码风格检查
test_lint() {
    print_test_title "3️⃣  代码风格检查 (ESLint)"

    # 跳过 - 需要配置
    print_warning "跳过 ESLint 检查(需要配置)"
    echo ""
}

# 4. 类型检查
test_types() {
    print_test_title "4️⃣  TypeScript 类型检查"

    cd apps/web

    if [ ! -d "node_modules" ]; then
        print_warning "未安装依赖,跳过类型检查"
        cd ../..
        echo ""
        return
    fi

    if npm run type-check 2>&1 | tee type-check-output.log; then
        print_success "类型检查通过"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_warning "类型检查失败"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    cd ../..
    echo ""
}

# 5. 构建测试
test_build() {
    print_test_title "5️⃣  构建测试"

    # 智能合约编译
    echo "编译智能合约..."
    cd packages/contracts
    if [ ! -d "node_modules" ]; then
        print_warning "未安装依赖,跳过编译"
    else
        if npx hardhat compile; then
            print_success "智能合约编译成功"
        else
            print_error "智能合约编译失败"
        fi
    fi
    cd ../..

    echo ""
}

# 6. 生成测试报告
generate_report() {
    print_test_title "📊 测试报告"

    echo "测试完成时间: $(date)"
    echo ""
    echo "测试统计:"
    echo "  总测试数: $TOTAL_TESTS"
    echo "  通过: $PASSED_TESTS"
    echo "  失败: $FAILED_TESTS"
    echo ""

    # 计算通过率
    if [ $TOTAL_TESTS -gt 0 ]; then
        PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
        echo "  通过率: ${PASS_RATE}%"
    fi

    echo ""
    print_separator

    if [ $FAILED_TESTS -eq 0 ]; then
        print_success "所有测试通过! 🎉"
        echo ""
        echo "下一步:"
        echo "  1. 部署智能合约到测试网"
        echo "  2. 启动后端 API 服务"
        echo "  3. 启动前端应用"
        echo "  4. 执行完整的端到端测试"
        return 0
    else
        print_error "有 $FAILED_TESTS 个测试失败"
        echo ""
        echo "请检查:"
        echo "  • packages/contracts/test-output.log"
        echo "  • apps/api/test-output.log"
        echo "  • apps/web/type-check-output.log"
        return 1
    fi
}

# 主函数
main() {
    # 检查是否在项目根目录
    if [ ! -f "package.json" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi

    # 运行所有测试
    check_dependencies

    # 可选参数: 只运行特定测试
    case "${1:-all}" in
        contracts)
            test_contracts
            ;;
        api)
            test_api
            ;;
        types)
            test_types
            ;;
        build)
            test_build
            ;;
        all)
            test_contracts
            test_api
            test_types
            test_build
            ;;
        *)
            echo "用法: $0 {contracts|api|types|build|all}"
            exit 1
            ;;
    esac

    # 生成报告
    generate_report
}

# 运行主函数
main "$@"
