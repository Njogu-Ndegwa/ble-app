'use client'

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface HeartbeatViewProps {
  attributeList: any[];
  onRequestServiceData: (serviceName: string) => void;
  isLoading: boolean;
  handlePublish?: (attributeList: any, serviceType: string) => void;
  initialDataLoadedRef: React.MutableRefObject<boolean>;
  heartbeatSentRef: React.MutableRefObject<boolean>; // Receive ref from parent
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
        description: opid.desc || 'Unique operator identifier',
        value: opid.realVal ?? 'N/A',
      });
    }

    const ppid = findChar('ATT_SERVICE', 'ppid');
    if (ppid) {
      metrics.push({
        service: 'ATT',
        name: 'ppid',
        description: ppid.desc || 'Product model identifier',
        value: ppid.realVal ?? 'N/A',
      });
    }

    const pubk = findChar('CMD_SERVICE', 'pubk');
    if (pubk) {
      metrics.push({
        service: 'CMD',
        name: 'pubk',
        description: pubk.desc || 'Public key for secure communication',
        value: pubk.realVal ?? 'N/A',
      });
    }

    const rcrd = findChar('STS_SERVICE', 'rcrd');
    if (rcrd) {
      metrics.push({
        service: 'STS',
        name: 'rcrd',
        description: rcrd.desc || 'Device record or log status',
        value: rcrd.realVal ?? 'N/A',
      });
    }

    const pgst = findChar('STS_SERVICE', 'pgst');
    if (pgst) {
      metrics.push({
        service: 'STS',
        name: 'pgst',
        description: pgst.desc || 'Grid connection status',
        value: pgst.realVal ?? 'N/A',
      });
    }

    const tpgd = findChar('STS_SERVICE', 'tpgd');
    if (tpgd) {
      metrics.push({
        service: 'STS',
        name: 'tpgd',
        description: tpgd.desc || 'Safety or limit indicator',
        value: tpgd.realVal ?? 'N/A',
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
    // toast.success('Heartbeat data sent');
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
  }, [isLoading, manualRefresh]); // Removed attributeList from dependencies

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
      setError('Failed to refresh services');
      toast.error('Failed to refresh heartbeat data');
    }
  };

  const handleManualRefresh = () => {
    heartbeatSentRef.current = false; // Allow re-publishing
    setManualRefresh((prev) => prev + 1); // Trigger refresh
  };

  const requiredServices = ['ATT_SERVICE', 'CMD_SERVICE', 'STS_SERVICE'];
  const missingServices = requiredServices.filter(
    (s) => !attributeList.some((a) => a.serviceNameEnum === s)
  );

  if (missingServices.length > 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p className="mb-4">Required services ({missingServices.join(', ')}) not loaded</p>
        <button
          onClick={handleManualRefresh}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors disabled:bg-gray-600"
          disabled={isLoading}
          aria-label="Load required services"
        >
          {isLoading ? 'Loading...' : 'Load Required Services'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">Device Heartbeat</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleManualRefresh}
            className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors disabled:bg-gray-600"
            disabled={isLoading}
            aria-label="Refresh heartbeat data"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
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
            aria-label={`${metric.name} metric`}
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
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm text-gray-200">{metric.description}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Current Value</p>
                <p className="text-sm font-mono text-white">{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {metrics.length === 0 && (
        <div className="text-center p-8 text-gray-400">
          <p>No heartbeat metrics available.</p>
          <button
            onClick={handleManualRefresh}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white text-sm transition-colors"
            aria-label="Refresh metrics"
          >
            Refresh Now
          </button>
        </div>
      )}
    </div>
  );
};

export default HeartbeatView;