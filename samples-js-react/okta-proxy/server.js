const express = require('express');
const cors = require('cors');
const { Client } = require('@okta/okta-sdk-nodejs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors()); // Allow requests from our React app on port 3000

// Initialize the Okta v8+ Client
const client = new Client({
  orgUrl: process.env.OKTA_ORG_URL, 
  token: process.env.OKTA_API_TOKEN 
});

app.post('/api/lookup-user', async (req, res) => {
  const { email } = req.body;
  
  try {
    // 1. Resolve the internal Okta User ID using the SDK
    const user = await client.userApi.getUser({ userId: email });
    
    // 2. Bypass the bugged SDK method and use native fetch
    const url = `${process.env.OKTA_ORG_URL}/api/v1/users/${user.id}/authenticator-enrollments`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}` // Okta's standard API token header
      }
    });

    if (!response.ok) {
      throw new Error(`Okta API Error: ${response.statusText}`);
    }

    const enrollments = await response.json();
    
    let hasTac = false;
    const debugAuthenticators = [];

    // 3. The raw API correctly returns a standard JavaScript array
    for (const enrollment of enrollments) {
      debugAuthenticators.push({
        id: enrollment.id,
        type: enrollment.type,
        status: enrollment.status,
      });

      // Match the exact type
      if (enrollment.type === 'tac' && enrollment.status === 'ACTIVE') { 
        hasTac = true;
      }
    }

    res.json({ hasTac, status: 'success' });
    
  } catch (error) {
    console.error('Lookup Error:', error.message);
    res.json({ hasTac: false, status: 'generic_fallback' }); 
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Okta proxy running on port ${PORT}`));