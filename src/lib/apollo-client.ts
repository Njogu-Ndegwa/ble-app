import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Observable } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { REFRESH_TOKEN } from "@/app/(auth)/mutations";

// Determine the API URL based on the current location
const isWvApp = typeof window !== "undefined" && window.location.origin === "https://wvapp.omnivoltaic.com";

// Federated GraphQL API - for ERM/Thing microservices (BLE Device Manager, etc.)
export const apiUrl = isWvApp
  ? "https://federated-graphql-api.omnivoltaic.com/graphql"
  : "https://dev-federated-graphql-api.omnivoltaic.com/graphql";

// ABS Platform GraphQL API - for Attendant & Sales workflows (customer identification, payment/service)
export const absApiUrl = "https://abs-platform-dev.omnivoltaic.com/graphql";

const httpLink = createHttpLink({
  uri: apiUrl,
});

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors || networkError) {
    // Handle unauthenticated errors
    if (
      graphQLErrors?.some((err) => err.extensions?.code === "UNAUTHENTICATED") ||
      (networkError && "statusCode" in networkError && networkError.statusCode === 401)
    ) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        return new Observable((observer) => {
          apolloClient
            .mutate({
              mutation: REFRESH_TOKEN,
              variables: { refreshToken },
            })
            .then(({ data }) => {
              const { accessToken, refreshToken: newRefreshToken } = data.refreshToken;
              localStorage.setItem("access_token", accessToken);
              localStorage.setItem("refresh_token", newRefreshToken);
              operation.setContext(({ headers = {} }) => ({
                headers: {
                  ...headers,
                  authorization: `Bearer ${accessToken}`,
                },
              }));
              forward(operation).subscribe({
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer),
              });
            })
            .catch((error) => {
              handleLogout();
              observer.error(error);
            });
        });
      } else {
        handleLogout();
      }
    }
  }
  return forward(operation);
});

const handleLogout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("distributorId");
  window.location.href = "/signin";
};

const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

// ABS Platform Apollo Client - for Attendant & Sales workflows (no auth required)
const absHttpLink = createHttpLink({
  uri: absApiUrl,
});

// Error handling for ABS Apollo Client
// Catches network errors and provides better error messages
const absErrorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (networkError) {
    // Log network errors with context
    console.error('[ABS GraphQL] Network error:', {
      operation: operation.operationName,
      message: networkError.message,
      // Include additional details if available
      ...(networkError.name && { name: networkError.name }),
    });
    
    // The error will still propagate, but now it's logged with context
    // The calling code (useCustomerIdentification, etc.) handles the actual user-facing message
  }
  
  if (graphQLErrors) {
    graphQLErrors.forEach((err) => {
      console.error('[ABS GraphQL] GraphQL error:', {
        operation: operation.operationName,
        message: err.message,
        path: err.path,
        extensions: err.extensions,
      });
    });
  }
});

export const absApolloClient = new ApolloClient({
  link: ApolloLink.from([absErrorLink, absHttpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    mutate: {
      // Don't throw on errors - let the caller handle them gracefully
      errorPolicy: 'all',
    },
    query: {
      // Don't throw on errors - let the caller handle them gracefully  
      errorPolicy: 'all',
      // Fetch from network, don't use cache for stale data
      fetchPolicy: 'network-only',
    },
  },
});

export default apolloClient;