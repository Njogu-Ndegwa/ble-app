import React from 'react';
import { CharacteristicCard } from '@/components/CharacteristicCard';

interface ServiceContentProps {
  activeService: any;
  activeTab: string;
  updatedValues: { [key: string]: any };
  loadingStates: { [key: string]: boolean };
  handleRead: (serviceUuid: string, characteristicUuid: string, name: string) => void;
  handleWriteClick: (characteristic: any) => void;
}

export const ServiceContent: React.FC<ServiceContentProps> = ({
  activeService,
  activeTab,
  updatedValues,
  loadingStates,
  handleRead,
  handleWriteClick
}) => {
  if (!activeService) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>No data available for this service</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeService.characteristicList.map((char: any) => (
        <CharacteristicCard
          key={char.uuid}
          characteristic={char}
          serviceUuid={activeService.uuid}
          updatedValues={updatedValues}
          loadingStates={loadingStates}
          handleRead={handleRead}
          handleWriteClick={handleWriteClick}
          showWriteButton={activeTab === 'CMD'}
        />
      ))}
    </div>
  );
};

export default ServiceContent;
