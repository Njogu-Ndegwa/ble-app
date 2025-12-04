"use client";

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/i18n';

export interface ActivityItem {
  id: string;
  type: 'swap' | 'topup' | 'payment';
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
}

const RiderActivity: React.FC<RiderActivityProps> = ({ activities }) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'swaps' | 'payments' | 'topups'>('all');

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    const typeMap: Record<string, string> = {
      'swaps': 'swap',
      'payments': 'payment',
      'topups': 'topup',
    };
    return activities.filter(a => a.type === typeMap[filter]);
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
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {t('No activities found')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiderActivity;
