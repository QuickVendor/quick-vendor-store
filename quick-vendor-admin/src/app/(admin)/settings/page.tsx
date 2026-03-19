'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getSettings, updateSettings, formatDate } from '@/lib/api';
import type { PlatformSettings } from '@/lib/api';

export default function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    commissionPercentage: 5,
    orderExpirationMinutes: 30,
    escalationThreshold: 3,
    escalationWindowDays: 30,
  });

  useEffect(() => {
    if (!token) return;
    getSettings(token)
      .then((s) => {
        setSettings(s);
        setForm({
          commissionPercentage: s.commissionPercentage,
          orderExpirationMinutes: s.orderExpirationMinutes,
          escalationThreshold: s.escalationThreshold,
          escalationWindowDays: s.escalationWindowDays,
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage('');

    try {
      const updated = await updateSettings(token, form);
      setSettings(updated);
      setMessage('Settings saved successfully');
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Failed to save settings',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Platform Settings
      </h1>

      <form
        onSubmit={handleSave}
        className="max-w-lg space-y-6 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Platform Commission (%)
          </label>
          <input
            type="number"
            min={0}
            max={50}
            value={form.commissionPercentage}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                commissionPercentage: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Percentage taken from each transaction (0-50%)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Order Expiration (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={form.orderExpirationMinutes}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                orderExpirationMinutes: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Minutes before unpaid orders are auto-expired (5-1440)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Escalation Threshold
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={form.escalationThreshold}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                escalationThreshold: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Number of reports before auto-escalation (1-20)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Escalation Window (days)
          </label>
          <input
            type="number"
            min={7}
            max={90}
            value={form.escalationWindowDays}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                escalationWindowDays: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Days window for counting reports toward escalation (7-90)
          </p>
        </div>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              message.includes('success')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {message}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          {settings && (
            <p className="text-xs text-gray-400">
              Last updated: {formatDate(settings.updatedAt)}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs text-gray-400">
        Only SUPER_ADMIN can update settings. Changes are audit-logged.
      </p>
    </div>
  );
}
