// import { gql } from "@apollo/client";

// export const SIGN_IN_USER = gql`
//   mutation SignInUser($signInCredentials: SignInCredentialsDto!) {
//     signInUser(signInCredentials: $signInCredentials) {
//       email
//       accessToken
//       name
//       _id
//     }
//   }
// `;

//Refresh token
import { gql } from "@apollo/client";

export const SIGN_IN_USER = gql`
  mutation SignInUser($signInCredentials: SignInCredentialsDto!) {
    signInUser(signInCredentials: $signInCredentials) {
      email
      accessToken
      refreshToken
      name
      _id
    }
  }
`;


export const REFRESH_TOKEN = gql`
  mutation RefreshClientAccessToken($refreshToken: String!) {
    refreshClientAccessToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const GET_ITEM_BY_OEM_ITEM_ID = gql`
  query GetItemByOemItemId($oemItemId: ID!) {
    getItemByOemItemId(oemItemId: $oemItemId) {
      _id
    }
  }
`;