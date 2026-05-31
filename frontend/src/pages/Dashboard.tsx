/**
 * Dashboard Page
 */

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, type AiImportDraft, type AiImportHistoryItem, type DomainPayload } from '../api/client';
import { EmptyStatePanel, type EmptyStateVariant } from '../components/empty-state';
import { BrandLogo } from '../components/logo';
import { useAuth } from '../contexts/useAuth';

type DomainStatus = 'active' | 'paused' | 'handled' | 'abandoned';

interface Domain {
  id: string;
  domain_address: string;
  renewal_url: string;
  registration_date: number;
  usage_period_years: number;
  expiry_date: number;
  reminder_days_offset: number;
  reminder_start_date: number;
  reminder_email: string;
  reminder_count: number;
  reminders_sent: number;
  status: DomainStatus;
  status_note?: string | null;
  owner?: string | null;
  processed_at?: number | null;
  last_renewed_at?: number | null;
}

interface DomainFilters {
  renewalUrl?: string;
  usagePeriodYears?: number;
  reminderCount?: number;
  status?: DomainStatus;
}

interface DomainsResponse {
  domains: Domain[];
  total: number;
  totalPages: number;
}

type DomainFormData = DomainPayload;

type ImportSourceMode = 'csv' | 'text' | 'image';

type BatchImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

interface BannerState {
  tone: 'success' | 'error';
  text: string;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString('zh-CN');
}

function getDaysUntilExpiry(expiryTimestamp: number) {
  const now = Date.now();
  const diff = expiryTimestamp * 1000 - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getStatusMeta(status: DomainStatus) {
  switch (status) {
    case 'handled':
      return {
        label: '已处理',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
      };
    case 'paused':
      return {
        label: '已暂停',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'abandoned':
      return {
        label: '已放弃',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
      };
    default:
      return {
        label: '提醒中',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
  }
}

function StatusBadge({ status }: { status: DomainStatus }) {
  const meta = getStatusMeta(status);

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function RemainingBadge({ daysLeft }: { daysLeft: number }) {
  const className =
    daysLeft <= 7
      ? 'from-red-500 to-red-600 text-white'
      : daysLeft <= 30
        ? 'from-yellow-400 to-orange-500 text-white'
        : 'from-green-400 to-emerald-500 text-white';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1.5 text-xs font-bold shadow-sm ${className}`}>
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {daysLeft} 天
    </span>
  );
}

function InfoItem({ label, value, breakAll }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold text-gray-900 ${breakAll ? 'break-all' : ''}`}>{value}</div>
    </div>
  );
}

interface DomainCardProps {
  domain: Domain;
  onRenew: (domain: Domain) => void;
  onHandle: (domain: Domain) => void;
  onStatusChange: (domain: Domain, status: DomainStatus) => void;
  onEdit: (domain: Domain) => void;
  onDelete: (domain: Domain) => void;
}

function DomainCard({ domain, onRenew, onHandle, onStatusChange, onEdit, onDelete }: DomainCardProps) {
  const daysLeft = getDaysUntilExpiry(domain.expiry_date);
  const progress = Math.min(100, Math.round((domain.reminders_sent / domain.reminder_count) * 100));

  return (
    <div className="glass-card rounded-2xl border border-white/40 p-4 shadow-lg sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-all text-lg font-bold text-gray-900">{domain.domain_address}</h3>
              <StatusBadge status={domain.status} />
            </div>
            <div className="mt-1 break-all text-sm text-gray-500">{domain.renewal_url}</div>
          </div>
          <RemainingBadge daysLeft={daysLeft} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="到期日期" value={formatDate(domain.expiry_date)} />
          <InfoItem label="提醒开始" value={formatDate(domain.reminder_start_date)} />
          <InfoItem label="提醒邮箱" value={domain.reminder_email} breakAll />
          <InfoItem label="提醒进度" value={`${domain.reminders_sent}/${domain.reminder_count}`} />
        </div>

        {(domain.owner || domain.processed_at) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {domain.owner && <InfoItem label="负责人" value={domain.owner} />}
            {domain.processed_at && <InfoItem label="处理时间" value={formatDate(domain.processed_at)} />}
          </div>
        )}

        {domain.status_note && (
          <div className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-600">
            备注：{domain.status_note}
          </div>
        )}

        {domain.last_renewed_at && (
          <div className="text-sm font-medium text-emerald-600">上次续费：{formatDate(domain.last_renewed_at)}</div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>提醒发送进度</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white/45 p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">操作区</div>
              <div className="text-xs text-gray-500">常用操作优先展示，其他管理操作保持收敛。</div>
            </div>
            <div className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              续费工作流
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <button
            type="button"
            onClick={() => onRenew(domain)}
            className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
          >
            续费并重置提醒
          </button>
          <button
            type="button"
            onClick={() => onHandle(domain)}
            className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition-all hover:bg-sky-100"
          >
            标记已处理
          </button>
          {domain.status === 'active' ? (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'paused')}
              className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100"
            >
              暂停提醒
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'active')}
              className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 transition-all hover:bg-teal-100"
            >
              恢复提醒
            </button>
          )}
          {domain.status !== 'abandoned' && (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'abandoned')}
              className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-100"
            >
              标记已放弃
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(domain)}
            className="rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => onDelete(domain)}
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-all hover:bg-red-100"
          >
            删除
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<Domain | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDomains, setTotalDomains] = useState(0);
  const pageSize = 20;

  const [filterRenewalUrl, setFilterRenewalUrl] = useState('');
  const [filterUsagePeriod, setFilterUsagePeriod] = useState<number | ''>('');
  const [filterReminderCount, setFilterReminderCount] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<DomainStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      const filters: DomainFilters = {};
      if (filterRenewalUrl) filters.renewalUrl = filterRenewalUrl;
      if (filterUsagePeriod) filters.usagePeriodYears = filterUsagePeriod;
      if (filterReminderCount) filters.reminderCount = filterReminderCount;
      if (filterStatus) filters.status = filterStatus;

      const response = await apiClient.getDomains(filters, currentPage, pageSize);
      if (response.success && response.data) {
        const data = response.data as DomainsResponse;
        setDomains(data.domains || []);
        setTotalDomains(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setBanner({
          tone: 'error',
          text: response.error?.message || '加载域名失败。',
        });
      }
    } catch {
      setBanner({
        tone: 'error',
        text: '网络错误，暂时无法加载域名。',
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterReminderCount, filterRenewalUrl, filterStatus, filterUsagePeriod]);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const clearFilters = () => {
    setFilterRenewalUrl('');
    setFilterUsagePeriod('');
    setFilterReminderCount('');
    setFilterStatus('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleRenewDomain = useCallback(async (domain: Domain) => {
    if (!window.confirm(`确认已完成 ${domain.domain_address} 的续费？系统会自动顺延一个使用周期，并重置提醒进度。`)) {
      return;
    }

    try {
      const response = await apiClient.renewDomain(domain.id);
      if (response.success) {
        await loadDomains();
        setBanner({
          tone: 'success',
          text: `${domain.domain_address} 已完成续费，提醒周期已重置。`,
        });
      } else {
        setBanner({
          tone: 'error',
          text: response.error?.message || '续费失败。',
        });
      }
    } catch {
      setBanner({
        tone: 'error',
        text: '网络错误，续费操作未完成。',
      });
    }
  }, [loadDomains]);

  const handleMarkHandled = useCallback(async (domain: Domain) => {
    try {
      const response = await apiClient.updateDomain(domain.id, {
        status: 'handled',
      });

      if (response.success) {
        await loadDomains();
        setBanner({
          tone: 'success',
          text: `${domain.domain_address} 已标记为已处理。`,
        });
      } else {
        setBanner({
          tone: 'error',
          text: response.error?.message || '标记已处理失败。',
        });
      }
    } catch {
      setBanner({
        tone: 'error',
        text: '网络错误，未能标记已处理。',
      });
    }
  }, [loadDomains]);

  const handleChangeStatus = useCallback(async (domain: Domain, status: DomainStatus) => {
    const actionLabels: Record<DomainStatus, string> = {
      active: '恢复提醒',
      paused: '暂停提醒',
      handled: '标记已处理',
      abandoned: '标记已放弃',
    };

    if (!window.confirm(`确认要将 ${domain.domain_address} 设置为“${actionLabels[status]}”吗？`)) {
      return;
    }

    try {
      const response = await apiClient.updateDomain(domain.id, { status });

      if (response.success) {
        await loadDomains();
        setBanner({
          tone: 'success',
          text: `${domain.domain_address} 状态已更新为“${actionLabels[status]}”。`,
        });
      } else {
        setBanner({
          tone: 'error',
          text: response.error?.message || '状态更新失败。',
        });
      }
    } catch {
      setBanner({
        tone: 'error',
        text: '网络错误，状态更新未完成。',
      });
    }
  }, [loadDomains]);

  const filteredDomains = domains.filter((domain) => {
    if (!searchQuery) {
      return true;
    }

    const query = searchQuery.toLowerCase();
    return (
      domain.domain_address.toLowerCase().includes(query) ||
      domain.renewal_url.toLowerCase().includes(query) ||
      domain.reminder_email.toLowerCase().includes(query)
    );
  });

  const groupedDomains = filteredDomains.reduce<Record<string, Domain[]>>((groups, domain) => {
    if (!groups[domain.renewal_url]) {
      groups[domain.renewal_url] = [];
    }
    groups[domain.renewal_url].push(domain);
    return groups;
  }, {});

  const uniqueRenewalUrls = Array.from(new Set(domains.map((domain) => domain.renewal_url)));
  const uniqueUsagePeriods = Array.from(new Set(domains.map((domain) => domain.usage_period_years))).sort((a, b) => a - b);
  const uniqueReminderCounts = Array.from(new Set(domains.map((domain) => domain.reminder_count))).sort((a, b) => a - b);

  const activeCount = domains.filter((domain) => domain.status === 'active').length;
  const handledCount = domains.filter((domain) => domain.status === 'handled').length;
  const pausedCount = domains.filter((domain) => domain.status === 'paused').length;
  const abandonedCount = domains.filter((domain) => domain.status === 'abandoned').length;

  return (
    <div className="app-shell ink-wash-bg">
      <div className="ink-pattern" />

      <header className="app-topbar">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <BrandLogo compact subtitle={user?.email ? `欢迎，${user.email}` : 'Domain Management Console'} />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100/80 hover:text-gray-900 sm:w-auto"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="域名总数" value={String(totalDomains)} />
          <StatCard label="提醒中" value={String(activeCount)} accent="emerald" />
          <StatCard label="已处理" value={String(handledCount)} accent="indigo" />
          <StatCard label="已暂停" value={String(pausedCount)} accent="amber" />
          <StatCard label="已放弃" value={String(abandonedCount)} accent="rose" />
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-gray-900">我的域名</h2>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 sm:flex-none"
            >
              添加域名
            </button>
            <button
              type="button"
              onClick={() => setShowBatchImportModal(true)}
              className="flex-1 rounded-xl border-2 border-indigo-600 px-5 py-3 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50 sm:flex-none"
            >
              批量导入
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
              banner.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {banner.text}
          </div>
        )}

        <div className="glass-card mb-6 rounded-2xl p-5 shadow-lg">
          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">搜索域名</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索域名、续费地址或提醒邮箱"
              className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold text-gray-900">筛选与视图</div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${viewMode === 'grouped' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                分组
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="续费网址"
              value={filterRenewalUrl}
              onChange={setFilterRenewalUrl}
              options={[{ label: '全部', value: '' }, ...uniqueRenewalUrls.map((url) => ({ label: url, value: url }))]}
            />
            <FilterSelect
              label="使用周期"
              value={String(filterUsagePeriod)}
              onChange={(value) => setFilterUsagePeriod(value ? parseInt(value, 10) : '')}
              options={[{ label: '全部', value: '' }, ...uniqueUsagePeriods.map((value) => ({ label: `${value} 年`, value: String(value) }))]}
            />
            <FilterSelect
              label="提醒次数"
              value={String(filterReminderCount)}
              onChange={(value) => setFilterReminderCount(value ? parseInt(value, 10) : '')}
              options={[{ label: '全部', value: '' }, ...uniqueReminderCounts.map((value) => ({ label: `${value} 次`, value: String(value) }))]}
            />
            <FilterSelect
              label="域名状态"
              value={filterStatus}
              onChange={(value) => setFilterStatus((value || '') as DomainStatus | '')}
              options={[
                { label: '全部', value: '' },
                { label: '提醒中', value: 'active' },
                { label: '已处理', value: 'handled' },
                { label: '已暂停', value: 'paused' },
                { label: '已放弃', value: 'abandoned' },
              ]}
            />
          </div>

          {(searchQuery || filterRenewalUrl || filterUsagePeriod || filterReminderCount || filterStatus) && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/80 p-3 text-sm text-indigo-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                已应用 {[searchQuery, filterRenewalUrl, filterUsagePeriod, filterReminderCount, filterStatus].filter(Boolean).length} 个筛选条件
              </div>
              <button type="button" onClick={clearFilters} className="font-semibold hover:underline">
                清除全部
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="mt-4 text-sm font-medium text-gray-600">加载中...</p>
          </div>
        ) : domains.length === 0 ? (
          <EmptyState
            title="还没有域名"
            description="先添加第一个域名，系统才能开始帮你追踪续费和提醒。"
            variant="domains"
            actionLabel="添加域名"
            onAction={() => setShowAddModal(true)}
          />
        ) : filteredDomains.length === 0 ? (
          <EmptyState title="没有匹配结果" description="换一个关键词，或者清除筛选条件后再试。" variant="search" actionLabel="清除筛选" onAction={clearFilters} />
        ) : viewMode === 'list' ? (
          <div className="space-y-4 sm:space-y-5">
            {filteredDomains.map((domain) => (
              <DomainCard
                key={domain.id}
                domain={domain}
                onRenew={handleRenewDomain}
                onHandle={handleMarkHandled}
                onStatusChange={handleChangeStatus}
                onEdit={setEditingDomain}
                onDelete={setDeletingDomain}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedDomains).map(([renewalUrl, group]) => (
              <div key={renewalUrl} className="glass-card overflow-hidden rounded-2xl shadow-lg">
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 px-4 py-4 text-white sm:px-5">
                  <div className="break-all text-base font-bold">{renewalUrl}</div>
                  <div className="mt-1 text-sm text-indigo-100">{group.length} 个域名</div>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                  {group.map((domain) => (
                    <DomainCard
                      key={domain.id}
                      domain={domain}
                      onRenew={handleRenewDomain}
                      onHandle={handleMarkHandled}
                      onStatusChange={handleChangeStatus}
                      onEdit={setEditingDomain}
                      onDelete={setDeletingDomain}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredDomains.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalDomains)} 条，共 {totalDomains} 条
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <span className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </main>

      {showAddModal && <AddDomainModal onClose={() => setShowAddModal(false)} onSuccess={loadDomains} />}
      {showBatchImportModal && (
        <BatchImportModal
          onClose={() => setShowBatchImportModal(false)}
          onSuccess={loadDomains}
          defaultReminderEmail={user?.email || ''}
        />
      )}
      {editingDomain && <EditDomainModal domain={editingDomain} onClose={() => setEditingDomain(null)} onSuccess={loadDomains} />}
      {deletingDomain && <DeleteConfirmDialog domain={deletingDomain} onClose={() => setDeletingDomain(null)} onSuccess={loadDomains} />}
    </div>
  );
}

function StatCard({ label, value, accent = 'indigo' }: { label: string; value: string; accent?: 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const accentMap = {
    indigo: 'from-indigo-500 to-purple-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-500',
    rose: 'from-rose-500 to-red-600',
  };

  return (
    <div className="glass-card rounded-2xl p-4 shadow-lg sm:p-5">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white sm:h-12 sm:w-12 ${accentMap[accent]}`}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-sm font-semibold text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{value}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || 'all'}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({
  title,
  description,
  variant = 'domains',
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  variant?: EmptyStateVariant;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <EmptyStatePanel
      title={title}
      description={description}
      variant={variant}
      actionLabel={actionLabel}
      onAction={onAction}
      className="glass-card"
    />
  );
}

interface AddDomainModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddDomainModal({ onClose, onSuccess }: AddDomainModalProps) {
  const [formData, setFormData] = useState<DomainFormData>({
    domainAddress: '',
    renewalUrl: '',
    registrationDate: '',
    usagePeriodYears: 1,
    reminderDaysOffset: 30,
    reminderEmail: '',
    reminderCount: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.addDomain(formData);
      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error?.message || '添加域名失败。');
      }
    } catch {
      setError('网络错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="添加域名" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError error={error} />
        <TextField label="域名地址" value={formData.domainAddress} onChange={(value) => setFormData({ ...formData, domainAddress: value })} placeholder="example.com" />
        <TextField label="续费网址" type="url" value={formData.renewalUrl} onChange={(value) => setFormData({ ...formData, renewalUrl: value })} placeholder="https://example.com/renew" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="注册日期" type="date" value={formData.registrationDate} onChange={(value) => setFormData({ ...formData, registrationDate: value })} />
          <NumberField label="使用周期（年）" value={formData.usagePeriodYears} onChange={(value) => setFormData({ ...formData, usagePeriodYears: value })} min={1} max={10} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="提前提醒天数" value={formData.reminderDaysOffset} onChange={(value) => setFormData({ ...formData, reminderDaysOffset: value })} min={1} max={365} />
          <NumberField label="提醒次数" value={formData.reminderCount} onChange={(value) => setFormData({ ...formData, reminderCount: value })} min={1} max={30} />
        </div>
        <TextField label="提醒邮箱" type="email" value={formData.reminderEmail} onChange={(value) => setFormData({ ...formData, reminderEmail: value })} placeholder="you@example.com" />
        <ModalActions onClose={onClose} loading={loading} submitLabel="保存并创建" />
      </form>
    </ModalShell>
  );
}

interface BatchImportModalProps {
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  defaultReminderEmail: string;
}

function BatchImportModal({ onClose, onSuccess, defaultReminderEmail }: BatchImportModalProps) {
  const [mode, setMode] = useState<ImportSourceMode>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [defaults, setDefaults] = useState<DomainFormData>({
    domainAddress: '',
    renewalUrl: '',
    registrationDate: '',
    usagePeriodYears: 1,
    reminderDaysOffset: 30,
    reminderEmail: defaultReminderEmail,
    reminderCount: 3,
  });
  const [drafts, setDrafts] = useState<AiImportDraft[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedModel, setParsedModel] = useState('');
  const [historyItems, setHistoryItems] = useState<AiImportHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BatchImportResult | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await apiClient.getAiImportHistory(8);
      if (response.success && response.data) {
        setHistoryItems(response.data.history || []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const downloadTemplate = () => {
    const template = `domainAddress,renewalUrl,registrationDate,usagePeriodYears,reminderDaysOffset,reminderEmail,reminderCount
example.com,https://example.com/renew,2024-01-01,1,30,you@example.com,3
mydomain.net,https://registrar.com/renew,2023-06-15,2,60,admin@mydomain.net,5`;

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'domain-import-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCsv = (text: string): DomainFormData[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV 文件至少需要标题行和一行数据。');
    }

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map((value) => value.trim());
      if (values.length < 7) {
        throw new Error(`第 ${index + 2} 行数据不完整。`);
      }

      return {
        domainAddress: values[0],
        renewalUrl: values[1],
        registrationDate: values[2],
        usagePeriodYears: parseInt(values[3], 10),
        reminderDaysOffset: parseInt(values[4], 10),
        reminderEmail: values[5],
        reminderCount: parseInt(values[6], 10),
      };
    });
  };

  const clearFeedback = () => {
    setError('');
    setResult(null);
  };

  const switchMode = (nextMode: ImportSourceMode) => {
    setMode(nextMode);
    setDrafts([]);
    setParseWarnings([]);
    setParsedModel('');
    setCurrentHistoryId(null);
    clearFeedback();
  };

  const updateDraft = (index: number, field: keyof DomainPayload, value: string | number) => {
    setDrafts((current) =>
      current.map((draft, currentIndex) =>
        currentIndex === index
          ? {
              ...draft,
              [field]: value,
            }
          : draft
      )
    );
  };

  const applyBatchImport = async (records: DomainPayload[]) => {
    setLoading(true);
    clearFeedback();

    try {
      const response = await apiClient.batchAddDomains(records);

      if (response.success && response.data) {
        const data = response.data as {
          successCount: number;
          failedCount: number;
          errors: Array<{ index: number; domain: string; error: string }>;
        };

        setResult({
          success: data.successCount,
          failed: data.failedCount,
          errors: data.errors.map((item) => `${item.domain}: ${item.error}`),
        });

        if (data.successCount > 0) {
          if (currentHistoryId) {
            await apiClient.markAiImportHistoryImported(currentHistoryId);
          }
          await onSuccess();
          await loadHistory();
        }
      } else {
        setError(response.error?.message || '批量导入失败。');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败。');
    } finally {
      setLoading(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('读取图片失败。'));
      reader.readAsDataURL(file);
    });

  const handleCsvImport = async () => {
    if (!csvFile) {
      setError('请先选择 CSV 文件。');
      return;
    }

    const text = await csvFile.text();
    const domains = parseCsv(text);
    await applyBatchImport(domains);
  };

  const handleAiParse = async () => {
    clearFeedback();
    setParseWarnings([]);
    setParsedModel('');
    setDrafts([]);
    setCurrentHistoryId(null);

    const payloadDefaults = {
      renewalUrl: defaults.renewalUrl.trim() || undefined,
      usagePeriodYears: defaults.usagePeriodYears,
      reminderDaysOffset: defaults.reminderDaysOffset,
      reminderEmail: defaults.reminderEmail.trim() || undefined,
      reminderCount: defaults.reminderCount,
    };

    if (mode === 'text') {
      if (!textInput.trim()) {
        setError('请先粘贴域名相关文字。');
        return;
      }
    } else if (!imageFile) {
      setError('请先选择一张图片。');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.parseDomainsWithAi({
        sourceType: mode === 'text' ? 'text' : 'image',
        text: mode === 'text' ? textInput : undefined,
        imageDataUrl: mode === 'image' && imageFile ? await readFileAsDataUrl(imageFile) : undefined,
        sourceLabel: mode === 'image' ? imageFile?.name : '粘贴文字识别',
        defaults: payloadDefaults,
      });

      if (response.success && response.data) {
        setDrafts(response.data.drafts || []);
        setParseWarnings(response.data.warnings || []);
        setParsedModel(response.data.model || '');
        setCurrentHistoryId(response.data.historyId || null);
        void loadHistory();

        if (!response.data.drafts?.length) {
          setError('没有识别出可导入的域名，请调整图片或文字后重试。');
        }
      } else {
        setError(response.error?.message || 'AI 识别失败。');
        setCurrentHistoryId(response.data?.historyId || null);
        void loadHistory();
      }
    } catch {
      setError('网络错误，AI 识别未完成。');
    } finally {
      setLoading(false);
    }
  };

  const handleAiImport = async () => {
    if (!drafts.length) {
      setError('请先执行 AI 识别。');
      return;
    }

    const firstInvalid = drafts.find(
      (draft) =>
        !draft.domainAddress.trim() ||
        !draft.renewalUrl.trim() ||
        !draft.registrationDate.trim() ||
        !draft.reminderEmail.trim() ||
        !Number.isFinite(draft.usagePeriodYears) ||
        !Number.isFinite(draft.reminderDaysOffset) ||
        !Number.isFinite(draft.reminderCount)
    );

    if (firstInvalid) {
      setError('仍有未补全的识别结果，请先修正后再导入。');
      return;
    }

    await applyBatchImport(
      drafts.map((draft) => ({
        domainAddress: draft.domainAddress.trim(),
        renewalUrl: draft.renewalUrl.trim(),
        registrationDate: draft.registrationDate.trim(),
        usagePeriodYears: draft.usagePeriodYears,
        reminderDaysOffset: draft.reminderDaysOffset,
        reminderEmail: draft.reminderEmail.trim(),
        reminderCount: draft.reminderCount,
      }))
    );
  };

  const loadDraftsFromHistory = (item: AiImportHistoryItem) => {
    setMode(item.sourceType === 'image' ? 'image' : 'text');
    setDrafts(item.drafts || []);
    setParseWarnings(item.warnings || []);
    setParsedModel(item.model || '');
    setCurrentHistoryId(item.id);
    clearFeedback();
  };

  const handleRetryHistory = async (item: AiImportHistoryItem) => {
    setLoading(true);
    clearFeedback();
    setCurrentHistoryId(null);

    try {
      const response = await apiClient.retryAiImportHistory(item.id, {
        renewalUrl: defaults.renewalUrl.trim() || undefined,
        usagePeriodYears: defaults.usagePeriodYears,
        reminderDaysOffset: defaults.reminderDaysOffset,
        reminderEmail: defaults.reminderEmail.trim() || undefined,
        reminderCount: defaults.reminderCount,
      });

      if (response.success && response.data) {
        setMode('text');
        setDrafts(response.data.drafts || []);
        setParseWarnings(response.data.warnings || []);
        setParsedModel(response.data.model || '');
        setCurrentHistoryId(response.data.historyId || null);
        await loadHistory();
      } else {
        setError(response.error?.message || '历史记录重试失败。');
        setCurrentHistoryId(response.data?.historyId || null);
        await loadHistory();
      }
    } catch {
      setError('网络错误，历史重试未完成。');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === 'csv') {
      await handleCsvImport();
      return;
    }

    if (drafts.length > 0) {
      await handleAiImport();
      return;
    }

    await handleAiParse();
  };

  const primaryButtonLabel =
    mode === 'csv'
      ? loading
        ? '导入中...'
        : '开始导入'
      : drafts.length > 0
        ? loading
          ? '导入中...'
          : '确认导入识别结果'
        : loading
          ? '识别中...'
          : '开始 AI 识别';

  const isPrimaryDisabled =
    loading ||
    Boolean(result) ||
    (mode === 'csv' && !csvFile) ||
    (mode === 'text' && !drafts.length && !textInput.trim()) ||
    (mode === 'image' && !drafts.length && !imageFile);

  return (
    <ModalShell title="批量导入 / AI 识别" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { key: 'csv', label: 'CSV 导入' },
            { key: 'text', label: '粘贴文字' },
            { key: 'image', label: '图片识别' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => switchMode(item.key as ImportSourceMode)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                mode === item.key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'border border-gray-300 bg-white/80 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {mode === 'csv'
            ? '先下载模板，按列填写后再上传。当前支持标准 CSV，不支持带逗号转义的复杂内容。'
            : 'AI 会先识别为导入草稿，你确认或修正后才会真正入库。建议先填写默认续费网址和提醒邮箱，提高识别后的可导入率。'}
        </div>

        {mode === 'csv' ? (
          <>
            <button
              type="button"
              onClick={downloadTemplate}
              className="w-full rounded-xl border-2 border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
            >
              下载 CSV 模板
            </button>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">选择 CSV 文件</label>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setCsvFile(selected);
                  clearFeedback();
                }}
                className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="默认续费网址"
                value={defaults.renewalUrl}
                onChange={(value) => setDefaults({ ...defaults, renewalUrl: value })}
                placeholder="https://registrar.example.com/renew"
                type="url"
              />
              <TextField
                label="默认提醒邮箱"
                value={defaults.reminderEmail}
                onChange={(value) => setDefaults({ ...defaults, reminderEmail: value })}
                placeholder="you@example.com"
                type="email"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField
                label="默认使用年限"
                value={defaults.usagePeriodYears}
                onChange={(value) => setDefaults({ ...defaults, usagePeriodYears: value })}
                min={1}
                max={100}
              />
              <NumberField
                label="默认提前提醒天数"
                value={defaults.reminderDaysOffset}
                onChange={(value) => setDefaults({ ...defaults, reminderDaysOffset: value })}
                min={1}
                max={365}
              />
              <NumberField
                label="默认提醒次数"
                value={defaults.reminderCount}
                onChange={(value) => setDefaults({ ...defaults, reminderCount: value })}
                min={1}
                max={30}
              />
            </div>

            {mode === 'text' ? (
              <TextAreaField
                label="粘贴域名文字"
                value={textInput}
                onChange={(value) => {
                  setTextInput(value);
                  setDrafts([]);
                  setParseWarnings([]);
                  clearFeedback();
                }}
                placeholder="可以粘贴注册商后台列表、账单文字、提醒邮件内容等。"
              />
            ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">上传截图或账单图片</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    setImageFile(selected);
                    setDrafts([]);
                    setParseWarnings([]);
                    clearFeedback();
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">建议使用清晰截图，优先包含域名、到期日期、续费入口或提醒邮箱等关键信息。</p>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">最近识别历史</div>
              <div className="text-xs text-gray-500">仅保存识别摘要和草稿，不长期保存原始图片内容。</div>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50"
            >
              刷新
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-sm text-gray-500">历史加载中...</div>
          ) : historyItems.length === 0 ? (
            <EmptyStatePanel
              title="还没有 AI 识别历史"
              description="完成一次文字或图片识别后，摘要和草稿会出现在这里，方便快速回看和重试。"
              variant="history"
              compact
              className="border-gray-200 bg-gray-50/70 shadow-none dark:border-gray-700 dark:bg-gray-800/70"
            />
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-gray-900">{item.sourceLabel}</div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : item.status === 'imported'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {item.status === 'failed' ? '失败' : item.status === 'imported' ? '已导入' : '成功'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {item.sourceType === 'image' ? '图片' : '文字'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatDateTime(item.createdAt)}
                        {item.model ? ` · ${item.model}` : ''}
                        {item.resultCount > 0 ? ` · ${item.resultCount} 条记录` : ''}
                      </div>
                      {item.errorMessage && <div className="mt-2 text-sm text-red-600">{item.errorMessage}</div>}
                      {!item.errorMessage && item.warnings.length > 0 && (
                        <div className="mt-2 text-sm text-amber-700">{item.warnings[0]}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.canLoadDrafts && (
                        <button
                          type="button"
                          onClick={() => loadDraftsFromHistory(item)}
                          className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
                        >
                          载入草稿
                        </button>
                      )}
                      {item.canRetry && (
                        <button
                          type="button"
                          onClick={() => void handleRetryHistory(item)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50"
                        >
                          重试
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!!parseWarnings.length && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">识别提示</div>
            <div className="mt-2 space-y-1">
              {parseWarnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          </div>
        )}

        {!!drafts.length && (
          <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-indigo-900">AI 识别预览</div>
                <div className="text-xs text-indigo-700">
                  已识别 {drafts.length} 条记录{parsedModel ? `，模型：${parsedModel}` : ''}。导入前可逐条修正。
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrafts([]);
                  setParseWarnings([]);
                  setParsedModel('');
                  clearFeedback();
                }}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
              >
                重新识别
              </button>
            </div>

            <div className="space-y-4">
              {drafts.map((draft, index) => (
                <div key={`${draft.domainAddress || 'draft'}-${index}`} className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-gray-900">记录 #{index + 1}</div>
                    {draft.confidence !== null && (
                      <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        置信度 {Math.round(draft.confidence * 100)}%
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField
                      label="域名地址"
                      value={draft.domainAddress}
                      onChange={(value) => updateDraft(index, 'domainAddress', value)}
                      placeholder="example.com"
                    />
                    <TextField
                      label="续费网址"
                      value={draft.renewalUrl}
                      onChange={(value) => updateDraft(index, 'renewalUrl', value)}
                      placeholder="https://example.com/renew"
                      type="url"
                    />
                    <TextField
                      label="注册日期"
                      value={draft.registrationDate}
                      onChange={(value) => updateDraft(index, 'registrationDate', value)}
                      type="date"
                    />
                    <TextField
                      label="提醒邮箱"
                      value={draft.reminderEmail}
                      onChange={(value) => updateDraft(index, 'reminderEmail', value)}
                      placeholder="you@example.com"
                      type="email"
                    />
                    <NumberField
                      label="使用年限"
                      value={draft.usagePeriodYears}
                      onChange={(value) => updateDraft(index, 'usagePeriodYears', value)}
                      min={1}
                      max={100}
                    />
                    <NumberField
                      label="提前提醒天数"
                      value={draft.reminderDaysOffset}
                      onChange={(value) => updateDraft(index, 'reminderDaysOffset', value)}
                      min={1}
                      max={365}
                    />
                    <NumberField
                      label="提醒次数"
                      value={draft.reminderCount}
                      onChange={(value) => updateDraft(index, 'reminderCount', value)}
                      min={1}
                      max={30}
                    />
                  </div>

                  {draft.sourceSnippet && (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      来源片段：{draft.sourceSnippet}
                    </div>
                  )}

                  {!!draft.warnings.length && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {draft.warnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <FormError error={error} />

        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoItem label="导入成功" value={String(result.success)} />
              <InfoItem label="导入失败" value={String(result.failed)} />
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 rounded-xl bg-white/80 p-3 text-sm text-red-700">
                {result.errors.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            {result ? '关闭' : '取消'}
          </button>
          <button
            type="submit"
            disabled={isPrimaryDisabled}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {primaryButtonLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface EditDomainModalProps {
  domain: Domain;
  onClose: () => void;
  onSuccess: () => void;
}

function EditDomainModal({ domain, onClose, onSuccess }: EditDomainModalProps) {
  const [formData, setFormData] = useState({
    renewalUrl: domain.renewal_url,
    reminderStartDate: new Date(domain.reminder_start_date * 1000).toISOString().split('T')[0],
    reminderCount: domain.reminder_count,
    status: domain.status,
    statusNote: domain.status_note || '',
    owner: domain.owner || '',
    processedAt: domain.processed_at ? new Date(domain.processed_at * 1000).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.updateDomain(domain.id, {
        renewalUrl: formData.renewalUrl,
        reminderStartDate: Math.floor(new Date(formData.reminderStartDate).getTime() / 1000),
        reminderCount: formData.reminderCount,
        status: formData.status,
        statusNote: formData.statusNote.trim() || null,
        owner: formData.owner.trim() || null,
        processedAt: formData.processedAt ? Math.floor(new Date(formData.processedAt).getTime() / 1000) : null,
      });

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error?.message || '更新失败。');
      }
    } catch {
      setError('网络错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="编辑域名" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError error={error} />
        <TextField label="域名地址" value={domain.domain_address} onChange={() => undefined} disabled />
        <TextField label="续费网址" type="url" value={formData.renewalUrl} onChange={(value) => setFormData({ ...formData, renewalUrl: value })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="提醒开始日期" type="date" value={formData.reminderStartDate} onChange={(value) => setFormData({ ...formData, reminderStartDate: value })} />
          <NumberField label="提醒次数" value={formData.reminderCount} onChange={(value) => setFormData({ ...formData, reminderCount: value })} min={1} max={30} />
        </div>
        <FilterSelect
          label="域名状态"
          value={formData.status}
          onChange={(value) => setFormData({ ...formData, status: value as DomainStatus })}
          options={[
            { label: '提醒中', value: 'active' },
            { label: '已处理', value: 'handled' },
            { label: '已暂停', value: 'paused' },
            { label: '已放弃', value: 'abandoned' },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="负责人" value={formData.owner} onChange={(value) => setFormData({ ...formData, owner: value })} placeholder="例如：张三 / Ops / 自己" />
          <TextField label="处理时间" type="date" value={formData.processedAt} onChange={(value) => setFormData({ ...formData, processedAt: value })} />
        </div>
        <TextAreaField
          label="状态备注"
          value={formData.statusNote}
          onChange={(value) => setFormData({ ...formData, statusNote: value })}
          placeholder="可选，例如：已人工续费处理中、供应商账单待确认等"
        />
        <ModalActions onClose={onClose} loading={loading} submitLabel="保存修改" />
      </form>
    </ModalShell>
  );
}

interface DeleteConfirmDialogProps {
  domain: Domain;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteConfirmDialog({ domain, onClose, onSuccess }: DeleteConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.deleteDomain(domain.id);
      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error?.message || '删除失败。');
      }
    } catch {
      setError('网络错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="删除域名" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          确认删除 <span className="font-semibold">{domain.domain_address}</span>？此操作无法撤销。
        </div>
        <FormError error={error} />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 text-white">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-all hover:bg-white/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function FormError({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value, 10))}
        min={min}
        max={max}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </div>
  );
}

function ModalActions({
  onClose,
  loading,
  submitLabel,
}: {
  onClose: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
      >
        取消
      </button>
      <button
        type="submit"
        disabled={loading}
        className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '保存中...' : submitLabel}
      </button>
    </div>
  );
}
