import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { getSalesRoleToken } from '@/lib/attendant-auth';
import { getSAIdForHeaders } from '@/lib/sa-auth';

const PORTAL_GRAPHQL_URL = 'https://dirac-fed-dev.omnivoltaic.com/odoo-portal';

const httpLink = createHttpLink({
  uri: PORTAL_GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = getSalesRoleToken();
  const saId = getSAIdForHeaders('sales');

  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(saId ? { 'x-sa-id': saId } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (networkError) {
    console.error('[Portal GraphQL] Network error:', {
      operation: operation.operationName,
      message: networkError.message,
    });
  }
  if (graphQLErrors) {
    graphQLErrors.forEach((err) => {
      console.error('[Portal GraphQL] GraphQL error:', {
        operation: operation.operationName,
        message: err.message,
        path: err.path,
      });
    });
  }
});

export const portalApolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
