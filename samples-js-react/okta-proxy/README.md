# Okta Intelligence Proxy (Node.js)

This Node.js/Express proxy acts as the backend intelligence layer for the Custom Headless Login React application. It securely queries Okta's management APIs to determine a user's factor enrollments before the frontend UI renders an authentication challenge.

## How It Works (Architecture Logic)

In a headless identity architecture, the frontend needs to know which custom UI to render (e.g., a standard Password field vs. a Temporary Access Code field) before it actually prompts the user. 

1. **The Request:** The React frontend sends a `POST` request to `/api/lookup-user` with the user's email address.
2. **The Lookup:** This proxy uses a secure Okta API Token to query the Okta Users and Authenticators APIs. 
3. **The Response:** It evaluates the user's enrolled factors to determine if the custom TAC authenticator is active for this profile. It returns a clean JSON response (e.g., `{ hasTac: true }`) to the frontend.
4. **Security:** By handling this lookup server-side, the high-privilege Okta API Token is never exposed to the public React frontend.

## Prerequisites

Before running this sample, you will need the following:

* Node.js (v18 or higher recommended).
* An Okta Developer Account (Identity Engine enabled).
* An **Okta API Token** generated from your Okta Admin Console (Security > API > Tokens).

## Running This Example

To run this application, you first need to clone your repository and install the dependencies:

```bash
npm install
```

Create a .env file at the root of this repository to store your backend variables:
```ini
PORT=3001
OKTA_DOMAIN=[https://yourOktaDomain.oktapreview.com](https://yourOktaDomain.oktapreview.com)
OKTA_API_TOKEN=your_highly_secure_api_token
```

With variables set, start the proxy server:
```bash
npm start
```

The proxy will run on http://localhost:3001. Keep this terminal window open while you run the React frontend application in a separate terminal.