'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, RefreshCw, Clipboard, Check } from 'lucide-react';
import { apiUrl } from '@/lib/apollo-client';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
  handlePublish,
}) => {
  const router = useRouter();
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: any }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('CMD');
  const [duration, setDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeEvents, setCodeEvents] = useState<
    { _id: string; codeDecString: string; codeHexString: string; createdAt: string; codeDays: number }[]
  >([]);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);

  const fixedTabs = [
    { id: 'CMD', label: 'CMD', serviceNameEnum: 'CMD_SERVICE' },
  ];

  useEffect(() => {
    console.log('isLoadingService:', isLoadingService);
    console.log('serviceLoadingProgress:', serviceLoadingProgress);
    console.log('attributeList:', attributeList);
    if (onRequestServiceData) {
      if (!attributeList.some((service) => service.serviceNameEnum === 'ATT_SERVICE')) {
        console.log('Fetching ATT service');
        onRequestServiceData('ATT');
      }
      if (!attributeList.some((service) => service.serviceNameEnum === 'CMD_SERVICE')) {
        console.log('Fetching CMD service');
        onRequestServiceData('CMD');
      }
    }
  }, [onRequestServiceData, attributeList]);

  const activeService = attributeList.find(
    (service) => service.serviceNameEnum === 'CMD_SERVICE'
  );

  useEffect(() => {
    const fetchItemId = async () => {
      const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
      if (!attService) {
        console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
        return;
      }

      const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
      if (!oemItemId) {
        toast.error('OEM Item ID not available', { duration: 5000 });
        return;
      }

      try {
        const authToken = localStorage.getItem('access_token');
        if (!authToken) {
          toast.error('Please sign in to fetch item data', { duration: 5000 });
          router.push('/signin');
          return;
        }

        const query = `
          query GetItemByOemItemId($oemItemId: ID!) {
            getItembyOemItemId(oemItemId: $oemItemId) {
              _id
            }
          }
        `;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            query,
            variables: { oemItemId },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
        }

        if (result.errors) {
          throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
        }

        const fetchedItemId = result.data.getItembyOemItemId._id;
        if (fetchedItemId) {
          setItemId(fetchedItemId);
          console.log('Item ID fetched successfully:', fetchedItemId);
          toast.success('Item ID fetched successfully', { duration: 3000 });
        } else {
          throw new Error('No item ID returned in response');
        }
      } catch (error) {
        console.error('Error fetching item ID:', error);
        toast.error(`Failed to fetch item data: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          duration: 5000,
        });
      }
    };

    fetchItemId();
  }, [router, attributeList]);

  useEffect(() => {
    const pairAssetAccount = async () => {
      if (!itemId) {
        console.log('Item ID not yet available, skipping pairAssetAccount');
        return;
      }

      const distributorId = localStorage.getItem('distributorId');
      const customerId = sessionStorage.getItem('customerId');
      const authToken = localStorage.getItem('access_token');

      if (!authToken) {
        toast.error('Please sign in to pair asset account', { duration: 5000 });
        router.push('/signin');
        return;
      }

      if (!distributorId) {
        toast.error('Distributor ID not found in local storage', { duration: 5000 });
        return;
      }

      if (!customerId) {
        toast.error('Customer ID not found in session storage', { duration: 5000 });
        return;
      }

      const mutation = `
        mutation PairAssetAccount {
          pairAssetAccount(pairAssetAccountInput: {
            clientId: "${distributorId}"
            userId: "61811ef2bf5a3f05f1eb5d42"
            credit: {
              balance: 0
              currency: "USD"
              customerId: "${customerId}"
            }
            itemId: "${itemId}"
          }) {
            _id
            deleteStatus
            deleteAt
            createdAt
            updatedAt
            accountStage
          }
        }
      `;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ query: mutation }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
        }

        if (result.errors) {
          throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
        }

        const pairedAccount = result.data.pairAssetAccount;
        if (pairedAccount) {
          console.log('Asset account paired successfully:', pairedAccount);
          toast.success(`Asset account paired successfully! Account ID: ${pairedAccount._id}`, {
            duration: 3000,
          });
        } else {
          throw new Error('No paired account data returned');
        }
      } catch (error) {
        console.error('Error pairing asset account:', error);
        toast.error(
          `Failed to pair asset account: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { duration: 5000 }
        );
      }
    };

    pairAssetAccount();
  }, [itemId, router]);

  const isServiceLoaded = (serviceNameEnum: string) => {
    return attributeList.some((service) => service.serviceNameEnum === serviceNameEnum);
  };

  const handleBack = () => (onBack ? onBack() : router.back());

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />
      <div className="p-4 flex items-center">
        <button onClick={handleBack} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold flex-1">Device Pairing</h1>
        <Share2 className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex flex-col items-center p-6 pb-2">
        <img
          src={device.imageUrl}
          alt={device.name || 'Device'}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold">{device.name || 'Unknown Device'}</h2>
        <p className="text-sm text-gray-400 mt-1">{device.macAddress || 'Unknown MAC'}</p>
        <p className="text-sm text-gray-400 mt-1">{device.rssi || 'Unknown RSSI'}</p>
      </div>
    </div>
  );
};

export default DeviceDetailView;
