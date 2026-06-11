'use client';

import React from 'react';
import { ChevronDown, Clipboard, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';

interface AdvancedPanelProps {
  open: boolean;
  onToggle: () => void;
  cmdService: any;
  pubkCharacteristic: any;
  pubkValue: string | null;
  isLoadingService: string | null;
  serviceLoadingProgress: number;
  isReading: boolean;
  onRead: () => void;
  onWrite: () => void;
  onRefreshService: () => void;
  translateDescription: (desc: string) => string;
}

const AdvancedPanel: React.FC<AdvancedPanelProps> = ({
  open, onToggle, cmdService, pubkCharacteristic, pubkValue,
  isLoadingService, serviceLoadingProgress, isReading,
  onRead, onWrite, onRefreshService, translateDescription,
}) => {
  const { t } = useI18n();

  return (
    <div className="mb-6">
      <button
        className="w-full rounded-xl px-4 py-3 flex items-center justify-between transition-colors"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          <Settings size={16} />
          {t('Advanced — raw device access')}
        </span>
        <ChevronDown
          size={16}
          className="transition-transform duration-200"
          style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="mt-3">
          {isLoadingService === 'CMD' && (
            <div className="w-full h-1 mb-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{ width: `${serviceLoadingProgress}%`, background: 'var(--accent)' }}
              />
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('CMD Service')}</h3>
            <button
              onClick={onRefreshService}
              disabled={!!isLoadingService}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${isLoadingService ? 'animate-spin' : ''}`}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: isLoadingService ? 'not-allowed' : 'pointer',
                opacity: isLoadingService ? 0.5 : 1,
              }}
              aria-label={t('Refresh CMD service')}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {cmdService && pubkCharacteristic ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
            >
              <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {pubkCharacteristic.name}
                </span>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', fontSize: 13, minHeight: 36, flex: '0 0 auto' }}
                    onClick={onRead}
                    disabled={isReading}
                  >
                    {isReading ? t('Reading...') : t('Read')}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: 13, minHeight: 36, flex: '0 0 auto' }}
                    onClick={onWrite}
                  >
                    {t('Write')}
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {translateDescription(pubkCharacteristic.desc)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-grow min-w-0">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
                    <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                      {pubkValue || 'N/A'}
                    </p>
                  </div>
                  <button
                    className="p-1.5 transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => {
                      navigator.clipboard.writeText(String(pubkValue || 'N/A'));
                      toast.success(t('Value copied to clipboard'));
                    }}
                    aria-label={t('Copy to clipboard')}
                  >
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center" style={{ color: 'var(--text-secondary)' }}>
              {isLoadingService === 'CMD' ? (
                <p className="text-sm">{t('Loading CMD service data...')}</p>
              ) : (
                <p className="text-sm">{t('No data available for CMD service')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedPanel;
