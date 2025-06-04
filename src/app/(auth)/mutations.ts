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
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;