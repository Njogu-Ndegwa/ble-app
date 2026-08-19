interface AccountControlState {
  hasSession: boolean;
  hasSelectedSA: boolean;
  hasSignInAction: boolean;
}

export function getAccountControlVisibility({
  hasSession,
  hasSelectedSA,
  hasSignInAction,
}: AccountControlState) {
  const showAccountControls = hasSession && !hasSignInAction;

  return {
    showWorkspace: showAccountControls && hasSelectedSA,
    showAvatar: showAccountControls,
  };
}
