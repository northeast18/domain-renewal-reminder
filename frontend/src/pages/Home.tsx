import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/logo';

const repoUrl = 'https://github.com/zhikanyeye/domain-renewal-reminder';

const keyPoints = [
  '统一整理域名、注册商、到期日和续费入口',
  '根据到期周期自动生成提醒并持续跟进',
  '支持负责人、处理状态和续费结果留痕',
];

const features = [
  {
    title: '资产集中管理',
    description: '把域名、到期时间、续费链接和备注放到一个清晰视图里，减少分散记录。',
  },
  {
    title: '自动提醒机制',
    description: '系统自动计算提醒开始日期和发送节奏，降低人工盯日期的成本。',
  },
  {
    title: 'CSV / AI 导入',
    description: '支持批量导入、文字识别和图片识别，先生成草稿再确认入库，更稳妥。',
  },
  {
    title: '处理状态同步',
    description: '续费中、已处理、已暂停、已放弃都能在系统内持续同步，方便多人协作。',
  },
];

const entryPoints = [
  {
    title: '新用户开始',
    description: '首次使用时创建账号，进入自己的域名续费控制台。',
    actionLabel: '注册账号',
    to: '/register',
    variant: 'primary',
  },
  {
    title: '已有用户登录',
    description: '直接进入控制台，查看提醒任务、处理续费和更新状态。',
    actionLabel: '进入登录',
    to: '/login',
    variant: 'secondary',
  },
  {
    title: '管理员维护',
    description: '配置邮件服务、查看日志、管理用户，并手动触发提醒检查。',
    actionLabel: '管理员入口',
    to: '/admin',
    variant: 'ghost',
  },
] as const;

export function Home() {
  return (
    <div className="app-shell home-landing">
      <a href="#home-main-content" className="skip-link">
        跳到主要内容
      </a>

      <header className="app-topbar home-landing__topbar">
        <div className="home-landing__topbar-inner">
          <BrandLogo title="爱自由域名管理" subtitle="Domain Renewal Reminder Service" />
          <nav className="home-landing__nav" aria-label="Homepage navigation">
            <a href="#product" className="home-landing__nav-link">
              产品介绍
            </a>
            <a href="#features" className="home-landing__nav-link">
              主要功能
            </a>
            <a href={repoUrl} target="_blank" rel="noreferrer" className="home-landing__repo-link">
              项目原地址
            </a>
            <Link to="/login" className="secondary-button home-landing__login-button">
              登录
            </Link>
          </nav>
        </div>
      </header>

      <main id="home-main-content" className="app-main home-landing__main">
        <section className="home-landing__hero animate-slideUp" aria-labelledby="hero-title">
          <div className="home-landing__hero-copy">
            <p className="home-landing__eyebrow">Domain Renewal Reminder</p>
            <h1 id="hero-title" className="home-landing__title">
              简洁地管理域名资产，稳定地推进续费流程
            </h1>
            <p className="home-landing__description">
              面向个人站长和小团队的域名续费管理工具，把产品介绍、核心功能和实际入口收拢在一个清晰首页里。
            </p>

            <div className="home-landing__cta-row">
              <Link to="/register" className="primary-button">
                立即开始
              </Link>
              <Link to="/login" className="secondary-button">
                进入控制台
              </Link>
            </div>

            <div className="home-landing__meta-list" aria-label="Product highlights">
              <span>Cloudflare 部署</span>
              <span>邮件提醒自动执行</span>
              <span>支持批量导入与 AI 识别</span>
            </div>
          </div>

          <aside className="home-landing__hero-panel" aria-label="Product summary">
            <span className="home-landing__panel-label">产品简介</span>
            <h2>把“记住续费”变成一个可跟踪的流程</h2>
            <p>
              这个系统不是单纯的提醒工具，而是把域名资产、提醒节奏、处理动作和续费结果统一放进同一个控制面板。
            </p>
            <ul className="home-landing__point-list">
              {keyPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        </section>

        <section id="product" className="home-landing__section animate-slideUp" aria-labelledby="product-title">
          <div className="home-landing__section-heading">
            <p className="home-landing__section-label">产品介绍</p>
            <h2 id="product-title">首页只保留用户真正关心的内容</h2>
          </div>

          <div className="home-landing__intro-card">
            <div>
              <h3>这是什么</h3>
              <p>一个用于域名续费管理的 Web 应用，帮助用户集中管理域名、自动计算提醒节奏，并通过邮件或后台操作完成后续处理。</p>
            </div>
            <div>
              <h3>适合谁用</h3>
              <p>适合个人项目、工作室和小团队，尤其适合域名较多、容易分散在多个注册商中的场景。</p>
            </div>
            <div>
              <h3>为什么更省心</h3>
              <p>比表格和日历提醒更完整，因为它把导入、提醒、状态流转和续费留痕放在了一条链路里。</p>
            </div>
          </div>
        </section>

        <section id="features" className="home-landing__section animate-slideUp" aria-labelledby="features-title">
          <div className="home-landing__section-heading">
            <p className="home-landing__section-label">主要功能</p>
            <h2 id="features-title">保留关键能力，不把首页做成说明书</h2>
          </div>

          <div className="home-landing__feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="home-landing__feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-landing__section animate-slideUp" aria-labelledby="entry-title">
          <div className="home-landing__section-heading">
            <p className="home-landing__section-label">用户入口</p>
            <h2 id="entry-title">用户使用的 3 个地方，直接放在首页</h2>
          </div>

          <div className="home-landing__entry-grid">
            {entryPoints.map((entry, index) => (
              <article key={entry.title} className="home-landing__entry-card">
                <div className="home-landing__entry-index" aria-hidden="true">
                  {index + 1}
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
                <Link
                  to={entry.to}
                  className={
                    entry.variant === 'primary'
                      ? 'primary-button'
                      : entry.variant === 'secondary'
                        ? 'secondary-button'
                        : 'ghost-button'
                  }
                >
                  {entry.actionLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="home-landing__footer">
          <div>
            <strong>项目原地址</strong>
            <a href={repoUrl} target="_blank" rel="noreferrer">
              {repoUrl}
            </a>
          </div>
          <div>
            <strong>默认操作入口</strong>
            <Link to="/login">登录进入控制台</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
