// Constants
const API_PROXY = "/.netlify/functions/meroShareProxy";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// Store accounts in localStorage
let accounts = [];
const LOCAL_STORAGE_KEY = 'meroshare_accounts';

// Make API request through our proxy
async function makeApiRequest(endpoint, method = 'GET', body = null, authToken = null) {
    try {
        const response = await fetch(API_PROXY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                endpoint,
                method,
                body,
                authToken
            })
        });

        const result = await response.json();
        
        if (result.status >= 400) {
            throw new Error(result.data?.message || 'API request failed');
        }
        
        // Return both the data and the auth token if present
        return {
            data: result.data,
            authToken: result.authToken
        };
    } catch (error) {
        console.error(`Error making API request to ${endpoint}:`, error);
        throw error;
    }
}

// Load accounts from localStorage
function loadAccounts() {
    const storedAccounts = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedAccounts) {
        accounts = JSON.parse(storedAccounts);
        renderAccounts();
    }
}

// Save accounts to localStorage
function saveAccounts() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts));
}

// Add a new account
function addAccount(account) {
    accounts.push(account);
    saveAccounts();
    renderAccounts();
}

// Remove an account
function removeAccount(index) {
    accounts.splice(index, 1);
    saveAccounts();
    renderAccounts();
}

// Render account cards
function renderAccounts() {
    const container = document.getElementById('accounts-container');
    container.innerHTML = '';

    if (accounts.length === 0) {
        container.innerHTML = '<p>No accounts added yet. Add your first account above.</p>';
        return;
    }

    accounts.forEach((account, index) => {
        const card = document.createElement('div');
        card.className = 'account-card';
        card.innerHTML = `
            <div class="actions">
                <button class="remove-account" data-index="${index}">×</button>
            </div>
            <div class="account-name">${account.name || 'Account ' + (index + 1)}</div>
            <div class="account-detail"><strong>DMAT:</strong> ${account.dmat}</div>
            <div class="account-detail"><strong>CRN:</strong> ${account.crn}</div>
        `;
        container.appendChild(card);
    });

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-account').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            removeAccount(index);
        });
    });
}

// Login to MeroShare and get account details
async function loginAndGetDetails(account) {
    try {
        // Get capital ID for the DMAT
        const dpid = account.dmat.substring(3, 8);
        const capitalId = await getCapitalId(dpid);
        
        if (!capitalId) {
            throw new Error("Could not determine capital ID for the given DMAT");
        }
        
        // Login to MeroShare
        const loginData = {
            clientId: capitalId.toString(),
            username: account.dmat.substring(8),
            password: account.password
        };

        const loginResponse = await makeApiRequest('/meroShare/auth/', 'POST', loginData);
        const loginResult = loginResponse.data;
        
        if (loginResult.passwordExpired || loginResult.accountExpired || loginResult.dematExpired) {
            throw new Error("Account expired or password expired. Please update in MeroShare directly.");
        }

        // Get the auth token
        const authToken = loginResponse.authToken;
        
        // Get account details
        const detailsResponse = await makeApiRequest(`/meroShareView/myDetail/${account.dmat}`, 'GET', null, authToken);
        const accountDetails = detailsResponse.data;
        
        // Update account with details
        account.name = accountDetails.name;
        account.dpid = dpid;
        account.username = account.dmat.substring(8);
        account.capital_id = capitalId;
        account.auth_token = authToken;
        
        return account;
    } catch (error) {
        console.error("Error during login:", error);
        throw error;
    }
}

// Get capital ID for a DPID
async function getCapitalId(dpid) {
    try {
        const response = await makeApiRequest('/meroShare/capital/');
        const capitals = response.data;
        const capital = capitals.find(cap => cap.code === dpid);
        
        return capital ? capital.id : null;
    } catch (error) {
        console.error("Error getting capital ID:", error);
        return null;
    }
}

// Get applicable issues
async function getApplicableIssues(account) {
    try {
        // Ensure we have auth token
        if (!account.auth_token) {
            account = await loginAndGetDetails(account);
        }
        
        const response = await makeApiRequest('/meroShare/companyShare/applicableIssue/', 'GET', null, account.auth_token);
        return response.data;
    } catch (error) {
        console.error("Error getting applicable issues:", error);
        throw error;
    }
}

// Apply for an IPO
async function applyForIPO(account, shareId, quantity) {
    try {
        // Ensure we have auth token and account details
        if (!account.auth_token) {
            account = await loginAndGetDetails(account);
        }
        
        // Get account details if we don't have them
        if (!account.bank_id || !account.customer_id || !account.branch_id || !account.account_type_id) {
            await getAccountBankDetails(account);
        }
        
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
        
        const response = await makeApiRequest('/meroShare/applicantForm/share/apply', 'POST', data, account.auth_token);
        
        if (response.data.status !== 201) {
            throw new Error(response.data.message || "Application failed");
        }
        
        return response.data;
    } catch (error) {
        console.error("Error applying for IPO:", error);
        throw error;
    }
}

// Get bank details for account
async function getAccountBankDetails(account) {
    try {
        // Get bank ID
        const bankResponse = await makeApiRequest('/meroShare/bank/', 'GET', null, account.auth_token);
        const banks = bankResponse.data;
        account.bank_id = banks[0].id;
        
        // Get bank specific details
        const bankDetailsResponse = await makeApiRequest(`/meroShare/bank/${account.bank_id}`, 'GET', null, account.auth_token);
        const bankDetails = bankDetailsResponse.data;
        account.branch_id = bankDetails[0].id;
        account.account_number = bankDetails[0].accountNumber;
        
        // Get customer details
        const customerResponse = await makeApiRequest(`/meroShare/bank/${account.bank_id}/branch/${account.branch_id}/customer/`, 'GET', null, account.auth_token);
        const customers = customerResponse.data;
        account.customer_id = customers[0].id;
        
        // Get account type
        const accountTypeResponse = await makeApiRequest(`/meroShare/bank/${account.bank_id}/accountType/`, 'GET', null, account.auth_token);
        const accountTypes = accountTypeResponse.data;
        account.account_type_id = accountTypes[0].id;
        
        return account;
    } catch (error) {
        console.error("Error getting bank details:", error);
        throw error;
    }
}

// Get result companies
async function getResultCompanies(account) {
    try {
        // Ensure we have auth token
        if (!account.auth_token) {
            account = await loginAndGetDetails(account);
        }
        
        const response = await makeApiRequest('/meroShare/applicationReport/report/applicantReport/', 'GET', null, account.auth_token);
        return response.data;
    } catch (error) {
        console.error("Error getting result companies:", error);
        throw error;
    }
}

// Check IPO result
async function checkIPOResult(account, companyShareId) {
    try {
        // Ensure we have auth token
        if (!account.auth_token) {
            account = await loginAndGetDetails(account);
        }
        
        const response = await makeApiRequest(`/meroShare/applicantForm/existingForm/detail/${companyShareId}`, 'GET', null, account.auth_token);
        const result = response.data;
        
        return {
            name: account.name,
            alloted: result.statusName === "Alloted",
            quantity: result.statusName === "Alloted" ? result.allotedUnit : null
        };
    } catch (error) {
        console.error("Error checking IPO result:", error);
        throw error;
    }
}

// Get application status
async function getApplicationStatus(account) {
    try {
        // Ensure we have auth token
        if (!account.auth_token) {
            account = await loginAndGetDetails(account);
        }
        
        const response = await makeApiRequest('/meroShare/applicantForm/active/search/', 'POST', {}, account.auth_token);
        return response.data;
    } catch (error) {
        console.error("Error getting application status:", error);
        throw error;
    }
}

// Tab switching
function setupTabs() {
    const tabs = document.querySelectorAll('.ipo-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show corresponding tab content
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Load tab-specific data
            if (tabId === 'apply') {
                loadAvailableIssues();
            } else if (tabId === 'results') {
                loadResultCompanies();
            } else if (tabId === 'status') {
                loadApplicationStatus();
            }
        });
    });
}

// Load available issues
async function loadAvailableIssues() {
    if (accounts.length === 0) {
        document.getElementById('loading-issues').style.display = 'none';
        document.getElementById('issues-table').style.display = 'none';
        document.getElementById('available-issues').innerHTML = '<p>Please add at least one account first.</p>';
        return;
    }
    
    document.getElementById('loading-issues').style.display = 'block';
    document.getElementById('issues-table').style.display = 'none';
    
    try {
        // Use the first account to get issues
        const issues = await getApplicableIssues(accounts[0]);
        
        const tbody = document.querySelector('#issues-table tbody');
        tbody.innerHTML = '';
        
        issues.forEach(issue => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${issue.companyName}</td>
                <td>${issue.scrip}</td>
                <td>${issue.shareTypeName}</td>
                <td>${issue.closeDate}</td>
                <td><button class="btn-primary apply-btn" data-id="${issue.companyShareId}" data-name="${issue.companyName}">Apply</button></td>
            `;
            tbody.appendChild(row);
        });
        
        // Add event listeners to apply buttons
        document.querySelectorAll('.apply-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const shareId = e.target.getAttribute('data-id');
                const companyName = e.target.getAttribute('data-name');
                showApplyForm(shareId, companyName);
            });
        });
        
        document.getElementById('loading-issues').style.display = 'none';
        document.getElementById('issues-table').style.display = 'table';
    } catch (error) {
        document.getElementById('loading-issues').style.display = 'none';
        document.getElementById('available-issues').innerHTML = `<p>Error loading issues: ${error.message}</p>`;
    }
}

// Show apply form
function showApplyForm(shareId, companyName) {
    document.getElementById('available-issues').style.display = 'none';
    document.getElementById('apply-form').style.display = 'block';
    document.querySelector('#applying-company span').textContent = companyName;
    
    // Store share ID as data attribute
    document.getElementById('submit-apply').setAttribute('data-id', shareId);
    
    // Clear previous results
    document.getElementById('apply-results').innerHTML = '';
}

// Load result companies
async function loadResultCompanies() {
    if (accounts.length === 0) {
        document.getElementById('loading-results').style.display = 'none';
        document.getElementById('results-table').style.display = 'none';
        document.getElementById('result-companies').innerHTML = '<p>Please add at least one account first.</p>';
        return;
    }
    
    document.getElementById('loading-results').style.display = 'block';
    document.getElementById('results-table').style.display = 'none';
    
    try {
        // Use the first account to get result companies
        const companies = await getResultCompanies(accounts[0]);
        
        const tbody = document.querySelector('#results-table tbody');
        tbody.innerHTML = '';
        
        companies.forEach(company => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${company.companyName}</td>
                <td>${company.scrip}</td>
                <td><button class="btn-primary check-result-btn" data-id="${company.companyShareId}" data-name="${company.companyName}">Check Result</button></td>
            `;
            tbody.appendChild(row);
        });
        
        // Add event listeners to check result buttons
        document.querySelectorAll('.check-result-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const shareId = e.target.getAttribute('data-id');
                const companyName = e.target.getAttribute('data-name');
                showResultDetails(shareId, companyName);
            });
        });
        
        document.getElementById('loading-results').style.display = 'none';
        document.getElementById('results-table').style.display = 'table';
    } catch (error) {
        document.getElementById('loading-results').style.display = 'none';
        document.getElementById('result-companies').innerHTML = `<p>Error loading result companies: ${error.message}</p>`;
    }
}

// Show result details
async function showResultDetails(shareId, companyName) {
    document.getElementById('result-companies').style.display = 'none';
    document.getElementById('result-details').style.display = 'block';
    document.querySelector('#results-company span').textContent = companyName;
    
    const tbody = document.querySelector('#account-results-table tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading results...</td></tr>';
    
    try {
        const results = await Promise.all(accounts.map(account => 
            checkIPOResult(account, shareId).catch(() => ({ 
                name: account.name, 
                alloted: false, 
                quantity: null 
            }))
        ));
        
        tbody.innerHTML = '';
        
        results.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.name}</td>
                <td>${result.alloted ? 'Yes' : 'No'}</td>
                <td>${result.quantity || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading results: ${error.message}</td></tr>`;
    }
}

// Load application status
async function loadApplicationStatus() {
    if (accounts.length === 0) {
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('status-table').style.display = 'none';
        document.getElementById('application-status').innerHTML = '<p>Please add at least one account first.</p>';
        return;
    }
    
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('status-table').style.display = 'none';
    
    try {
        const allStatuses = await Promise.all(accounts.map(async (account) => {
            try {
                const status = await getApplicationStatus(account);
                return status.object.map(app => ({
                    account: account.name,
                    company: app.companyName,
                    symbol: app.scrip,
                    appliedDate: app.appliedDate,
                    quantity: app.appliedUnit,
                    status: app.statusName
                }));
            } catch (error) {
                console.error(`Error getting status for ${account.name}:`, error);
                return [];
            }
        }));
        
        // Flatten the array of arrays
        const statuses = allStatuses.flat();
        
        const tbody = document.querySelector('#status-table tbody');
        tbody.innerHTML = '';
        
        if (statuses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No active applications found</td></tr>';
        } else {
            statuses.forEach(status => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${status.account}</td>
                    <td>${status.company}</td>
                    <td>${status.symbol}</td>
                    <td>${status.appliedDate}</td>
                    <td>${status.quantity}</td>
                    <td>${status.status}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('status-table').style.display = 'table';
    } catch (error) {
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('application-status').innerHTML = `<p>Error loading application status: ${error.message}</p>`;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Load saved accounts
    loadAccounts();
    
    // Setup tab switching
    setupTabs();
    
    // Add account form submission
    document.getElementById('add-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dmat = document.getElementById('dmat').value;
        const password = document.getElementById('password').value;
        const crn = document.getElementById('crn').value;
        const pin = document.getElementById('pin').value;
        
        let account = { dmat, password, crn, pin };
        
        try {
            // Try to login and get account details
            account = await loginAndGetDetails(account);
            addAccount(account);
            
            // Reset form
            document.getElementById('add-account-form').reset();
            
            // Show success message
            alert(`Account ${account.name} added successfully!`);
        } catch (error) {
            alert(`Error adding account: ${error.message}`);
        }
    });
    
    // Apply for IPO submission
    document.getElementById('submit-apply').addEventListener('click', async () => {
        const shareId = document.getElementById('submit-apply').getAttribute('data-id');
        const quantity = document.getElementById('apply-quantity').value;
        
        const resultsDiv = document.getElementById('apply-results');
        resultsDiv.innerHTML = '<p>Applying for IPO, please wait...</p>';
        
        const results = [];
        
        for (const account of accounts) {
            try {
                const result = await applyForIPO(account, shareId, quantity);
                results.push({
                    account: account.name,
                    success: true,
                    message: result.message || 'Application successful'
                });
            } catch (error) {
                results.push({
                    account: account.name,
                    success: false,
                    message: error.message
                });
            }
        }
        
        // Display results
        resultsDiv.innerHTML = '<h3>Application Results</h3>';
        const table = document.createElement('table');
        table.className = 'ipo-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Account</th>
                    <th>Status</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td>${result.account}</td>
                        <td>${result.success ? 'Success' : 'Failed'}</td>
                        <td>${result.message}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        resultsDiv.appendChild(table);
    });
    
    // Cancel apply button
    document.getElementById('cancel-apply').addEventListener('click', () => {
        document.getElementById('available-issues').style.display = 'block';
        document.getElementById('apply-form').style.display = 'none';
    });
    
    // Back to results button
    document.getElementById('back-to-results').addEventListener('click', () => {
        document.getElementById('result-companies').style.display = 'block';
        document.getElementById('result-details').style.display = 'none';
    });
}); 