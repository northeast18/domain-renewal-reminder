/**
 * Input validation utilities
 */

import { DomainInput, DomainStatus } from '../types';

export const DOMAIN_STATUSES: DomainStatus[] = ['active', 'paused', 'handled', 'abandoned'];

/**
 * Validates domain address format
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // Basic domain regex
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(domain.trim());
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes and sorts reminder days schedule (descending, unique integers between 1 and 365)
 */
export function normalizeReminderSchedule(
  schedule: unknown,
  fallbackOffset?: number
): number[] {
  const rawItems: unknown[] = Array.isArray(schedule)
    ? schedule
    : typeof schedule === 'string' && schedule.trim()
      ? schedule.trim().startsWith('[')
        ? (() => {
            try {
              const parsed = JSON.parse(schedule);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return schedule.split(/[,\s，、]+/);
            }
          })()
        : schedule.split(/[,\s，、]+/)
      : [];

  const validDays = Array.from(
    new Set(
      rawItems
        .map((item) => (typeof item === 'number' ? Math.floor(item) : parseInt(String(item).trim(), 10)))
        .filter((num) => Number.isFinite(num) && num >= 1 && num <= 365)
    )
  ).sort((a, b) => b - a);

  if (validDays.length > 0) {
    return validDays.slice(0, 30);
  }

  if (
    typeof fallbackOffset === 'number' &&
    Number.isFinite(fallbackOffset) &&
    fallbackOffset >= 1 &&
    fallbackOffset <= 365
  ) {
    return [Math.floor(fallbackOffset)];
  }

  return [];
}

/**
 * Validates domain input for creation/update
 */
export function validateDomainInput(input: Partial<DomainInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.domainAddress || !isValidDomain(input.domainAddress)) {
    errors.push('Invalid domain address');
  }

  if (!input.renewalUrl || !isValidUrl(input.renewalUrl)) {
    errors.push('Invalid renewal URL');
  }

  if (!input.registrationDate || !(input.registrationDate instanceof Date) || Number.isNaN(input.registrationDate.getTime())) {
    errors.push('Invalid registration date');
  }

  if (!input.usagePeriodYears || input.usagePeriodYears < 1 || input.usagePeriodYears > 100) {
    errors.push('Usage period must be between 1 and 100 years');
  }

  const normalizedSchedule = normalizeReminderSchedule(input.reminderDaysSchedule, input.reminderDaysOffset);

  if (normalizedSchedule.length === 0) {
    errors.push('Reminder days offset must be between 1 and 365');
  }

  if (!input.reminderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.reminderEmail)) {
    errors.push('Invalid reminder email');
  }

  const effectiveReminderCount =
    input.reminderDaysSchedule && normalizedSchedule.length > 0
      ? normalizedSchedule.length
      : input.reminderCount;

  if (!effectiveReminderCount || effectiveReminderCount < 1 || effectiveReminderCount > 30) {
    errors.push('Reminder count must be between 1 and 30');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isValidDomainStatus(status: unknown): status is DomainStatus {
  return typeof status === 'string' && DOMAIN_STATUSES.includes(status as DomainStatus);
}

/**
 * Validates SMTP configuration
 */
export function validateSmtpConfig(
  config: any,
  options: { requirePassword?: boolean } = {}
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const requirePassword = options.requirePassword ?? true;
  const hasSecret =
    (typeof config.password === 'string' && config.password.length > 0) ||
    (typeof config.apiKey === 'string' && config.apiKey.length > 0);

  // Validate provider
  if (!config.provider || !['http-api', 'smtp'].includes(config.provider)) {
    errors.push('Provider must be either "http-api" or "smtp"');
  }

  // Common validations
  if (!config.fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.fromEmail)) {
    errors.push('Invalid from email');
  }

  if (!config.fromName || typeof config.fromName !== 'string') {
    errors.push('From name is required');
  }

  if (requirePassword && !hasSecret) {
    errors.push('Password/API Key is required');
  }

  // Provider-specific validations
  if (config.provider === 'http-api') {
    // HTTP API validations
    if (!config.apiType || !['resend', 'sendgrid', 'mailgun', 'custom'].includes(config.apiType)) {
      errors.push('API type must be resend, sendgrid, mailgun, or custom');
    }

    if (config.apiType === 'mailgun' && !config.mailgunDomain) {
      errors.push('Mailgun domain is required for Mailgun API');
    }

    if (config.apiType === 'custom' && (!config.host || typeof config.host !== 'string')) {
      errors.push('Host is required for custom API');
    }
  } else if (config.provider === 'smtp') {
    // SMTP validations
    if (!config.host || typeof config.host !== 'string') {
      errors.push('SMTP host is required');
    }

    if (!config.port || ![465, 587].includes(config.port)) {
      errors.push('SMTP port must be 465 or 587 (port 25 is not supported)');
    }

    // Username is optional for SMTP
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates password strength
 */
export function isValidPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
