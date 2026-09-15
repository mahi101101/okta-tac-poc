import React, { useState } from 'react';
import { useOktaAuth } from '@okta/okta-react';

const Login = () => {
  const { oktaAuth } = useOktaAuth();
  
  // Track where the user is in the custom flow
  const [step, setStep] = useState('identify'); // 'identify', 'challenge-password', 'challenge-tac'
  
  // Form state
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- 1. The Intercept and Start Transaction ---
  const handleIdentifySubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("[DEBUG 1] Fetching backend intelligence for:", email);
      const response = await fetch('http://localhost:3001/api/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const { hasTac } = await response.json();
      console.log("[DEBUG 2] Proxy returned hasTac:", hasTac);

      console.log("[DEBUG 3] Executing oktaAuth.idx.startTransaction...");
      let transaction = await oktaAuth.idx.startTransaction();
      console.log("[DEBUG 3.5] Initial transaction step:", transaction.nextStep?.name);

      console.log("[DEBUG 3.8] Pushing email to the explicit 'identify' step...");
      transaction = await oktaAuth.idx.proceed({ 
        step: 'identify',  
        username: email 
      });
      console.log("[DEBUG 4] Identify Success. Current Step:", transaction.nextStep?.name);

      if (transaction.nextStep && transaction.nextStep.name === 'select-authenticator-authenticate') {
        const authInput = transaction.nextStep.inputs?.find(i => i.name === 'authenticator');
        console.log("[DEBUG 5] Available Authenticators:", authInput?.options);
        
        if (authInput && authInput.options) {
          let selectedAuth;

          if (hasTac) {
            selectedAuth = authInput.options.find(opt => opt.relatesTo?.key === 'tac');
          } else {
            selectedAuth = authInput.options.find(opt => opt.relatesTo?.key === 'okta_password');
          }

          console.log("[DEBUG 6] Auto-selected Authenticator:", selectedAuth);

          if (selectedAuth) {
             console.log("[DEBUG 7] Executing oktaAuth.idx.proceed with bypass...");
             
             // Extract the actual ID and methodType from Okta's array structure
             const authId = selectedAuth.value.find(v => v.name === 'id')?.value;
             const methodType = selectedAuth.value.find(v => v.name === 'methodType')?.value;

             // Pass it back to the state machine as a clean object
             transaction = await oktaAuth.idx.proceed({ 
               step: 'select-authenticator-authenticate',
               authenticator: {
                 id: authId,
                 methodType: methodType
               }
             });
             
             console.log("[DEBUG 8] Proceed Success. New Step:", transaction.nextStep?.name);
          }
        } // <-- Restored missing brace
      } // <-- Restored missing brace

      console.log("[DEBUG 9] Final UI Routing Evaluation:", transaction.nextStep?.name);
      
      if (transaction.nextStep?.name === 'challenge-authenticator') {
        if (hasTac) {
          setStep('challenge-tac');
        } else {
          setStep('challenge-password');
        }
      } else {
        console.warn("[DEBUG 10] Unhandled routing state.");
        setError(`Unexpected flow state: ${transaction.nextStep?.name}`);
      }

    } catch (err) {
      console.error('[CRITICAL DEBUG] Error caught:', err);
      setError('Failed to initialize login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

// --- 2. The Credential Submission ---
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log(`[DEBUG 11] Submitting credential for ${step}`);
      
      let payload;
      if (step === 'challenge-tac') {
        payload = { step: 'challenge-authenticator', credentials: { passcode: credential } };
      } else {
        payload = { step: 'challenge-authenticator', password: credential };
      }

      const transaction = await oktaAuth.idx.proceed(payload);
      console.log("[DEBUG 12] Challenge response:", transaction);

      // 1. GLOBAL ERROR HANDLER (UPDATED)
      if (transaction.messages && transaction.messages.length > 0) {
        const apiError = transaction.messages[0].message;
        console.warn("[DEBUG 12.5] API Error:", apiError);
        setError(apiError); 
        
        // Stop execution here so the user can fix their typo!
        setIsLoading(false);
        return; 
      }

      // 2. SUCCESS STATE
      if (transaction.status === 'SUCCESS') {
        console.log("[DEBUG 13] LOGIN SUCCESS! Redirecting to app...");
        oktaAuth.handleLoginRedirect(transaction.tokens);
        return;
      }

      // 3. ROUTING STATES
      if (transaction.status === 'TERMINAL') {
         setError('Login rejected by security policy.');
      } else if (transaction.nextStep?.name === 'select-authenticator-enroll') {
         
         console.log("[DEBUG 13] TAC accepted! Auto-selecting password for enrollment...");
         
         // Auto-select the Password factor in the background so the user doesn't have to
         const authInput = transaction.nextStep.inputs?.find(i => i.name === 'authenticator');
         const pwdAuth = authInput?.options?.find(opt => opt.relatesTo?.key === 'okta_password');
         
         if (pwdAuth) {
           const authId = pwdAuth.value.find(v => v.name === 'id')?.value;
           const methodType = pwdAuth.value.find(v => v.name === 'methodType')?.value;
           
           const enrollTx = await oktaAuth.idx.proceed({
             step: 'select-authenticator-enroll',
             authenticator: { id: authId, methodType: methodType }
           });
           
           console.log("[DEBUG 13.5] Ready for new password:", enrollTx.nextStep?.name);
           setStep('enroll-password'); 
           setCredential(''); // Clear the input field for the new password
         } else {
           setError('Password enrollment not available for this user.');
         }

      } else if (transaction.nextStep?.name === 'select-authenticator-authenticate') {
         setError('Additional MFA required (UI not yet implemented).');
      } else {
         console.log("[DEBUG 13] Unhandled state:", transaction);
         setError(`Unexpected step requested: ${transaction.nextStep?.name}`);
      }

    } catch (err) {
      console.error('[CRITICAL DEBUG] Error during credential submission:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

// --- 3. The Password Setup Submission ---
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("[DEBUG 14] Submitting new permanent password...");
      
      // FIX: Use the flat 'password' key so the SDK's auto-mapper recognizes it
      const transaction = await oktaAuth.idx.proceed({ 
        step: 'enroll-authenticator',
        password: credential 
      });

      console.log("[DEBUG 15] Enrollment response:", transaction);

      if (transaction.messages && transaction.messages.length > 0) {
        setError(transaction.messages[0].message);
        setIsLoading(false);
        return;
      }

     if (transaction.status === 'SUCCESS') {
        console.log("[DEBUG 16] PASSWORD SET SUCCESS! Redirecting to app...");
        oktaAuth.handleLoginRedirect(transaction.tokens);
      } else if (transaction.nextStep?.name === 'select-authenticator-enroll') {
        // Okta accepted the password, but tenant policy demands a second factor (MFA)
        console.log("[DEBUG 16] Password saved! MFA enrollment required next.");
        setError('Password saved successfully! Your organization requires you to set up a second factor (UI not yet implemented).');
      } else {
        console.log("[DEBUG 16] Unhandled post-enrollment state:", transaction);
        setError(`Unexpected step requested: ${transaction.nextStep?.name}`);
      }
    } catch (err) {
      console.error('[CRITICAL DEBUG] Error during enrollment:', err);
      setError('Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Custom Headless Login</h2>
      
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      {/* --- View 1: Identify --- */}
      {step === 'identify' && (
        <form onSubmit={handleIdentifySubmit}>
          <label>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', margin: '10px 0' }}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Next'}
          </button>
        </form>
      )}

      {/* --- View 2: Password --- */}
      {step === 'challenge-password' && (
        <form onSubmit={handleCredentialSubmit}>
          <label>Password for {email}</label>
          <input 
            type="password" 
            value={credential} 
            onChange={(e) => setCredential(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', margin: '10px 0' }}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      )}

      {/* --- View 3: Temporary Access Code --- */}
      {step === 'challenge-tac' && (
        <form onSubmit={handleCredentialSubmit}>
          <label>Temporary Access Code for {email}</label>
          <input 
            type="text" 
            value={credential} 
            onChange={(e) => setCredential(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', margin: '10px 0' }}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Submit Code'}
          </button>
        </form>
      )}

      {/* --- View 4: Enroll Permanent Password (Post-TAC) --- */}
      {step === 'enroll-password' && (
        <form onSubmit={handleEnrollSubmit}>
          <h3 style={{ color: 'green', marginBottom: '10px' }}>✓ Code Accepted</h3>
          <label>Set your permanent password</label>
          <input 
            type="password" 
            value={credential} 
            onChange={(e) => setCredential(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', margin: '10px 0' }}
            placeholder="New password"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Set Password'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Login;