const axios = require('axios');
const https = require('https');

// Constants from the original CLI
const MS_API_BASE = "https://webbackend.cdsc.com.np/api";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Create a custom HTTPS agent that doesn't verify certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

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

// Main handler function
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
        const requestData = JSON.parse(event.body);
        const { action, accountData } = requestData;

        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Missing action parameter' 
                })
            };
        }

        // Process different types of actions
        let result;
        switch (action) {
            case 'getCapitalList':
                result = await getCapitalList();
                break;
            case 'login':
                result = await loginAccount(accountData);
                break;
            case 'getAccountDetails':
                result = await getAccountDetails(accountData);
                break;
            case 'getBankDetails':
                result = await getBankDetails(accountData);
                break;
            case 'getApplicableIssues':
                result = await getApplicableIssues(accountData);
                break;
            case 'applyForIpo':
                result = await applyForIpo(accountData, requestData.shareId, requestData.quantity);
                break;
            case 'getResultCompanies':
                result = await getResultCompanies(accountData);
                break;
            case 'checkIpoResult':
                result = await checkIpoResult(accountData, requestData.companyShareId);
                break;
            case 'getApplicationStatus':
                result = await getApplicationStatus(accountData);
                break;
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        success: false,
                        error: `Unknown action: ${action}` 
                    })
                };
        }

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                data: result
            })
        };
    } catch (error) {
        console.error('Error in IPO Manager:', error);
        
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error',
                stack: error.stack
            })
        };
    }
};

// Function to get the capital list
async function getCapitalList() {
    try {
        // Create a clean session
        const session = axios.create({
            headers: { ...BASE_HEADERS, "Authorization": "null" },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        const response = await session.get(`${MS_API_BASE}/meroShare/capital/`);
        
        if (response.status !== 200) {
            throw new Error(`Failed to get capital list: ${response.statusText}`);
        }
        
        const capitals = {};
        response.data.forEach(capital => {
            capitals[capital.code] = capital.id;
        });
        
        return capitals;
    } catch (error) {
        console.error("Error getting capital list:", error);
        throw error;
    }
}

// Function to login a MeroShare account
async function loginAccount(account) {
    try {
        if (!account.dmat) {
            throw new Error("DMAT number required!");
        }
        
        // Extract DPID from DMAT number
        const dpid = account.dmat.substring(3, 8);
        
        // Get capital ID from capital list
        const capitals = await getCapitalList();
        const capitalId = capitals[dpid];
        
        if (!capitalId) {
            throw new Error(`Could not find capital ID for DPID: ${dpid}`);
        }
        
        // Create a session
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": "null",
                "Content-Type": "application/json"
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        // Prepare login data
        const loginData = {
            clientId: capitalId.toString(),
            username: account.dmat.substring(8),
            password: account.password
        };
        
        // Make login request
        const loginResponse = await session.post(`${MS_API_BASE}/meroShare/auth/`, loginData);
        
        if (loginResponse.status !== 200) {
            throw new Error(`Login failed: ${loginResponse.statusText}`);
        }
        
        const loginResult = loginResponse.data;
        
        // Check for expired accounts
        if (loginResult.passwordExpired) {
            throw new Error("Password has expired. Please update in MeroShare directly.");
        }
        
        if (loginResult.accountExpired) {
            throw new Error("Account has expired. Please update in MeroShare directly.");
        }
        
        if (loginResult.dematExpired) {
            throw new Error("DMAT has expired. Please update in MeroShare directly.");
        }
        
        // Get auth token
        const authToken = loginResponse.headers.authorization;
        
        return {
            name: loginResult.name,
            dpid: dpid,
            username: account.dmat.substring(8),
            capital_id: capitalId,
            auth_token: authToken
        };
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
}

// Function to get account details
async function getAccountDetails(account) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        // Get account details
        const accountDetails = await session.get(`${MS_API_BASE}/meroShareView/myDetail/${account.dmat}`);
        
        if (accountDetails.status !== 200) {
            throw new Error(`Failed to get account details: ${accountDetails.statusText}`);
        }
        
        // Get bank details
        const bankCode = accountDetails.data.bankCode;
        const bankReq = await session.get(`${MS_API_BASE}/bankRequest/${bankCode}`);
        
        if (bankReq.status !== 200) {
            throw new Error(`Failed to get bank details: ${bankReq.statusText}`);
        }
        
        return {
            ...account,
            name: accountDetails.data.name,
            account: bankReq.data.accountNumber
        };
    } catch (error) {
        console.error("Error getting account details:", error);
        throw error;
    }
}

// Function to get bank details
async function getBankDetails(account) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        // Get bank ID
        const bankResponse = await session.get(`${MS_API_BASE}/meroShare/bank/`);
        
        if (bankResponse.status !== 200) {
            throw new Error(`Failed to get bank details: ${bankResponse.statusText}`);
        }
        
        const bankId = bankResponse.data[0].id;
        
        // Get bank specific details
        const bankSpecificResponse = await session.get(`${MS_API_BASE}/meroShare/bank/${bankId}`);
        
        if (bankSpecificResponse.status !== 200) {
            throw new Error(`Failed to get bank specific details: ${bankSpecificResponse.statusText}`);
        }
        
        const branchId = bankSpecificResponse.data[0].id;
        const accountNumber = bankSpecificResponse.data[0].accountNumber;
        
        // Get customer details
        const customerResponse = await session.get(`${MS_API_BASE}/meroShare/bank/${bankId}/branch/${branchId}/customer/`);
        
        if (customerResponse.status !== 200) {
            throw new Error(`Failed to get customer details: ${customerResponse.statusText}`);
        }
        
        const customerId = customerResponse.data[0].id;
        
        // Get account type
        const accountTypeResponse = await session.get(`${MS_API_BASE}/meroShare/bank/${bankId}/accountType/`);
        
        if (accountTypeResponse.status !== 200) {
            throw new Error(`Failed to get account type: ${accountTypeResponse.statusText}`);
        }
        
        const accountTypeId = accountTypeResponse.data[0].id;
        
        return {
            ...account,
            bank_id: bankId,
            branch_id: branchId,
            account_number: accountNumber,
            customer_id: customerId,
            account_type_id: accountTypeId
        };
    } catch (error) {
        console.error("Error getting bank details:", error);
        throw error;
    }
}

// Function to get applicable issues
async function getApplicableIssues(account) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        const response = await session.get(`${MS_API_BASE}/meroShare/companyShare/applicableIssue/`);
        
        if (response.status !== 200) {
            throw new Error(`Failed to get applicable issues: ${response.statusText}`);
        }
        
        return response.data;
    } catch (error) {
        console.error("Error getting applicable issues:", error);
        throw error;
    }
}

// Function to apply for IPO
async function applyForIpo(account, shareId, quantity) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Get bank details if we don't have them
        if (!account.bank_id || !account.customer_id || !account.branch_id || !account.account_type_id) {
            account = await getBankDetails(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token,
                "Content-Type": "application/json",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        // Prepare application data
        const data = {
            demat: account.dmat,
            boid: account.dmat.substring(8),
            accountNumber: account.account_number,
            customerId: account.customer_id,
            accountBranchId: account.branch_id,
            accountTypeId: account.account_type_id,
            appliedKitta: quantity.toString(),
            crnNumber: account.crn,
            transactionPIN: account.pin,
            companyShareId: shareId.toString(),
            bankId: account.bank_id
        };
        
        // Apply for IPO
        const applyResponse = await session.post(`${MS_API_BASE}/meroShare/applicantForm/share/apply`, data);
        
        if (applyResponse.status !== 201) {
            throw new Error(`Apply failed: ${applyResponse.statusText}`);
        }
        
        return applyResponse.data;
    } catch (error) {
        console.error("Error applying for IPO:", error);
        throw error;
    }
}

// Function to get result companies
async function getResultCompanies(account) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        const response = await session.get(`${MS_API_BASE}/meroShare/applicationReport/report/applicantReport/`);
        
        if (response.status !== 200) {
            throw new Error(`Failed to get result companies: ${response.statusText}`);
        }
        
        return response.data;
    } catch (error) {
        console.error("Error getting result companies:", error);
        throw error;
    }
}

// Function to check IPO result
async function checkIpoResult(account, companyShareId) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        const response = await session.get(`${MS_API_BASE}/meroShare/applicantForm/existingForm/detail/${companyShareId}`);
        
        if (response.status !== 200) {
            throw new Error(`Failed to get result details: ${response.statusText}`);
        }
        
        return {
            name: account.name,
            alloted: response.data.statusName === "Alloted",
            quantity: response.data.statusName === "Alloted" ? response.data.allotedUnit : null
        };
    } catch (error) {
        console.error("Error checking IPO result:", error);
        throw error;
    }
}

// Function to get application status
async function getApplicationStatus(account) {
    try {
        if (!account.auth_token) {
            account = await loginAccount(account);
        }
        
        // Create a session with auth token
        const session = axios.create({
            headers: { 
                ...BASE_HEADERS,
                "Authorization": account.auth_token,
                "Content-Type": "application/json"
            },
            httpsAgent: httpsAgent // Add httpsAgent for SSL certificate bypass
        });
        
        const response = await session.post(`${MS_API_BASE}/meroShare/applicantForm/active/search/`, {});
        
        if (response.status !== 200) {
            throw new Error(`Failed to get application status: ${response.statusText}`);
        }
        
        return response.data;
    } catch (error) {
        console.error("Error getting application status:", error);
        throw error;
    }
} 
