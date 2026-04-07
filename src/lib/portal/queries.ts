import { gql } from '@apollo/client';

export const PRODUCT_UNITS_QUERY = gql`
  query ProductUnits($filters: ProductUnitsFilterInput) {
    productUnits(filters: $filters) {
      data {
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
      pagination {
        currentPage
        perPage
        totalRecords
        totalPages
        hasNextPage
        hasPreviousPage
        nextPage
        previousPage
      }
    }
  }
`;

export const PRODUCT_UNIT_QUERY = gql`
  query ProductUnit($id: ID!) {
    productUnit(id: $id) {
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
`;
