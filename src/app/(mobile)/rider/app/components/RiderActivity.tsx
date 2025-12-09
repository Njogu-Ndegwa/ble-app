"use client";

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/i18n';

export interface ActivityItem {
  id: string;
  type: 'swap' | 'topup' | 'payment' | 'service';
  title: string;
  subtitle: string;
  amount: number;
  currency?: string;
  isPositive?: boolean;
  time: string;
  date: string; // ISO date string for grouping
}

interface RiderActivityProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const RiderActivity: React.FC<RiderActivityProps> = ({ 
  activities,
  isLoading = false,
  error = null,
  onRefresh,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'swaps' | 'payments' | 'topups'>('all');

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    const typeMap: Record<string, string[]> = {
      'swaps': ['swap', 'service'],
      'payments': ['payment'],
      'topups': ['topup'],
    };
    const allowedTypes = typeMap[filter] || [];
    return activities.filter(a => allowedTypes.includes(a.type));
  }, [activities, filter]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    
    filteredActivities.forEach(activity => {
      const dateKey = activity.date;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      let displayDate: string;
      if (dateKey === today) {
        displayDate = t('Today');
      } else if (dateKey === yesterday) {
        displayDate = t('Yesterday');
      } else {
        displayDate = new Date(dateKey).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      if (!groups[displayDate]) {
        groups[displayDate] = [];
      }
      groups[displayDate].push(activity);
    });
    
    return groups;
  }, [filteredActivities, t]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'swap':
      case 'service':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        );
      case 'topup':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        );
      case 'payment':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <path d="M1 10h22"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rider-screen active">
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Activity')}</h2>
        <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('Loading your activity...')}</p>

        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('Fetching transactions...')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rider-screen active">
        <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Activity')}</h2>
        <p className="scan-subtitle" style={{ marginBottom: '16px', color: 'var(--error)' }}>{error}</p>

        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <h3 className="empty-state-title">{t('Unable to load activity')}</h3>
          <p className="empty-state-desc">{t('Please check your connection and try again')}</p>
          {onRefresh && (
            <button 
              className="btn btn-secondary" 
              onClick={onRefresh}
              style={{ marginTop: 16 }}
            >
              {t('Try Again')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rider-screen active">
      <h2 className="scan-title" style={{ marginBottom: '4px' }}>{t('Activity')}</h2>
      <p className="scan-subtitle" style={{ marginBottom: '16px' }}>{t('Your swaps and payments')}</p>

      {/* Activity Filters */}
      <div className="activity-filters">
        <button 
          className={`activity-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('All')}
        </button>
        <button 
          className={`activity-filter ${filter === 'swaps' ? 'active' : ''}`}
          onClick={() => setFilter('swaps')}
        >
          {t('Swaps')}
        </button>
        <button 
          className={`activity-filter ${filter === 'payments' ? 'active' : ''}`}
          onClick={() => setFilter('payments')}
        >
          {t('Payments')}
        </button>
        <button 
          className={`activity-filter ${filter === 'topups' ? 'active' : ''}`}
          onClick={() => setFilter('topups')}
        >
          {t('Top-ups')}
        </button>
      </div>

      {/* Activity Summary */}
      {activities.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          marginBottom: 16,
          padding: '0 4px',
        }}>
          <div style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ 
              fontFamily: "'DM Mono', monospace", 
              fontSize: 18, 
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {activities.filter(a => a.type === 'swap' || a.type === 'service').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('Total Swaps')}</div>
          </div>
          <div style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ 
              fontFamily: "'DM Mono', monospace", 
              fontSize: 18, 
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {activities.filter(a => a.type === 'payment').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('Payments')}</div>
          </div>
          <div style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ 
              fontFamily: "'DM Mono', monospace", 
              fontSize: 18, 
              fontWeight: 600,
              color: 'var(--success)',
            }}>
              {activities.filter(a => a.type === 'topup').length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('Top-ups')}</div>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="activity-list">
        {Object.entries(groupedActivities).map(([date, items]) => (
          <React.Fragment key={date}>
            <div className="activity-date-header">{date}</div>
            {items.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className={`activity-item-icon ${activity.type}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="activity-item-content">
                  <div className="activity-item-title">{activity.title}</div>
                  <div className="activity-item-subtitle">{activity.subtitle}</div>
                </div>
                <div className="activity-item-meta">
                  <div className={`activity-item-amount ${activity.isPositive ? 'positive' : 'negative'}`}>
                    {activity.isPositive ? '+' : '-'}{activity.currency || 'XOF'} {Math.abs(activity.amount).toLocaleString()}
                  </div>
                  <div className="activity-item-time">{activity.time}</div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
        
        {filteredActivities.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </div>
            <h3 className="empty-state-title">
              {filter === 'all' ? t('No activities yet') : t('No {type} found').replace('{type}', t(filter))}
            </h3>
            <p className="empty-state-desc">
              {filter === 'all' 
                ? t('Your transaction history will appear here')
                : t('Try selecting a different filter')
              }
            </p>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {onRefresh && activities.length > 0 && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onRefresh}
            style={{ fontSize: 12, padding: '8px 16px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {t('Refresh')}
          </button>
        </div>
      )}
    </div>
  );
};

export default RiderActivity;
