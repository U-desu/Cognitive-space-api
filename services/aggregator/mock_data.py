"""Aggregator Service: External data mock.

All data previously stored in frontend has been migrated here.

Future data sources:
- Zhihu API (real-time fetch with cache)
- Elasticsearch for question/user search
- MongoDB for document storage
"""

# ── Domain labels ──
DOMAIN_LABELS = {
    "startup": "创业", "enterprise": "企业", "investment": "投资", "indie": "独立开发",
    "tech": "技术", "finance": "金融", "research": "研究", "product": "产品",
    "engineering": "工程", "data": "数据科学", "media": "媒体", "opensource": "开源",
    "academia": "学术", "consulting": "咨询", "policy": "政策", "crypto": "区块链",
    "security": "安全", "cloud": "云架构", "devops": "DevOps", "design": "设计",
    "growth": "增长", "legal": "法务", "hr": "人力资源", "marketing": "市场",
    "operations": "运营", "supply": "供应链", "edtech": "教育科技", "healthtech": "健康科技",
    "fintech": "金融科技", "env": "环境", "sociology": "社会学", "psychology": "心理学",
    "philosophy": "哲学", "economics": "经济学", "history": "历史", "futurology": "未来学",
    "scifi": "科幻", "journalism": "新闻", "gov": "政府",
}


# ── Mock Zhihu Users by domain ──
ZHIHU_USERS = {
    "startup": [
        {"name": "张小龙的产品观", "avatar": "🔥", "title": "连续创业者，前腾讯产品总监", "followers": "23.5万", "url": "https://www.zhihu.com/people/zhangxiaolong"},
        {"name": "李想", "avatar": "🚀", "title": "理想汽车创始人", "followers": "18.2万", "url": "https://www.zhihu.com/people/lixiang"},
        {"name": "粥左罗", "avatar": "💡", "title": "新媒体专家，创业博主", "followers": "31.6万", "url": "https://www.zhihu.com/people/zhouzuoluo"},
    ],
    "enterprise": [
        {"name": "脱不花", "avatar": "🏢", "title": "得到APP联合创始人，前湖畔大学产品负责人", "followers": "42.3万", "url": "https://www.zhihu.com/people/tuobuhua"},
        {"name": "梁宁", "avatar": "📈", "title": "产品战略专家，前联想、腾讯产品高管", "followers": "38.7万", "url": "https://www.zhihu.com/people/liangning"},
        {"name": "俞军", "avatar": "🎯", "title": "前百度产品副总裁，产品方法论奠基人", "followers": "29.1万", "url": "https://www.zhihu.com/people/yujun"},
    ],
    "investment": [
        {"name": "朱啸虎", "avatar": "💰", "title": "金沙江创投合伙人，滴滴、饿了么早期投资人", "followers": "35.6万", "url": "https://www.zhihu.com/people/zhuxiaohu"},
        {"name": "张磊", "avatar": "📊", "title": "高瓴资本创始人，价值投资者", "followers": "28.4万", "url": "https://www.zhihu.com/people/zhanglei"},
        {"name": "沈南鹏", "avatar": "🦈", "title": "红杉中国创始人，投资界教父", "followers": "31.2万", "url": "https://www.zhihu.com/people/shennanpeng"},
    ],
    "data": [
        {"name": "陈丹琦", "avatar": "📉", "title": "斯坦福博士，NLP领域青年科学家", "followers": "15.8万", "url": "https://www.zhihu.com/people/chendanqi"},
        {"name": "李沐", "avatar": "🤖", "title": "AWS资深科学家，MXNet作者", "followers": "22.3万", "url": "https://www.zhihu.com/people/limu"},
        {"name": "王喆", "avatar": "🔢", "title": "推荐系统专家，《深度学习推荐系统》作者", "followers": "18.7万", "url": "https://www.zhihu.com/people/wangzhe"},
    ],
    "tech": [
        {"name": "阮一峰", "avatar": "💻", "title": "技术博主，科技爱好者周刊主编", "followers": "68.5万", "url": "https://www.zhihu.com/people/ruanyifeng"},
        {"name": "尤雨溪", "avatar": "⚡", "title": "Vue.js 作者，前端框架设计大师", "followers": "45.2万", "url": "https://www.zhihu.com/people/youyuxi"},
        {"name": "轮子哥", "avatar": "🌀", "title": "微软资深工程师，知乎技术大V", "followers": "52.1万", "url": "https://www.zhihu.com/people/lunzi"},
    ],
    "product": [
        {"name": "苏杰", "avatar": "📱", "title": "《人人都是产品经理》作者", "followers": "26.4万", "url": "https://www.zhihu.com/people/sujie"},
        {"name": "刘飞", "avatar": "✨", "title": "前滴滴产品总监，产品思维布道者", "followers": "19.8万", "url": "https://www.zhihu.com/people/liufei"},
        {"name": "唐韧", "avatar": "🎨", "title": "产品总监，产品设计方法论专家", "followers": "14.5万", "url": "https://www.zhihu.com/people/tangren"},
    ],
    "engineering": [
        {"name": "陈皓", "avatar": "⚙️", "title": "资深技术专家，左耳朵耗子", "followers": "55.3万", "url": "https://www.zhihu.com/people/chenhao"},
        {"name": "冯大辉", "avatar": "🔧", "title": "前丁香园CTO，技术创业观察者", "followers": "33.7万", "url": "https://www.zhihu.com/people/fengdahui"},
        {"name": "阿里多隆", "avatar": "🏗️", "title": "阿里创始工程师，淘宝早期架构师", "followers": "21.6万", "url": "https://www.zhihu.com/people/duolong"},
    ],
    "finance": [
        {"name": "肖飒", "avatar": "⚖️", "title": "法学博士，金融科技法律专家", "followers": "12.3万", "url": "https://www.zhihu.com/people/xiaosa"},
        {"name": "香帅", "avatar": "💎", "title": "北大金融系教授，财富报告作者", "followers": "27.9万", "url": "https://www.zhihu.com/people/xiangshuai"},
        {"name": "管清友", "avatar": "📉", "title": "经济学家，如是金融研究院院长", "followers": "24.1万", "url": "https://www.zhihu.com/people/guanqingyou"},
    ],
    "academia": [
        {"name": "李飞飞", "avatar": "🧬", "title": "斯坦福教授，AI领军人物", "followers": "32.4万", "url": "https://www.zhihu.com/people/lifeifei"},
        {"name": "吴恩达", "avatar": "🎓", "title": "DeepLearning.AI创始人，斯坦福教授", "followers": "41.8万", "url": "https://www.zhihu.com/people/wuenda"},
        {"name": "周志华", "avatar": "🔬", "title": "南京大学计算机系主任，西瓜书作者", "followers": "19.5万", "url": "https://www.zhihu.com/people/zhoushihua"},
    ],
    "design": [
        {"name": "马力", "avatar": "🖌️", "title": "知群CEO，产品设计教育专家", "followers": "16.7万", "url": "https://www.zhihu.com/people/mali"},
        {"name": "东海", "avatar": "🎭", "title": "前阿里设计总监，设计系统专家", "followers": "11.2万", "url": "https://www.zhihu.com/people/donghai"},
        {"name": "Rigo", "avatar": "🌈", "title": "前百度设计总监，用户体验专家", "followers": "9.8万", "url": "https://www.zhihu.com/people/rigo"},
    ],
}


# ── Mock Zhihu Questions by query preset ──
ZHIHU_QUESTIONS = {
    "大厂创业": [
        {"title": "大厂程序员该不该辞职创业？", "url": "https://www.zhihu.com/question/mock001", "views": "12.4万"},
        {"title": "AI创业窗口期还有多久？", "url": "https://www.zhihu.com/question/mock002", "views": "8.7万"},
        {"title": "副业验证PMF再全职创业靠谱吗？", "url": "https://www.zhihu.com/question/mock003", "views": "5.2万"},
    ],
    "程序员取代": [
        {"title": "AI会取代程序员吗？", "url": "https://www.zhihu.com/question/mock101", "views": "28.6万"},
        {"title": "程序员应该如何应对AI冲击？", "url": "https://www.zhihu.com/question/mock102", "views": "15.3万"},
        {"title": "AI编程助手会让程序员失业吗？", "url": "https://www.zhihu.com/question/mock103", "views": "9.8万"},
    ],
    "技术管理": [
        {"title": "30岁程序员转管理还是继续技术？", "url": "https://www.zhihu.com/question/mock201", "views": "21.3万"},
        {"title": "技术深耕和管理路线哪个更有前途？", "url": "https://www.zhihu.com/question/mock202", "views": "18.5万"},
        {"title": "35岁程序员如何规划职业发展？", "url": "https://www.zhihu.com/question/mock203", "views": "14.2万"},
    ],
}


# ── Hot question presets (previously in LandingPage.tsx) ──
HOT_QUESTIONS = [
    {"icon_type": "briefcase", "label": "职业", "text": "大厂5年了，该辞职去做AI创业吗？", "color": "#60a5fa"},
    {"icon_type": "code", "label": "技术", "text": "AI发展这么快，程序员会被取代吗？", "color": "#4ade80"},
    {"icon_type": "heart", "label": "成长", "text": "30岁该继续深耕技术还是转管理？", "color": "#fb7185"},
]
