import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/logo';

const heroSignals = [
  { label: '提醒策略', value: '30 / 15 / 7 天分级提醒' },
  { label: '导入方式', value: '手动、CSV、AI 导入' },
  { label: '处理闭环', value: '状态、责任人、日志闭环' },
];

const dashboardStats = [
  { value: '24', label: '本月需要留意的域名' },
  { value: '08', label: '已经进入提醒周期' },
  { value: '03', label: '今天刚完成续费更新' },
];

const reminderQueue = [
  { domain: 'aiziyou.com', meta: '2026-05-03 到期', status: '提醒中', owner: '运营负责人' },
  { domain: 'studio-notes.cn', meta: '2026-05-18 到期', status: '待确认', owner: '创始人' },
  { domain: 'client-landing.io', meta: '2026-06-02 到期', status: '已续费', owner: '项目经理' },
];

const capabilities = [
  {
    badge: 'Domain Desk',
    title: '统一管理域名资产',
    description: '域名、到期日、注册商与备注统一归档。',
  },
  {
    badge: 'Reminder Engine',
    title: '自动执行续费提醒',
    description: '按策略巡检并触发提醒，减少人工跟踪。',
  },
  {
    badge: 'Workflow',
    title: '清晰追踪处理状态',
    description: '状态、责任人、处理时间实时同步。',
  },
  {
    badge: 'Batch Import',
    title: '快速导入历史数据',
    description: '支持 CSV 与 AI 识别，低成本迁移旧数据。',
  },
];

const workflow = [
  {
    step: '01',
    title: '导入资产',
    description: '建立统一域名清单。',
  },
  {
    step: '02',
    title: '生成提醒',
    description: '按到期日自动计算提醒窗口。',
  },
  {
    step: '03',
    title: '更新状态',
    description: '处理结果与责任归属实时留痕。',
  },
  {
    step: '04',
    title: '续费接续',
    description: '续费完成后自动进入下一周期。',
  },
];

const trustCards = [
  {
    label: '适合谁',
    title: '个人与小团队',
    description: '适合多域名的长期管理与协作交接。',
  },
  {
    label: '部署方式',
    title: 'Cloudflare 原生部署',
    description: 'Pages、Workers、D1、KV 组合，轻量稳定。',
  },
  {
    label: '管理透明度',
    title: '全链路可追踪',
    description: '提醒、处理、续费记录统一留痕。',
  },
];

const productHighlights = [
  '首页直出提醒视图',
  '状态模型面向协作',
  '移动端优先布局',
];

export function Home() {
  return (
    <div className="app-shell ink-wash-bg landing-shell landing-shell--executive">
      <a href="#home-main-content" className="skip-link">
        跳到主要内容
      </a>
      <div className="ink-pattern" />
      <div className="landing-orb landing-orb--one" />
      <div className="landing-orb landing-orb--two" />
      <div className="landing-orb landing-orb--three" />

      <header className="app-topbar landing-topbar landing-topbar--minimal">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <BrandLogo title="爱自由域名管理" subtitle="Domain Renewal Reminder Service" />
          <nav className="landing-nav landing-nav--rich" aria-label="Homepage navigation">
            <a href="#capabilities" className="landing-anchor-link">
              核心能力
            </a>
            <a href="#workflow" className="landing-anchor-link">
              工作流
            </a>
            <a href="#trust" className="landing-anchor-link">
              部署与可信度
            </a>
            <a
              href="https://github.com/zhikanyeye/domain-renewal-reminder"
              target="_blank"
              rel="noreferrer"
              className="landing-icon-link"
              aria-label="GitHub repository"
              title="GitHub repository"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.59 2 12.25c0 4.528 2.865 8.37 6.839 9.727.5.096.682-.223.682-.495 0-.244-.009-.89-.014-1.747-2.782.62-3.369-1.39-3.369-1.39-.455-1.192-1.11-1.51-1.11-1.51-.908-.638.069-.625.069-.625 1.004.073 1.532 1.058 1.532 1.058.892 1.566 2.341 1.114 2.91.852.091-.667.349-1.115.635-1.371-2.22-.26-4.555-1.14-4.555-5.074 0-1.121.39-2.038 1.03-2.757-.104-.261-.447-1.312.097-2.735 0 0 .84-.276 2.75 1.053A9.303 9.303 0 0 1 12 6.838c.85.004 1.706.118 2.504.347 1.909-1.329 2.748-1.053 2.748-1.053.545 1.423.202 2.474.099 2.735.64.719 1.028 1.636 1.028 2.757 0 3.944-2.339 4.811-4.566 5.066.359.319.679.948.679 1.912 0 1.381-.012 2.494-.012 2.833 0 .274.18.596.688.494C19.138 20.616 22 16.776 22 12.25 22 6.59 17.523 2 12 2Z" />
              </svg>
            </a>
            <Link to="/login" className="secondary-button landing-login-button">
              登录
            </Link>
            <Link to="/register" className="primary-button landing-entry-button">
              开始管理域名
            </Link>
          </nav>
        </div>
      </header>

      <main id="home-main-content" className="app-main landing-main">
        <section className="landing-hero animate-slideUp" aria-labelledby="hero-title">
          <div className="liquid-panel liquid-panel--hero">
            <div className="liquid-chip">Domain Ops</div>
            <div className="landing-copy">
              <p className="landing-kicker">DOMAIN RENEWAL CONTROL</p>
              <h1 id="hero-title" className="landing-title">域名续费控制台</h1>
              <p className="landing-description">集中管理域名资产、提醒策略与续费状态。</p>
            </div>

            <div className="landing-actions">
              <Link to="/register" className="primary-button">
                立即开始
              </Link>
              <Link to="/login" className="secondary-button">
                查看控制台
              </Link>
            </div>

            <div className="landing-signal-grid" aria-label="Homepage highlights">
              {heroSignals.map((signal) => (
                <article key={signal.label} className="liquid-signal">
                  <div className="liquid-signal__label">{signal.label}</div>
                  <div className="liquid-signal__value">{signal.value}</div>
                </article>
              ))}
            </div>

            <ul className="hero-proof-list" aria-label="Design highlights">
              {productHighlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <aside className="liquid-panel liquid-panel--aside animate-fadeIn" aria-label="Product preview">
            <div className="liquid-preview">
              <div className="liquid-preview__header">
                <div>
                  <div className="liquid-preview__eyebrow">Live board preview</div>
                  <h2>关键提醒，一屏掌握</h2>
                </div>
                <div className="liquid-status-pill">
                  <span className="liquid-status-pill__dot" aria-hidden="true" />
                  自动巡检已开启
                </div>
              </div>

              <div className="liquid-stat-grid" aria-label="Preview metrics">
                {dashboardStats.map((item) => (
                  <div key={item.label} className="liquid-stat-card metric-card">
                    <div className="liquid-stat-card__value">{item.value}</div>
                    <div className="liquid-stat-card__label">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="preview-board">
                <div className="preview-board__header">
                  <strong>近期续费处理队列</strong>
                  <span>今日同步</span>
                </div>
                <ul className="preview-queue">
                  {reminderQueue.map((item) => (
                    <li key={item.domain} className="preview-queue__item">
                      <div className="preview-queue__main">
                        <strong>{item.domain}</strong>
                        <span>{item.meta}</span>
                      </div>
                      <div className="preview-queue__meta">
                        <span className="preview-status-tag">{item.status}</span>
                        <span>{item.owner}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="liquid-stack">
                <div className="liquid-stack-card liquid-stack-card--accent">
                  <div className="liquid-stack-card__label">工作方式</div>
                  <div className="liquid-stack-card__title">记录 / 提醒 / 续费闭环</div>
                  <p>续费完成后自动进入下一周期。</p>
                </div>
                <div className="liquid-stack-card">
                  <div className="liquid-stack-card__label">部署结构</div>
                  <div className="liquid-stack-card__title">Cloudflare Pages + Workers + D1 + KV</div>
                  <p>Cloudflare 原生栈，轻量部署，稳定运行。</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section id="capabilities" className="landing-section animate-slideUp" aria-labelledby="capabilities-title">
          <div className="landing-section__heading">
            <div className="liquid-chip">Capabilities</div>
            <h2 id="capabilities-title">为域名资产建立统一续费系统</h2>
            <p>聚焦管理、提醒、协作与续费接续。</p>
          </div>

          <div className="landing-feature-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="liquid-card">
                <div className="liquid-card__badge">{item.badge}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="landing-section animate-slideUp" aria-labelledby="workflow-title">
          <div className="landing-section__heading">
            <div className="liquid-chip">Workflow</div>
            <h2 id="workflow-title">四步完成域名续费闭环</h2>
            <p>从导入到续费接续，全程自动衔接。</p>
          </div>

          <div className="workflow-grid">
            {workflow.map((item) => (
              <article key={item.step} className="workflow-node">
                <div className="workflow-node__step">{item.step}</div>
                <div className="workflow-node__body">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="trust" className="landing-section animate-slideUp" aria-labelledby="trust-title">
          <div className="landing-section__heading">
            <div className="liquid-chip">Trust Layer</div>
            <h2 id="trust-title">轻量部署，清晰协作，持续可追踪</h2>
            <p>面向长期运行的域名管理场景。</p>
          </div>

          <div className="trust-grid">
            {trustCards.map((item) => (
              <article key={item.title} className="trust-card">
                <div className="trust-card__label">{item.label}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section animate-slideUp" aria-labelledby="cta-title">
          <div className="liquid-panel liquid-panel--cta">
            <div>
              <div className="liquid-chip liquid-chip--soft">Ready to Start</div>
              <h2 id="cta-title" className="landing-cta__title">把域名续费管理交给系统</h2>
              <p className="landing-cta__text">现在开始建立你的域名控制台。</p>
            </div>
            <div className="landing-actions landing-actions--compact">
              <Link to="/register" className="primary-button">
                立即注册
              </Link>
              <Link to="/login" className="secondary-button">
                立即登录
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
