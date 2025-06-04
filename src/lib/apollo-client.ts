import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Observable } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { REFRESH_TOKEN } from "@/app/(auth)/mutations";

// Determine the API URL based on the current location
const isWvApp = typeof window !== "undefined" && window.location.origin === "https://wvapp.omnivoltaic.com";
export const apiUrl = isWvApp
  ? "https://federated-graphql-api.omnivoltaic.com/graphql"
  : "https://dev-federated-graphql-api.omnivoltaic.com/graphql";

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
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("distributorId");
              window.location.href = "/signin";
              observer.error(error);
            });
        });
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("distributorId");
        window.location.href = "/signin";
      }
    }
  }
  return forward(operation);
});

const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default apolloClient;