/**
 * GraphQL operations for OTA firmware (federated ERM API).
 *
 * Field shapes verified against the dev federated schema by introspection:
 * - getAllItemFirmwares(first/search/filters) → page.edges[].node: ItemFirmware
 * - getFileObjectsForFirmwareVersion(version!) → [S3FileObject!]! with S3 downloadUrl
 *
 * Firmware files must be fetched over the S3 presigned HTTPS downloadUrl —
 * the WebView cannot load ftp:// URLs (Chrome removed FTP support in v95).
 *
 * Usage:
 * ```typescript
 * import apolloClient from '@/lib/apollo-client';
 * import { GET_ALL_ITEM_FIRMWARES, GET_FILE_OBJECTS_FOR_FIRMWARE_VERSION } from '@/lib/graphql/firmware';
 * ```
 */

import { gql } from '@apollo/client';

/**
 * Telink secure-OTA key ("secretKey" in the legacy native handler).
 *
 * The VCU firmware requires this key handshake before it will act on the
 * OTA-start command — verified on-device 2026-07-17: without a key the device
 * connects, accepts the 0x0102 start command, but never reboots into OTA mode
 * (transfer stalls at 0%). The legacy oves-app frontend supplied this per-flash
 * as `secretKey`; the value is a firmware secret held by R&D.
 *
 * The native `startOtaUpdate` handler now reads this and calls
 * OTASDKUtils.setOtaKey(...), so changing this value is a web-only redeploy —
 * no APK rebuild needed. TODO(esther/bob): set the real E-3P VCU OTA key here.
 */
export const OTA_SECRET_KEY = "";

export interface ItemFirmware {
  _id: string;
  version: string;
  actorName: string;
  codeSystem: string;
  description?: string | null;
  profile?: string | null;
  createdAt?: string | null;
}

export interface S3FileObject {
  filename: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
}

export const GET_ALL_ITEM_FIRMWARES = gql`
  query GetAllItemFirmwares($first: Int, $search: String) {
    getAllItemFirmwares(first: $first, search: $search) {
      page {
        edges {
          node {
            _id
            version
            actorName
            codeSystem
            description
            createdAt
          }
        }
      }
    }
  }
`;

export const GET_FILE_OBJECTS_FOR_FIRMWARE_VERSION = gql`
  query GetFileObjectsForFirmwareVersion($version: String!) {
    getFileObjectsForFirmwareVersion(version: $version) {
      filename
      size
      lastModified
      downloadUrl
    }
  }
`;

/**
 * Device avatar snapshot + GATT metadata, keyed by the device's OEM item id
 * (the `opid` characteristic read over BLE). `gatt_meta` is the DeviceGatt
 * document; its `firmware` field names the firmware family this device runs —
 * the link used to match catalog entries to a physical device.
 */
export const GET_DEVICE_SNAPSHOT_WITH_GATT_META = gql`
  query GetDeviceSnapshotWithGattMeta($oemItemId: String!) {
    getDeviceSnapshotWithGattMeta(oemItemId: $oemItemId) {
      snapshot {
        device_id
        fields
      }
      gatt_meta
    }
  }
`;
