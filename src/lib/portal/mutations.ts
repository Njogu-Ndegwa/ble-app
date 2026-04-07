import { gql } from '@apollo/client';

export const UPDATE_PRODUCT_UNIT = gql`
  mutation UpdateProductUnit($id: ID!, $input: UpdateProductUnitInput!) {
    updateProductUnit(id: $id, input: $input) {
      success
      message
      productUnit {
        id
        name
        sku
        listPrice
        type
        puCategory
        puMetric
        serviceType
        contractType
        categoryName
        companyId
        companyName
        currencyName
        recurringInvoice
        saleOk
        active
        imageUrl
        description
        descriptionSale
        createdAt
        updatedAt
      }
    }
  }
`;

export const DELETE_PRODUCT_UNIT = gql`
  mutation DeleteProductUnit($id: ID!) {
    deleteProductUnit(id: $id) {
      success
      message
    }
  }
`;
