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
  reminder_days_schedule?: string | null;
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

const PRESET_REMINDER_DAYS = [180, 90, 60, 30, 15, 7, 3, 1];

function normalizeScheduleDays(items: unknown[], fallbackOffset?: number): number[] {
  const valid = Array.from(
    new Set(
      items
        .map((item) => (typeof item === 'number' ? Math.floor(item) : parseInt(String(item).trim(), 10)))
        .filter((num) => Number.isFinite(num) && num >= 1 && num <= 365)
    )
  ).sort((a, b) => b - a);

  if (valid.length > 0) {
    return valid.slice(0, 30);
  }

  if (typeof fallbackOffset === 'number' && Number.isFinite(fallbackOffset) && fallbackOffset >= 1 && fallbackOffset <= 365) {
    return [Math.floor(fallbackOffset)];
  }

  return [];
}

function parseDomainSchedule(domain: Pick<Domain, 'reminder_days_schedule' | 'reminder_days_offset'>): number[] {
  if (domain.reminder_days_schedule) {
    try {
      const parsed = JSON.parse(domain.reminder_days_schedule);
      if (Array.isArray(parsed)) {
        const normalized = normalizeScheduleDays(parsed, domain.reminder_days_offset);
        if (normalized.length > 0) {
          return normalized;
        }
      }
    } catch {
      const split = domain.reminder_days_schedule.split(/[,\s，、]+/);
      const normalized = normalizeScheduleDays(split, domain.reminder_days_offset);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return normalizeScheduleDays([domain.reminder_days_offset], 30);
}

function formatIsoDateInput(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

function addYearsToDateString(dateStr: string, years: number): string {
  if (!dateStr || !Number.isFinite(years)) {
    return '';
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().split('T')[0];
}

function formatOffsetTriggerDate(expiryDateStr: string, offsetDays: number): string {
  if (!expiryDateStr || !Number.isFinite(offsetDays)) {
    return '';
  }
  const date = new Date(`${expiryDateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toLocaleDateString('zh-CN');
}

function getDaysUntilDateString(expiryDateStr: string): number | null {
  if (!expiryDateStr) {
    return null;
  }
  const date = new Date(`${expiryDateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
    <div className="rounded-lg bg-white/70 px-2.5 py-2.5 dark:bg-gray-800/70 sm:rounded-xl sm:px-3 sm:py-3">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-0.5 text-xs font-semibold text-gray-900 dark:text-gray-100 sm:mt-1 sm:text-sm ${breakAll ? 'break-all' : ''}`}>{value}</div>
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
  const progress = Math.min(100, Math.round((domain.reminders_sent / Math.max(1, domain.reminder_count)) * 100));
  const schedule = parseDomainSchedule(domain);
  const scheduleSummary = `提前 ${schedule.join(' / ')} 天`;

  return (
    <div className="glass-card rounded-2xl border border-white/40 p-3 shadow-lg sm:p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-all text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">{domain.domain_address}</h3>
              <StatusBadge status={domain.status} />
            </div>
            <div className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{domain.renewal_url}</div>
          </div>
          <RemainingBadge daysLeft={daysLeft} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
          <InfoItem label="到期日期" value={formatDate(domain.expiry_date)} />
          <InfoItem label="提醒节点 / 下次提醒" value={`${scheduleSummary}（${formatDate(domain.reminder_start_date)}）`} />
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
          <div className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300">
            备注：{domain.status_note}
          </div>
        )}

        {domain.last_renewed_at && (
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">上次续费：{formatDate(domain.last_renewed_at)}</div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>提醒发送进度</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white/45 p-2.5 sm:p-3 lg:p-4 dark:border-gray-700/80 dark:bg-gray-800/45">
          <div className="mb-2.5 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 sm:text-sm">操作区</div>
              <div className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">常用操作优先展示，其他管理操作保持收敛。</div>
            </div>
            <div className="hidden items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400 sm:inline-flex">
              续费工作流
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-3 2xl:grid-cols-6">
          <button
            type="button"
            onClick={() => onRenew(domain)}
            className="rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          >
            <span className="hidden sm:inline">续费并重置提醒</span>
            <span className="sm:hidden">续费重置</span>
          </button>
          <button
            type="button"
            onClick={() => onHandle(domain)}
            className="rounded-lg bg-sky-50 px-2.5 py-2 text-xs font-semibold text-sky-700 transition-all hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:hover:bg-sky-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          >
            <span className="hidden sm:inline">标记已处理</span>
            <span className="sm:hidden">已处理</span>
          </button>
          {domain.status === 'active' ? (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'paused')}
              className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
            >
              <span className="hidden sm:inline">暂停提醒</span>
              <span className="sm:hidden">暂停</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'active')}
              className="rounded-lg bg-teal-50 px-2.5 py-2 text-xs font-semibold text-teal-700 transition-all hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
            >
              <span className="hidden sm:inline">恢复提醒</span>
              <span className="sm:hidden">恢复</span>
            </button>
          )}
          {domain.status !== 'abandoned' && (
            <button
              type="button"
              onClick={() => onStatusChange(domain, 'abandoned')}
              className="rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
            >
              <span className="hidden sm:inline">标记已放弃</span>
              <span className="sm:hidden">已放弃</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(domain)}
            className="rounded-lg bg-indigo-50 px-2.5 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => onDelete(domain)}
            className="rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 transition-all hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
          >
            删除
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DomainCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl border border-white/40 p-4 shadow-lg sm:p-5 lg:p-6 animate-pulse">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          </div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-white/70 dark:bg-gray-800/70 px-3 py-3">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            </div>
          ))}
        </div>

        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>

        <div className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white/45 dark:bg-gray-800/45 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
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

  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => {
        setBanner(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

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
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-100 sm:w-auto"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {loading && domains.length === 0 ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="域名总数" value={String(totalDomains)} />
            <StatCard label="提醒中" value={String(activeCount)} accent="emerald" />
            <StatCard label="已处理" value={String(handledCount)} accent="indigo" />
            <StatCard label="已暂停" value={String(pausedCount)} accent="amber" />
            <StatCard label="已放弃" value={String(abandonedCount)} accent="rose" />
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">我的域名</h2>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 sm:px-5 sm:py-3"
            >
              添加域名
            </button>
            <button
              type="button"
              onClick={() => setShowBatchImportModal(true)}
              className="rounded-xl border-2 border-indigo-600 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-900/30 sm:px-5 sm:py-3"
            >
              批量导入
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              banner.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            <div className="flex items-start gap-3">
              {banner.tone === 'success' ? (
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{banner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="关闭提示"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="glass-card mb-6 rounded-2xl p-4 shadow-lg sm:p-5">
          <div className="mb-4 sm:mb-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">搜索域名</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索域名、续费地址或提醒邮箱"
              className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100 dark:placeholder-gray-400 sm:py-3"
            />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">筛选与视图</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
              >
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${viewMode === 'grouped' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
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
          <div className="space-y-4 sm:space-y-5">
            {[1, 2, 3].map((i) => (
              <DomainCardSkeleton key={i} />
            ))}
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
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
              显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalDomains)} 条，共 {totalDomains} 条
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-4 sm:text-sm"
              >
                上一页
              </button>
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300 sm:px-4 sm:text-sm">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-4 sm:text-sm"
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

function StatCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 shadow-lg sm:p-5 animate-pulse">
      <div className="mb-4 h-11 w-11 rounded-xl bg-gray-200 dark:bg-gray-700 sm:h-12 sm:w-12"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
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
      <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{value}</div>
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
      <label htmlFor={`filter-${label}`} className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
      <select
        id={`filter-${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100"
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

interface ReminderScheduleEditorProps {
  schedule: number[];
  onChange: (nextSchedule: number[]) => void;
  expiryDate?: string;
}

function ReminderScheduleEditor({ schedule, onChange, expiryDate }: ReminderScheduleEditorProps) {
  const [customInput, setCustomInput] = useState('');
  const [inputHint, setInputHint] = useState('');

  const daysUntilExpiry = expiryDate ? getDaysUntilDateString(expiryDate) : null;

  const toggleDay = (day: number) => {
    setInputHint('');
    if (schedule.includes(day)) {
      if (schedule.length <= 1) {
        setInputHint('至少需要保留 1 个提醒时间节点。');
        return;
      }
      onChange(schedule.filter((item) => item !== day));
    } else {
      onChange(normalizeScheduleDays([...schedule, day]));
    }
  };

  const removeDay = (day: number) => {
    setInputHint('');
    if (schedule.length <= 1) {
      setInputHint('至少需要保留 1 个提醒时间节点。');
      return;
    }
    onChange(schedule.filter((item) => item !== day));
  };

  const handleAddCustomDays = () => {
    setInputHint('');
    if (!customInput.trim()) {
      return;
    }

    const parts = customInput.split(/[,\s，、]+/).filter(Boolean);
    const parsed = normalizeScheduleDays(parts);
    if (parsed.length === 0) {
      setInputHint('请输入 1 到 365 之间的整数天数（可输入多个，如 90, 60, 15）。');
      return;
    }

    onChange(normalizeScheduleDays([...schedule, ...parsed]));
    setCustomInput('');
  };

  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 dark:border-indigo-800/60 dark:bg-indigo-950/20 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">多节点提醒设置（提前 N 天）</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            可自由添加或移除多个提前提醒节点，到对应天数各发送一次提醒
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          提醒次数：{schedule.length} 次（自动计算）
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">当前已启用节点（点击 × 可移除）：</div>
        <div className="flex flex-wrap gap-2">
          {schedule.map((day, idx) => {
            const triggerDateLabel = expiryDate ? formatOffsetTriggerDate(expiryDate, day) : '';
            const isPastNode = daysUntilExpiry !== null && day > daysUntilExpiry;
            return (
              <span
                key={day}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                  isPastNode
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-indigo-200 bg-white text-indigo-700 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-300'
                }`}
              >
                <span>
                  第{idx + 1}次：提前 {day} 天
                  {triggerDateLabel ? ` (${triggerDateLabel})` : ''}
                  {isPastNode ? ' [已过节点]' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => removeDay(day)}
                  className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200/70 hover:text-red-600 dark:hover:bg-gray-700"
                  title={`移除提前 ${day} 天节点`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">快捷点选常用节点：</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_REMINDER_DAYS.map((preset) => {
            const active = schedule.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => toggleDay(preset)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                    : 'border border-gray-300 bg-white/80 text-gray-700 hover:bg-indigo-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {active ? `✓ ${preset}天` : `+ ${preset}天`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddCustomDays();
            }
          }}
          placeholder="输入自定义提前天数，支持逗号分隔多个（例如：90, 60, 15）"
          className="flex-1 rounded-xl border border-gray-300 bg-white/80 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
        />
        <button
          type="button"
          onClick={handleAddCustomDays}
          className="rounded-xl border border-indigo-600 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50 dark:border-indigo-500 dark:bg-gray-800 dark:text-indigo-300 sm:text-sm"
        >
          添加节点
        </button>
      </div>

      {inputHint && <div className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">{inputHint}</div>}
      {daysUntilExpiry !== null && schedule.some((d) => d > daysUntilExpiry) && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          提示：当前距离到期剩余 {daysUntilExpiry} 天，大于 {daysUntilExpiry} 天的节点日期已在今天之前（可点击节点右侧 × 移除不需要的节点）。
        </div>
      )}
    </div>
  );
}

interface AddDomainModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddDomainModal({ onClose, onSuccess }: AddDomainModalProps) {
  const [schedule, setSchedule] = useState<number[]>([60, 30, 15]);
  const [formData, setFormData] = useState<DomainFormData>({
    domainAddress: '',
    renewalUrl: '',
    registrationDate: '',
    usagePeriodYears: 1,
    reminderDaysOffset: 60,
    reminderDaysSchedule: [60, 30, 15],
    reminderEmail: '',
    reminderCount: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const expiryDatePreview = addYearsToDateString(formData.registrationDate, formData.usagePeriodYears);

  const handleScheduleChange = (nextSchedule: number[]) => {
    setSchedule(nextSchedule);
    setFormData((prev) => ({
      ...prev,
      reminderDaysSchedule: nextSchedule,
      reminderDaysOffset: nextSchedule[0] ?? 30,
      reminderCount: nextSchedule.length,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.addDomain({
        ...formData,
        reminderDaysSchedule: schedule,
        reminderDaysOffset: schedule[0] ?? formData.reminderDaysOffset,
        reminderCount: schedule.length,
      });
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="注册日期" type="date" value={formData.registrationDate} onChange={(value) => setFormData({ ...formData, registrationDate: value })} />
          <NumberField label="使用周期（年）" value={formData.usagePeriodYears} onChange={(value) => setFormData({ ...formData, usagePeriodYears: value })} min={1} max={100} />
          <TextField
            label="到期日期（自动联动）"
            type="date"
            value={expiryDatePreview}
            onChange={(nextExpiry) => {
              const regDate = addYearsToDateString(nextExpiry, -formData.usagePeriodYears);
              if (regDate) {
                setFormData({ ...formData, registrationDate: regDate });
              }
            }}
          />
        </div>
        <ReminderScheduleEditor schedule={schedule} onChange={handleScheduleChange} expiryDate={expiryDatePreview} />
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

  const handleDeleteHistory = async (id: string) => {
    if (!window.confirm('确认删除这条识别历史？')) {
      return;
    }

    try {
      const response = await apiClient.deleteAiImportHistory(id);
      if (response.success) {
        await loadHistory();
        if (currentHistoryId === id) {
          setDrafts([]);
          setParseWarnings([]);
          setParsedModel('');
          setCurrentHistoryId(null);
        }
      } else {
        setError(response.error?.message || '删除历史失败。');
      }
    } catch {
      setError('网络错误，删除历史未完成。');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('确认清空所有识别历史？此操作无法撤销。')) {
      return;
    }

    try {
      const response = await apiClient.clearAiImportHistory();
      if (response.success) {
        await loadHistory();
        setDrafts([]);
        setParseWarnings([]);
        setParsedModel('');
        setCurrentHistoryId(null);
      } else {
        setError(response.error?.message || '清空历史失败。');
      }
    } catch {
      setError('网络错误，清空历史未完成。');
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
              <label htmlFor="csv-file-input" className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">选择 CSV 文件</label>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setCsvFile(selected);
                  clearFeedback();
                }}
                className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100"
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
                <label htmlFor="image-file-input" className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">上传截图或账单图片</label>
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    setImageFile(selected);
                    setDrafts([]);
                    setParseWarnings([]);
                    clearFeedback();
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">建议使用清晰截图，优先包含域名、到期日期、续费入口或提醒邮箱等关键信息。</p>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-800/80 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 sm:text-sm">最近识别历史</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">仅保存识别摘要和草稿，不长期保存原始图片内容。</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 sm:px-3 sm:py-2"
              >
                刷新
              </button>
              {historyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearHistory()}
                  className="rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/30 sm:px-3 sm:py-2"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">历史加载中...</div>
          ) : historyItems.length === 0 ? (
            <EmptyStatePanel
              title="还没有 AI 识别历史"
              description="完成一次文字或图片识别后，摘要和草稿会出现在这里，方便快速回看和重试。"
              variant="history"
              compact
              className="border-gray-200 bg-gray-50/70 shadow-none dark:border-gray-700 dark:bg-gray-800/70"
            />
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {historyItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/70 sm:p-3">
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <div className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100 sm:text-sm">{item.sourceLabel}</div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.status === 'failed'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : item.status === 'imported'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          }`}
                        >
                          {item.status === 'failed' ? '失败' : item.status === 'imported' ? '已导入' : '成功'}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {item.sourceType === 'image' ? '图片' : '文字'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(item.createdAt)}
                        {item.model ? ` · ${item.model}` : ''}
                        {item.resultCount > 0 ? ` · ${item.resultCount} 条` : ''}
                      </div>
                      {item.errorMessage && <div className="mt-1.5 text-xs text-red-600 dark:text-red-400 sm:mt-2 sm:text-sm">{item.errorMessage}</div>}
                      {!item.errorMessage && item.warnings.length > 0 && (
                        <div className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 sm:mt-2 sm:text-sm">{item.warnings[0]}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {item.canLoadDrafts && (
                        <button
                          type="button"
                          onClick={() => loadDraftsFromHistory(item)}
                          className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 sm:px-3 sm:py-2"
                        >
                          载入
                        </button>
                      )}
                      {item.canRetry && (
                        <button
                          type="button"
                          onClick={() => void handleRetryHistory(item)}
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3 sm:py-2"
                        >
                          重试
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteHistory(item.id)}
                        className="rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/30 sm:px-3 sm:py-2"
                      >
                        删除
                      </button>
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
  const initialSchedule = parseDomainSchedule(domain);
  const initialRegDate = formatIsoDateInput(domain.registration_date);
  const initialExpiryDate = formatIsoDateInput(domain.expiry_date);

  const [schedule, setSchedule] = useState<number[]>(initialSchedule);
  const [resetRemindersSent, setResetRemindersSent] = useState<boolean>(domain.reminders_sent > 0);
  const [formData, setFormData] = useState({
    domainAddress: domain.domain_address,
    renewalUrl: domain.renewal_url,
    reminderEmail: domain.reminder_email,
    registrationDate: initialRegDate,
    usagePeriodYears: domain.usage_period_years,
    expiryDate: initialExpiryDate,
    status: domain.status,
    statusNote: domain.status_note || '',
    owner: domain.owner || '',
    processedAt: domain.processed_at ? formatIsoDateInput(domain.processed_at) : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegistrationChange = (nextRegDate: string) => {
    const nextExpiry = addYearsToDateString(nextRegDate, formData.usagePeriodYears);
    setFormData((prev) => ({
      ...prev,
      registrationDate: nextRegDate,
      expiryDate: nextExpiry || prev.expiryDate,
    }));
    setResetRemindersSent(true);
  };

  const handleUsagePeriodChange = (nextYears: number) => {
    const safeYears = Math.max(1, Math.min(100, nextYears || 1));
    const nextExpiry = addYearsToDateString(formData.registrationDate, safeYears);
    setFormData((prev) => ({
      ...prev,
      usagePeriodYears: safeYears,
      expiryDate: nextExpiry || prev.expiryDate,
    }));
    setResetRemindersSent(true);
  };

  const handleExpiryDateChange = (nextExpiry: string) => {
    const derivedRegDate = addYearsToDateString(nextExpiry, -formData.usagePeriodYears);
    setFormData((prev) => ({
      ...prev,
      expiryDate: nextExpiry,
      registrationDate: derivedRegDate || prev.registrationDate,
    }));
    setResetRemindersSent(true);
  };

  const handleScheduleChange = (nextSchedule: number[]) => {
    setSchedule(nextSchedule);
    setResetRemindersSent(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (schedule.length === 0) {
      setError('请至少设置 1 个提前提醒天数节点。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.updateDomain(domain.id, {
        domainAddress: formData.domainAddress.trim(),
        renewalUrl: formData.renewalUrl.trim(),
        reminderEmail: formData.reminderEmail.trim(),
        registrationDate: formData.registrationDate,
        usagePeriodYears: formData.usagePeriodYears,
        reminderDaysSchedule: schedule,
        reminderDaysOffset: schedule[0],
        reminderCount: schedule.length,
        resetRemindersSent,
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

  const daysUntilExpiry = getDaysUntilDateString(formData.expiryDate);

  return (
    <ModalShell title="编辑域名" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError error={error} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="域名地址" value={formData.domainAddress} onChange={(value) => setFormData({ ...formData, domainAddress: value })} />
          <TextField label="提醒邮箱" type="email" value={formData.reminderEmail} onChange={(value) => setFormData({ ...formData, reminderEmail: value })} />
        </div>
        <TextField label="续费网址" type="url" value={formData.renewalUrl} onChange={(value) => setFormData({ ...formData, renewalUrl: value })} />

        <div className="rounded-2xl border border-gray-200/80 bg-white/50 p-3.5 dark:border-gray-700/80 dark:bg-gray-800/40 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">注册与到期时间</span>
            {daysUntilExpiry !== null && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                距离到期剩余 {daysUntilExpiry} 天
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label="注册日期" type="date" value={formData.registrationDate} onChange={handleRegistrationChange} />
            <NumberField label="使用周期（年）" value={formData.usagePeriodYears} onChange={handleUsagePeriodChange} min={1} max={100} />
            <TextField label="到期日期（可联动修改）" type="date" value={formData.expiryDate} onChange={handleExpiryDateChange} />
          </div>
        </div>

        <ReminderScheduleEditor schedule={schedule} onChange={handleScheduleChange} expiryDate={formData.expiryDate} />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 sm:text-sm">
          <input
            type="checkbox"
            checked={resetRemindersSent}
            onChange={(event) => setResetRemindersSent(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            <strong className="font-semibold text-gray-900 dark:text-gray-100">重置已发送提醒进度</strong>
            （当前已发送 {domain.reminders_sent}/{domain.reminder_count} 次，勾选后重置为 0/{schedule.length} 次，确保新设置的提醒时间节点正常触发邮件）
          </span>
        </label>

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
      <div className="glass-card max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-4 text-white sm:rounded-t-2xl sm:px-5">
          <h3 className="text-base font-bold sm:text-lg">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-all hover:bg-white/20" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
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
  const id = `text-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100 dark:placeholder-gray-400 dark:disabled:bg-gray-800"
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
  const id = `number-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(min);
            return;
          }
          const parsed = parseInt(raw, 10);
          if (Number.isFinite(parsed)) {
            onChange(Math.max(min, Math.min(max, parsed)));
          }
        }}
        min={min}
        max={max}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100"
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
  const id = `textarea-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-xl border border-gray-300 bg-white/70 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800/70 dark:text-gray-100 dark:placeholder-gray-400"
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
        className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
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
