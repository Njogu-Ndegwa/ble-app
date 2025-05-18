import { gql } from "@apollo/client";

export const SIGN_IN_USER = gql`
  mutation SignInUser($signInCredentials: SignInCredentialsDto!) {
    signInUser(signInCredentials: $signInCredentials) {
      email
      accessToken
      name
      _id
    }
  }
`;