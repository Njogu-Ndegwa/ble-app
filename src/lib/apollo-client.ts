import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

// Determine the API URL based on the current location
const isWvApp = typeof window !== "undefined" && window.location.origin === "https://wvapp.omnivoltaic.com";
const apiUrl = isWvApp
  ? "https://federated-graphql-api.omnivoltaic.com/graphql"
  : "https://dev-federated-graphql-api.omnivoltaic.com/graphql";

const httpLink = createHttpLink({
  uri: apiUrl,
});

const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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
// import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
// import { setContext } from "@apollo/client/link/context";

// let url = "https://dev-federated-graphql-api.omnivoltaic.com/graphql";

// if (process.env.NODE_ENV === "production"){
//   url = "https://federated-graphql-api.omnivoltaic.com/graphql";
// }

// const httpLink = createHttpLink({
//   uri: url,
// });

// const authLink = setContext((_, { headers }) => {
//   // Get the authentication token from local storage or wherever it's stored
//   const token = localStorage.getItem("access_token");
//   return {
//     headers: {
//       ...headers,
//       authorization: token ? `Bearer ${token}` : "",
//     },
//   };
// });

// const apolloClient = new ApolloClient({
//   link: authLink.concat(httpLink),
//   cache: new InMemoryCache(),
// });

// export default apolloClient;

