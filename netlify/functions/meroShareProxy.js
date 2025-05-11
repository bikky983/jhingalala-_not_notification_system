const axios = require('axios');

const MS_API_BASE = "https://webbackend.cdsc.com.np/api";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Base headers for API requests
const BASE_HEADERS = {
    "User-Agent": USER_AGENT,
    "Connection": "keep-alive",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://meroshare.cdsc.com.np",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sec-GPC": "1",
    "Content-Type": "application/json"
};

exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle OPTIONS request (preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { endpoint, method, body, authToken } = JSON.parse(event.body);
        
        if (!endpoint) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing endpoint parameter' })
            };
        }
        
        // Construct the full URL
        const url = `${MS_API_BASE}${endpoint}`;
        
        // Build request headers
        const requestHeaders = { ...BASE_HEADERS };
        if (authToken) {
            requestHeaders['Authorization'] = authToken;
        } else if (endpoint !== '/meroShare/capital/' && endpoint !== '/meroShare/auth/') {
            requestHeaders['Authorization'] = 'null';
        }
        
        // Make the request to MeroShare API
        const requestConfig = {
            method: method || 'GET',
            url,
            headers: requestHeaders,
            validateStatus: () => true // Accept any status code
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = body;
        }
        
        const response = await axios(requestConfig);
        
        // Get the authorization token if it's in the response headers
        let responseAuthToken = null;
        if (response.headers && response.headers.authorization) {
            responseAuthToken = response.headers.authorization;
        }
        
        return {
            statusCode: response.status,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: response.data,
                authToken: responseAuthToken,
                status: response.status
            })
        };
    } catch (error) {
        console.error('Error proxying request:', error);
        
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
}; 