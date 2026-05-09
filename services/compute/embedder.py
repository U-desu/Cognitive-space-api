"""Embedding module for Compute Service.

Supports three backends:
- local: sentence-transformers (requires `pip install sentence-transformers`)
- openai: OpenAI embedding API (requires OPENAI_API_KEY)
- keyword: domain-keyword based semantic vectors (default, no dependencies)

The keyword backend uses domain keyword matching + jieba segmentation to
produce vectors with actual semantic distinguishability.
"""

import math
from typing import Optional

from services.shared import config

# ── Lazy-loaded singletons ──
_local_model = None
_openai_client = None

# ── Domain keyword dictionary for keyword semantic vectors ──
# Each domain has keywords that distinguish it from others.
# This creates real semantic separation between agents of different domains.
# ── Domain keyword dictionary for keyword semantic vectors ──
# Each domain has keywords that distinguish it from others.
# Plus a set of UNIVERSAL keywords that create cross-domain overlap
# to avoid complete orthogonality between different domains.

_UNIVERSAL_KEYWORDS = ["AI", "人工智能", "技术", "发展", "未来", "问题", "观点"]

_DOMAIN_KEYWORDS = {
    "startup": ["创业", "融资", "PMF", "MVP", "窗口期", "赛道", "风口", "allin", "副业", "创始人"],
    "enterprise": ["大厂", "体系", "稳健", "晋升", "P8", "年薪", "股票", "组织", "积累", "管理者"],
    "investment": ["投资", "VC", "估值", "回报", "LP", "IRR", "portfolio", "尽调", "股东"],
    "indie": ["独立", "自由", "远程", "副业", "个人品牌", "数字游民", "solo", "创作者"],
    "tech": ["技术", "开源", "框架", "社区", "布道", "民主化", "基础设施", "开发者"],
    "finance": ["金融", "风控", "估值", "泡沫", "量化", "财报", "ROI", "杠杆", "银行"],
    "research": ["研究", "咨询", "报告", "hype", "reality", "趋势", "洞察", "调研"],
    "product": ["产品", "用户", "需求", "体验", "迭代", "增长", "留存", "PM"],
    "engineering": ["工程", "架构", "代码", "系统", "设计模式", "技术债", "重构", "工程师"],
    "data": ["数据", "算法", "模型", "特征", "AUC", "过拟合", "清洗", "科学家"],
    "media": ["内容", "写作", "传播", "叙事", "adoption", "影响力", "品牌", "创作者"],
    "opensource": ["开源", "社区", "贡献", "协议", "GitHub", "生态", "fork", "维护者"],
    "academia": ["学术", "论文", "理论", "实验室", "顶会", "审稿", "引用", "教授"],
    "consulting": ["咨询", "战略", "变革", "组织", "MBB", "交付", "方案", "顾问"],
    "policy": ["政策", "监管", "合规", "牌照", "立法", "国家级", "标准", "政府"],
    "crypto": ["区块链", "去中心化", "Web3", "代币", "共识", "智能合约", "DeFi", "矿工"],
    "security": ["安全", "攻击", "漏洞", "渗透", "防御", "零信任", "加密", "黑客"],
    "cloud": ["云", "AWS", "容器", "K8s", "Serverless", "弹性", "SRE", "运维"],
    "devops": ["DevOps", "CI/CD", "自动化", "监控", "灰度", "回滚", "SLA", "发布"],
    "design": ["设计", "交互", "UI", "UX", "视觉", "用户体验", "原型", "设计师"],
    "growth": ["增长", "裂变", "A/B", "转化", "获客", "LTV", "CAC", "留存", "黑客"],
    "legal": ["法律", "合规", "知识产权", "合同", "诉讼", "版权", "隐私", "律师"],
    "hr": ["人才", "招聘", "绩效", "组织发展", "文化", "激励", "离职率", "HR"],
    "marketing": ["营销", "品牌", "投放", "种草", "私域", "公域", "转化", "市场部"],
    "operations": ["运营", "流程", "效率", "SOP", "成本", "供应链", "库存", "优化"],
    "supply": ["供应链", "物流", "采购", "仓储", "供应商", "交付", "JIT", "运输"],
    "edtech": ["教育", "学习", "课程", "知识付费", "认知", "终身学习", "学生"],
    "healthtech": ["医疗", "健康", "诊断", "处方", "临床", "FDA", "监管", "医生"],
    "fintech": ["支付", "信贷", "保险", "风控", "反欺诈", "清结算", "监管科技", "银行"],
    "env": ["环境", "碳中和", "ESG", "可持续", "气候", "能源", "绿色", "环保"],
    "sociology": ["社会", "阶层", "不平等", "劳动", "数字鸿沟", "群体", "结构"],
    "psychology": ["心理", "认知", "偏见", "行为", "动机", "决策", "情绪", "用户"],
    "philosophy": ["哲学", "伦理", "智能", "意识", "存在", "价值", "意义", "思辨"],
    "economics": ["经济", "市场", "供需", "价格", "边际", "博弈", "均衡", "货币"],
    "history": ["历史", "周期", "革命", "变革", "教训", "重演", "长周期", "回顾"],
    "futurology": ["未来", "趋势", "预测", "2030", "奇点", "颠覆", "远景", "展望"],
    "scifi": ["科幻", "想象", "星际", "人工智能", "赛博", "乌托邦", "dystopia", "未来"],
    "journalism": ["新闻", "报道", "真相", "媒体", "第四权力", "调查", "客观", "记者"],
    "gov": ["政府", "政策", "治理", "公共", "服务", "数字化", "政务", "官员"],
}

_DOMAINS = list(_DOMAIN_KEYWORDS.keys())
_N_DOMAINS = len(_DOMAINS)


def keyword_embed(text: str) -> list[float]:
    """Rule-based embedding using domain keyword matching.
    
    Produces vectors with real semantic distinguishability:
    - Agents from similar domains will have high similarity
    - Agents from different domains will have low similarity
    
    The vector has length = number of domains. Each dimension represents
    the strength of association with that domain's keyword set.
    
    Universal keywords create cross-domain overlap so vectors are not
    completely orthogonal.
    """
    try:
        import jieba
        tokens = list(jieba.cut(text))
    except ImportError:
        # Fallback: character-level matching
        tokens = list(text)

    vec = [0.0] * _N_DOMAINS
    token_set = set(tokens)

    # Count universal keyword matches (creates baseline overlap)
    universal_matches = sum(1 for kw in _UNIVERSAL_KEYWORDS if kw in token_set)

    for i, domain in enumerate(_DOMAINS):
        keywords = _DOMAIN_KEYWORDS[domain]
        matches = sum(1 for kw in keywords if kw in token_set)
        # Add small universal overlap to avoid complete orthogonality
        total_matches = matches + universal_matches * 0.05
        # Use non-linear scoring: emphasize strong domain signals
        vec[i] = math.sqrt(total_matches) if total_matches > 0 else 0.0

    # Normalize to unit vector
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    else:
        # If no domain matches, use a hash-based fallback for determinism
        h = hash(text) % _N_DOMAINS
        vec = [0.0] * _N_DOMAINS
        vec[h] = 1.0

    return vec


def _get_local_model():
    """Lazy-load sentence-transformers model."""
    global _local_model
    if _local_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = config.COMPUTE_LOCAL_MODEL
            _local_model = SentenceTransformer(model_name)
        except ImportError:
            raise RuntimeError(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )
    return _local_model


def _get_openai_client():
    """Lazy-load OpenAI client."""
    global _openai_client
    if _openai_client is None:
        try:
            import openai
            _openai_client = openai.OpenAI(
                api_key=config.OPENAI_API_KEY,
                base_url=config.OPENAI_BASE_URL,
            )
        except ImportError:
            raise RuntimeError("openai package not installed.")
    return _openai_client


def embed(text: str) -> list[float]:
    """Compute embedding vector for the given text.
    
    Backend is selected via COMPUTE_EMBED_BACKEND env var:
    - "local":   sentence-transformers (best quality, no API needed)
    - "openai":  OpenAI API (high quality, requires API key)
    - "keyword": domain-keyword vectors (default, fast, has semantic meaning)
    """
    backend = config.COMPUTE_EMBED_BACKEND.lower()

    if backend == "local":
        model = _get_local_model()
        vec = model.encode(text, convert_to_numpy=True)
        return vec.tolist()

    elif backend == "openai":
        client = _get_openai_client()
        model = config.COMPUTE_OPENAI_MODEL
        resp = client.embeddings.create(model=model, input=text)
        return resp.data[0].embedding

    else:  # "keyword" or any unrecognized value
        return keyword_embed(text)


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Batch embedding for efficiency."""
    backend = config.COMPUTE_EMBED_BACKEND.lower()

    if backend == "local":
        model = _get_local_model()
        vecs = model.encode(texts, convert_to_numpy=True)
        return [v.tolist() for v in vecs]

    elif backend == "openai":
        client = _get_openai_client()
        model = config.COMPUTE_OPENAI_MODEL
        resp = client.embeddings.create(model=model, input=texts)
        return [d.embedding for d in resp.data]

    else:
        return [keyword_embed(t) for t in texts]
