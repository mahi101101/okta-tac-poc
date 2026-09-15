# Okta React + Custom Headless Login Example

This example shows you how to use the [Okta React Library][] and `@okta/okta-auth-js` SDK to log a user into a React application. Unlike standard implementations, this application **bypasses the Okta Sign-In Widget entirely**. It utilizes a completely custom, headless state machine to dynamically route users to either a standard Password challenge or a custom Temporary Access Code (TAC) challenge. 

This example is built with Vite and React.

## How It Works (Architecture Logic)

This application orchestrates a highly customized authentication flow using Okta's Identity Engine (OIE) APIs:

1. **Intelligence Gathering (Identify):** When a user enters their email, the React app pauses and silently queries the local Node Proxy. The proxy checks the user's enrolled factors and returns whether the user requires a TAC or a standard password.
2. **First Bypass (Auto-Selection):** The app starts the Okta transaction. When Okta returns the `select-authenticator-authenticate` step, the app intercepts it, automatically selects the correct authenticator ID (Password or TAC) based on the proxy's intelligence, and pushes the state machine forward. The user never sees a selection screen.
3. **Custom Challenge (Credential):** The React UI renders a hardcoded, custom input screen based on the bypass. It formats the submission payload strictly (using the `password` key for standard logins and a nested `credentials: { passcode }` object for TACs).
4. **Second Bypass (Enrollment):** If a TAC is accepted, Okta requires the user to enroll a permanent password. The app intercepts the `select-authenticator-enroll` state, auto-selects the Password factor, and drops the user into a custom "Set Permanent Password" screen. Once submitted, the session is created.

## Prerequisites

Before running this sample, you will need the following:

* An Okta Developer Account, you can sign up for one at https://developer.okta.com/signup/.
* An Okta Application, configured for Single-Page App (SPA) mode. This is done from the Okta Developer Console. When following the wizard, use the default properties.
* **The Node Intelligence Proxy** (provided in the backend repo) must be running locally on port 3001.

## Enable Refresh Tokens

Add a required setting to your SPA Okta app to avoid third-party cookies. Navigate to **Applications** > **Applications** and select this application to edit. Find the **General Settings** and press **Edit**. Enable **Refresh Token** in the **Grant type** section. **Save** your changes.

## Running This Example

To run this application, you first need to clone your repository and install the dependencies:

```bash
npm install
```

Now you need to gather the following information from the Okta Developer Console:

* **Client Id** - The client ID of the SPA application that you created earlier. This can be found on the "General" tab of an application.
* **Issuer** - This is the URL of the authorization server that will perform authentication. The issuer is a combination of your Org URL and `/oauth2/default`. For example, `https://dev-1234.oktapreview.com/oauth2/default`.

These values must exist as environment variables. Save them in a file named `.env` at the root of this repository:

```ini
VITE_ISSUER=[https://yourOktaDomain.com/oauth2/default](https://yourOktaDomain.com/oauth2/default)
VITE_CLIENT_ID=123xxxxx123
```

With variables set, start the app server:
```bash
npm start
```

Now navigate to http://localhost:8080 (or your configured Vite port) in your browser. Ensure the Node proxy is running concurrently, or the initial intelligence lookup will fail.