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
