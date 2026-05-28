'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useI18n } from '@/i18n';
import { getOdooEmployeeToken, getSelectedSA, isOdooEmployeeLoggedIn } from '@/lib/ov-auth';
import type { ServiceAccount } from '@/lib/sa-types';
import type { HelpdeskStage, Ticket } from '@/lib/tickets-types';
import { fetchHelpdeskStages } from '@/lib/tickets-api';
import TicketList from './components/TicketList';
import TicketDetailDrawer from './components/TicketDetailDrawer';
import NewTicketModal from './components/NewTicketModal';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; ticketId: number };

export default function TicketingApp() {
  const router = useRouter();
  const { t } = useI18n();

  const [view, setView] = useState<View>({ kind: 'list' });
  const [showNewModal, setShowNewModal] = useState(false);
  const [sa, setSa] = useState<ServiceAccount | null>(null);
  const [stages, setStages] = useState<HelpdeskStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [stagesError, setStagesError] = useState<string | null>(null);
  // Reload counter forces TicketList to re-fetch when a ticket is created/updated/deleted.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    document.body.classList.add('overflow-locked');
    return () => {
      document.body.classList.remove('overflow-locked');
    };
  }, []);

  useEffect(() => {
    if (!isOdooEmployeeLoggedIn()) {
      router.replace('/signin');
      return;
    }
    setSa(getSelectedSA());
  }, [router]);

  const token = useMemo(() => getOdooEmployeeToken() ?? undefined, []);

  useEffect(() => {
    let cancelled = false;
    setStagesLoading(true);
    setStagesError(null);
    fetchHelpdeskStages(token)
      .then(s => {
        if (!cancelled) setStages(s);
      })
      .catch((err: Error) => {
        if (!cancelled) setStagesError(err.message);
      })
      .finally(() => {
        if (!cancelled) setStagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleTicketClick = useCallback((ticket: Ticket) => {
    setView({ kind: 'detail', ticketId: ticket.id });
  }, []);

  const handleBack = useCallback(() => {
    setView({ kind: 'list' });
  }, []);

  const handleCreated = useCallback(() => {
    setShowNewModal(false);
    setReloadTick(n => n + 1);
  }, []);

  const handleUpdated = useCallback(() => {
    setReloadTick(n => n + 1);
  }, []);

  const handleDeleted = useCallback(() => {
    setView({ kind: 'list' });
    setReloadTick(n => n + 1);
  }, []);

  const headerOnBack = view.kind === 'detail' ? handleBack : undefined;
  const headerTitle = view.kind === 'detail' ? t('ticketing.detail.title') || 'Ticket' : t('ticketing.title') || 'Ticketing';

  if (!sa) {
    return (
      <div className="sales-container">
        <div className="sales-bg-gradient" />
        <AppHeader />
        <main className="sales-main sales-main-screen">
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-secondary)',
              maxWidth: 360,
              margin: '24px auto',
            }}
          >
            {t('ticketing.error.noSA') ||
              'Please select a service account to view tickets.'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sales-container">
      <div className="sales-bg-gradient" />
      <AppHeader showBack onBack={headerOnBack} title={headerTitle} />

      <main className="sales-main sales-main-screen">
        <div className="sales-screen-container">
          {view.kind === 'list' && (
            <TicketList
              stages={stages}
              stagesLoading={stagesLoading}
              stagesError={stagesError}
              token={token}
              reloadKey={reloadTick}
              onTicketClick={handleTicketClick}
              onNewTicket={() => setShowNewModal(true)}
            />
          )}
          {view.kind === 'detail' && (
            <TicketDetailDrawer
              ticketId={view.ticketId}
              stages={stages}
              token={token}
              onBack={handleBack}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          )}
        </div>
      </main>

      {showNewModal && (
        <NewTicketModal
          stages={stages}
          token={token}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
