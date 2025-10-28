'use client'

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n';

interface HeartbeatViewProps {
  attributeList: any[];
  onRequestServiceData: (serviceName: string) => void;
  isLoading: boolean;
  handlePublish?: (attributeList: any, serviceType: string) => void;
  initialDataLoadedRef: React.MutableRefObject<boolean>;
  heartbeatSentRef: React.MutableRefObject<boolean>;
}

interface Metric {
  service: string;
  name: string;
  description: string;
  value: any;
}

const HeartbeatView: React.FC<HeartbeatViewProps> = ({
  attributeList,
  onRequestServiceData,
  isLoading,
  handlePublish,
  initialDataLoadedRef,
  heartbeatSentRef,
}) => {
  const { t } = useI18n();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState<number>(0);

  const extractMetrics = (): Metric[] => {
    const metrics: Metric[] = [];
    const findChar = (serviceEnum: string, charName: string) => {
      const service = attributeList.find((s) => s.serviceNameEnum === serviceEnum);
      if (!service) return null;
      return service.characteristicList.find((c: any) => c.name === charName);
    };

    const opid = findChar('ATT_SERVICE', 'opid');
    if (opid) {
      metrics.push({
        service: 'ATT',
        name: 'opid',
        description: t(opid.desc) || t('heartbeat.metric.opid.desc'),
        value: opid.realVal ?? t('common.na'),
      });
    }

    const ppid = findChar('ATT_SERVICE', 'ppid');
    if (ppid) {
      metrics.push({
        service: 'ATT',
        name: 'ppid',
        description: t(ppid.desc) || t('heartbeat.metric.ppid.desc'),
        value: ppid.realVal ?? t('common.na'),
      });
    }

    const pubk = findChar('CMD_SERVICE', 'pubk');
    if (pubk) {
      metrics.push({
        service: 'CMD',
        name: 'pubk',
        description: t(pubk.desc) || t('heartbeat.metric.pubk.desc'),
        value: pubk.realVal ?? t('common.na'),
      });
    }

    const rcrd = findChar('STS_SERVICE', 'rcrd');
    if (rcrd) {
      metrics.push({
        service: 'STS',
        name: 'rcrd',
        description: t(rcrd.desc) || t('heartbeat.metric.rcrd.desc'),
        value: rcrd.realVal ?? t('common.na'),
      });
    }

    const pgst = findChar('STS_SERVICE', 'pgst');
    if (pgst) {
      metrics.push({
        service: 'STS',
        name: 'pgst',
        description: t(pgst.desc) || t('heartbeat.metric.pgst.desc'),
        value: pgst.realVal ?? t('common.na'),
      });
    }

    const tpgd = findChar('STS_SERVICE', 'tpgd');
    if (tpgd) {
      metrics.push({
        service: 'STS',
        name: 'tpgd',
        description: t(tpgd.desc) || t('heartbeat.metric.tpgd.desc'),
        value: tpgd.realVal ?? t('common.na'),
      });
    }

    return metrics;
  };

  const metrics = extractMetrics();

  const handlePublishHeartbeat = () => {
    if (!handlePublish || heartbeatSentRef.current) {
      return;
    }

    const heartbeatData = metrics.reduce((acc: any, metric: Metric) => {
      acc[metric.name] = metric.value;
      return acc;
    }, {});

    if (Object.keys(heartbeatData).length === 0) {
      return;
    }

    const formattedAttributeList = [
      {
        serviceNameEnum: 'HEARTBEAT',
        characteristicList: Object.entries(heartbeatData).map(([name, value]) => ({
          name,
          realVal: value,
        })),
      },
      ...attributeList.filter((s) => s.serviceNameEnum === 'ATT_SERVICE'),
    ];

    handlePublish(formattedAttributeList, 'HEARTBEAT');
    heartbeatSentRef.current = true;
    // toast.success(t('heartbeat.publishSuccess'));
  };

  // Initial data load or manual refresh effect
  useEffect(() => {
    if (!initialDataLoadedRef.current || manualRefresh > 0) {
      refreshAllServices();
      initialDataLoadedRef.current = true;
    }
  }, [manualRefresh]);

  // Publish heartbeat after data is fetched
  useEffect(() => {
    if (
      attributeList.length > 0 &&
      !isLoading &&
      !heartbeatSentRef.current &&
      handlePublish &&
      initialDataLoadedRef.current
    ) {
      handlePublishHeartbeat();
    }
  }, [isLoading, manualRefresh]);

  const refreshAllServices = async () => {
    try {
      setError(null);
      await Promise.all([
        onRequestServiceData('ATT'),
        onRequestServiceData('CMD'),
        onRequestServiceData('STS'),
        onRequestServiceData('HEARTBEAT'),
      ]);
      setLastUpdated(new Date());
    } catch (err) {
      setError(t('heartbeat.error.refreshFailed'));
      toast.error(t('heartbeat.error.refreshFailed'));
    }
  };

  const handleManualRefresh = () => {
    heartbeatSentRef.current = false;
    setManualRefresh((prev) => prev + 1);
  };

  const requiredServices = ['ATT_SERVICE', 'CMD_SERVICE', 'STS_SERVICE'];
  const missingServices = requiredServices.filter(
    (s) => !attributeList.some((a) => a.serviceNameEnum === s)
  );

  if (missingServices.length > 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p className="mb-4">
          {t('heartbeat.missingServices', { services: missingServices.join(', ') })}
        </p>
        <button
          onClick={handleManualRefresh}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors disabled:bg-gray-600"
          disabled={isLoading}
          aria-label={t('heartbeat.loadRequired')}
        >
          {isLoading ? t('heartbeat.loading') : t('heartbeat.loadRequiredButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">{t('heartbeat.title')}</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleManualRefresh}
            className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors disabled:bg-gray-600"
            disabled={isLoading}
            aria-label={t('heartbeat.refreshButton')}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </div>
      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-900 rounded-lg">
          <AlertTriangle size={18} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div
            key={`${metric.service}-${metric.name}`}
            className="border border-gray-700 rounded-lg overflow-hidden"
            role="region"
            aria-label={`${metric.name} ${t('heartbeat.metric.label')}`}
          >
            <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{metric.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">{metric.service}</span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <p className="text-xs text-gray-400">{t('common.description')}</p>
                <p className="text-sm text-gray-200">{metric.description}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('ble.detail.currentValue')}</p>
                <p className="text-sm font-mono text-white">{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {metrics.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          <p>{t('heartbeat.noMetrics')}</p>
          <button
            onClick={handleManualRefresh}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
            aria-label={t('heartbeat.refreshNow')}
          >
            {t('heartbeat.refreshNow')}
          </button>
        </div>
      )}
    </div>
  );
};

export default HeartbeatView;