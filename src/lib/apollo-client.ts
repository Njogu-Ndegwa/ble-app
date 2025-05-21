import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

let url = "https://dev-federated-graphql-api.omnivoltaic.com/graphql";

if (process.env.NODE_ENV === "production"){
  url = "https://federated-graphql-api.omnivoltaic.com/graphql";
}

const httpLink = createHttpLink({
  uri: url,
});

const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage or wherever it's stored
  const token = localStorage.getItem("access_token");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default apolloClient;

