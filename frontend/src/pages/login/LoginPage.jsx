// Add this function to your login handler where you handle Google sign-in

// After successful Google sign-in through Firebase:
const handleGoogleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Get the Google access token
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const idToken = await result.user.getIdToken();
    
    // If we got a token, set it for Calendar and Gmail
    if (token) {
      try {
        // Set up Calendar with the Google token
        await api.post('/api/calendar/set-google-token', {
          googleToken: {
            access_token: token,
            id_token: idToken
          },
          userInfo: {
            sub: result.user.uid,
            email: result.user.email,
            name: result.user.displayName
          }
        });
        
        // Also set up Gmail with the same token
        await api.post('/api/gmail/set-gmail-token', {
          googleToken: {
            access_token: token,
            id_token: idToken
          },
          userInfo: {
            sub: result.user.uid,
            email: result.user.email,
            name: result.user.displayName
          }
        });
        
        console.log('Google services set up successfully');
      } catch (error) {
        console.error('Error setting up Google services:', error);
      }
    }
    
    // Continue with normal login flow...
  } catch (error) {
    console.error('Google login error:', error);
  }
};
