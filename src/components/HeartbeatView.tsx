'use client'

import React, { useState, useEffect, JSX } from 'react';
import { RefreshCw, AlertTriangle, Cpu, Heart, Gauge, Zap, Battery, Thermometer, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface HeartbeatViewProps {
  attributeList: any[];
  onRequestServiceData: (serviceName: string) => void;
  isLoading: boolean;
  handlePublish?: (attributeList: any, serviceType: string) => void;
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
}) => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heartbeatSent, setHeartbeatSent] = useState<boolean>(false);


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

    // CMD: Public Key
    const pubk = findChar('CMD_SERVICE', 'pubk');
    if (pubk) {
      metrics.push({
        service: 'CMD',
        name: 'pubk',
        description: pubk.desc || 'Public key for secure communication',
        value: pubk.realVal ?? 'N/A',
      });
    }

    // STS: Record, Power Grid Status, Top Guard
    const rcrd = findChar('STS_SERVICE', 'rcrd');
    if (rcrd) {
      const value = rcrd.realVal ?? null;
      metrics.push({
        service: 'STS',
        name: 'rcrd',
        description: rcrd.desc || 'Device record or log status',
        value: value !== null ? value : 'N/A',
      });
    }

    const pgst = findChar('STS_SERVICE', 'pgst');
    if (pgst) {
      const value = pgst.realVal ?? null;
      metrics.push({
        service: 'STS',
        name: 'pgst',
        description: pgst.desc || 'Grid connection status',
        value: value !== null ? value : 'N/A',
      });
    }

    const tpgd = findChar('STS_SERVICE', 'tpgd');
    if (tpgd) {
      const value = tpgd.realVal ?? null;
      metrics.push({
        service: 'STS',
        name: 'tpgd',
        description: tpgd.desc || 'Safety or limit indicator',
        value: value !== null ? value : 'N/A',
      });
    }

    return metrics;
  };

  const metrics = extractMetrics();

  const handlePublishHeartbeat = () => {
    if (!handlePublish || heartbeatSent) {
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
    setHeartbeatSent(true);
    // toast.success('Heartbeat data sent');
  };

  useEffect(() => {
    // Initial refresh when component mounts
    refreshAllServices();
  }, []);

  // Effect to send heartbeat once when data is first loaded
  useEffect(() => {
    if (metrics.length > 0 && !heartbeatSent && handlePublish) {
      handlePublishHeartbeat();
    }
  }, [metrics.length, heartbeatSent]);


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
    // Reset the heartbeatSent flag to allow re-publishing heartbeat data
    setHeartbeatSent(false);
    refreshAllServices();
  };

  // const formatLastUpdated = () => {
  //   if (!lastUpdated) return 'Never updated';
  //   const now = new Date();
  //   const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
  //   if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  //   if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  //   return lastUpdated.toLocaleTimeString();
  // };

  const requiredServices = ['ATT_SERVICE', 'CMD_SERVICE', 'STS_SERVICE'];
  const missingServices = requiredServices.filter(
    (serviceEnum) => !attributeList.some((s) => s.serviceNameEnum === serviceEnum)
  );

  if (missingServices.length > 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p className="mb-4">Required services ({missingServices.join(', ')}) not loaded</p>
        <button
          onClick={refreshAllServices}
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
          {/* <p className="text-xs text-gray-400">
            Last updated: {formatLastUpdated()}
          </p> */}
          {/* {heartbeatSent && (
            <p className="text-xs text-green-400">Heartbeat data already sent</p>
          )} */}
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
          {!heartbeatSent && handlePublish && (
            <button
              onClick={handlePublishHeartbeat}
              className="flex items-center space-x-1 bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm transition-colors disabled:bg-gray-600"
              disabled={isLoading || metrics.length === 0}
              aria-label="Send heartbeat data"
            >
              <Heart size={14} />
              <span>Send Heartbeat</span>
            </button>
          )}
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
            {/* Header area similar to the example code */}
            <div className="flex justify-between items-center bg-gray-800 px-4 py-2">
              <div className="flex items-center space-x-2">
                
                <span className="text-sm font-medium">{metric.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">{metric.service}</span>
              </div>
            </div>
            {/* Content area */}
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