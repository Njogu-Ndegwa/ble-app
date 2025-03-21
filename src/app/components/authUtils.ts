// 'use client'

// import { jwtDecode } from 'jwt-decode';

// interface DecodedToken {
//   exp: number;
//   user_id?: string;
//   email?: string;
//   // Add other claims as needed
// }

// /**
//  * Check if a JWT token is valid and not expired
//  * @param token The JWT token to validate
//  * @returns boolean indicating if the token is valid
//  */
// export const isTokenValid = (token: string): boolean => {
//   if (!token) return false;
  
//   try {
//     const decoded = jwtDecode<DecodedToken>(token);
//     const currentTime = Math.floor(Date.now() / 1000);
    
//     // Check if token is expired
//     if (decoded.exp < currentTime) {
//       console.log('Token expired');
//       return false;
//     }
    
//     return true;
//   } catch (error) {
//     console.error('Invalid token:', error);
//     return false;
//   }
// };

// /**
//  * Get user data from the token
//  * @param token The JWT token
//  * @returns The decoded user data or null if invalid
//  */
// export const getUserFromToken = (token: string): DecodedToken | null => {
//   if (!token) return null;
  
//   try {
//     return jwtDecode<DecodedToken>(token);
//   } catch (error) {
//     console.error('Error decoding token:', error);
//     return null;
//   }
// };

// /**
//  * Logout the user by removing authentication data
//  */
// export const logout = (): void => {
//   localStorage.removeItem('auth_token');
//   localStorage.removeItem('user_data');
  
//   // Redirect to login page
//   window.location.href = '/login';
// };

// /**
//  * Check authentication status and redirect if needed
//  * @param router The Next.js router instance
//  */
// export const checkAuth = (): boolean => {
//   if (typeof window === 'undefined') {
//     return false; // We're on the server
//   }
  
//   const token = localStorage.getItem('auth_token');
  
//   if (!token || !isTokenValid(token)) {
//     return false;
//   }
  
//   return true;
// };

// /**
//  * Handle API responses with expired tokens
//  * @param response The fetch API response
//  * @returns boolean indicating if the token was invalid and user was logged out
//  */
// export const handleAuthResponse = (response: Response): boolean => {
//   if (response.status === 401) {
//     // Token is invalid or expired
//     logout();
//     return true;
//   }
//   return false;
// };

// /**
//  * Add auth header to fetch requests
//  * @returns Headers object with Authorization token
//  */
// export const getAuthHeaders = (): HeadersInit => {
//   const token = localStorage.getItem('auth_token');
//   return {
//     'Content-Type': 'application/json',
//     Authorization: token ? `Bearer ${token}` : '',
//   };
// };


'use client'

import { jwtDecode } from 'jwt-decode';
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Define types
interface DecodedToken {
  exp: number;
  user_id?: string;
  email?: string;
  // Add other claims as needed
}

// GraphQL Fragments and Mutations
export const AUTH_TOKEN_FRAGMENT = gql`
  fragment AuthToken on AuthToken {
    _id
    accessToken
    actionScope
    agentId
    agentType
    authenticationInstance {
      _id
      name
      __typename
    }
    birthDate
    createdAt
    deleteAt
    deleteStatus
    email
    firstName
    hireDate
    idString
    idType
    lastName
    name
    officeAddress {
      _id
      city
      country
      createdAt
      deleteAt
      deleteStatus
      postcode
      srpc
      street
      unit
      updatedAt
      __typename
    }
    profile
    role {
      _id
      name
      __typename
    }
    roleName
    subrole {
      _id
      name
      __typename
    }
    type
    updatedAt
    __typename
  }
`;

export const SIGN_IN_MUTATION = gql`
  ${AUTH_TOKEN_FRAGMENT}
  mutation SignInLoginUser($signInCredentials: SignInCredentialsDto!) {
    signInUser(signInCredentials: $signInCredentials) {
      ...AuthToken
      __typename
    }
  }
`;

// Create an HTTP link for our GraphQL API
const httpLink = createHttpLink({
  uri: 'https://dev-federated-graphql-api.omnivoltaic.com/graphql',
});

// Auth link to add token to requests
const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage if it exists
  const token = localStorage.getItem('auth_token');
  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Apollo Client
export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

/**
 * Check if a JWT token is valid and not expired
 * @param token The JWT token to validate
 * @returns boolean indicating if the token is valid
 */
export const isTokenValid = (token: string): boolean => {
  if (!token) return false;
  
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (decoded.exp < currentTime) {
      console.log('Token expired');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Invalid token:', error);
    return false;
  }
};

/**
 * Get user data from the token
 * @param token The JWT token
 * @returns The decoded user data or null if invalid
 */
export const getUserFromToken = (token: string): DecodedToken | null => {
  if (!token) return null;
  
  try {
    return jwtDecode<DecodedToken>(token);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Logout the user by removing authentication data
 */
export const logout = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_data');
  
  // Redirect to login page
  window.location.href = '/login';
};

/**
 * Check authentication status
 * @returns boolean indicating if user is authenticated
 */
export const checkAuth = (): boolean => {
  if (typeof window === 'undefined') {
    return false; // We're on the server
  }
  
  const token = localStorage.getItem('auth_token');
  
  if (!token || !isTokenValid(token)) {
    return false;
  }
  
  return true;
};

/**
 * Handle API responses with expired tokens
 * @param response The fetch API response
 * @returns boolean indicating if the token was invalid and user was logged out
 */
export const handleAuthResponse = (response: Response): boolean => {
  if (response.status === 401) {
    // Token is invalid or expired
    logout();
    return true;
  }
  return false;
};

/**
 * Add auth header to fetch requests
 * @returns Headers object with Authorization token
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
};

/**
 * Login user with GraphQL
 * @param email User email
 * @param password User password
 * @returns Object with success flag and data or error
 */
export const loginWithGraphQL = async (email: string, password: string) => {
  try {
    const { data } = await client.mutate({
      mutation: SIGN_IN_MUTATION,
      variables: {
        signInCredentials: {
          email,
          password
        }
      }
    });
    
    // If we get here, the login was successful
    return {
      success: true,
      data: data.signInUser
    };
  } catch (error: any) {
    console.error('GraphQL login error:', error);
    return {
      success: false,
      error: error.message || 'Login failed. Please check your credentials.'
    };
  }
};