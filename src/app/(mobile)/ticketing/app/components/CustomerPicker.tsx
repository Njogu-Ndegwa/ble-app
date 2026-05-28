'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, Check } from 'lucide-react';
import { useI18n } from '@/i18n';
import { getContacts, type OdooContact } from '@/lib/odoo-api';

interface Props {
  token: string | undefined;
  selected: { id: number; name: string } | null;
  onChange: (contact: { id: number; name: string } | null) => void;
}

export default function CustomerPicker({ token, selected, onChange }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OdooContact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await getContacts({ q: q.trim(), limit: 10, type: 'all' }, token);
        setResults(res.contacts ?? []);
      } catch (err) {
        setError((err as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  return (
    <div style={{ position: 'relative' }}>
      {selected ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected.name}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('common.clear') || 'Clear'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
              }}
            />
            <input
              type="text"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={e => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder={t('ticketing.new.customerPlaceholder') || 'Search customers…'}
              style={{
                width: '100%',
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {open && (query.trim() || loading || error) && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 30,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                maxHeight: 220,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              {loading && (
                <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <Loader2 size={14} className="animate-spin" />
                  {t('common.searching') || 'Searching…'}
                </div>
              )}
              {!loading && error && (
                <div style={{ padding: 10, color: 'var(--color-error)', fontSize: 12 }}>
                  {error}
                </div>
              )}
              {!loading && !error && results.length === 0 && query.trim() && (
                <div style={{ padding: 10, color: 'var(--text-muted)', fontSize: 12 }}>
                  {t('ticketing.new.noCustomers') || 'No results'}
                </div>
              )}
              {!loading &&
                !error &&
                results.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      onChange({ id: c.id, name: c.name });
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'left',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <Check size={12} style={{ opacity: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    {c.email && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
                        {String(c.email)}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
