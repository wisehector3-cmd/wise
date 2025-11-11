const { createBinanceClient, getAccountBalance, getTickerPrices } = require('./binance-api');

// Get Balance Endpoint
async function getBalance(context) {
    try {
        const { userId } = context.request.body;
        
        // Get user's API credentials from database
        const apiConnections = await context.entities.ApiConnection.filter({ 
            created_by: userId,
            is_active: true 
        });
        
        if (!apiConnections || apiConnections.length === 0) {
            return { success: false, error: 'No active API connection found' };
        }
        
        const connection = apiConnections[0];
        const client = createBinanceClient(
            connection.api_key,
            connection.api_secret,
            connection.is_testnet
        );
        
        const balances = await getAccountBalance(client);
        const prices = await getTickerPrices(client);
        
        return {
            success: true,
            balances: balances,
            prices: prices
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Test Connection Endpoint
async function testConnection(context) {
    try {
        const { userId, connectionId } = context.request.body;
        
        const connection = await context.entities.ApiConnection.get(connectionId);
        
        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }
        
        const client = createBinanceClient(
            connection.api_key,
            connection.api_secret,
            connection.is_testnet
        );
        
        await client.accountInfo();
        
        return { success: true, message: 'Connection successful' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Scan Opportunities Endpoint
async function scanOpportunities(context) {
    try {
        const { userId, botConfigId } = context.request.body;
        
        const botConfig = await context.entities.BotConfig.get(botConfigId);
        if (!botConfig) {
            return { success: false, error: 'Bot config not found' };
        }
        
        const apiConnections = await context.entities.ApiConnection.filter({ 
            created_by: userId,
            is_active: true 
        });
        
        if (!apiConnections || apiConnections.length === 0) {
            return { success: false, error: 'No active API connection' };
        }
        
        const connection = apiConnections[0];
        const client = createBinanceClient(
            connection.api_key,
            connection.api_secret,
            connection.is_testnet
        );
        
        const prices = await getTickerPrices(client);
        
        // Scan for triangular arbitrage opportunities
        const opportunities = [];
        const currencies = botConfig.enabled_currencies || ['BTC', 'ETH', 'USDT'];
        
        for (let i = 0; i < currencies.length; i++) {
            for (let j = 0; j < currencies.length; j++) {
                for (let k = 0; k < currencies.length; k++) {
                    if (i !== j && j !== k && i !== k) {
                        const currA = currencies[i];
                        const currB = currencies[j];
                        const currC = currencies[k];
                        
                        const pair1 = `${currA}${currB}`;
                        const pair2 = `${currB}${currC}`;
                        const pair3 = `${currC}${currA}`;
                        
                        if (prices[pair1] && prices[pair2] && prices[pair3]) {
                            const rate1 = parseFloat(prices[pair1]);
                            const rate2 = parseFloat(prices[pair2]);
                            const rate3 = parseFloat(prices[pair3]);
                            
                            const profit = (1 * rate1 * rate2 * rate3) - 1;
                            const profitPercentage = profit * 100;
                            
                            if (profitPercentage >= botConfig.min_profit_percentage) {
                                await context.entities.ArbitrageOpportunity.create({
                                    currency_a: currA,
                                    currency_b: currB,
                                    currency_c: currC,
                                    rate_ab: rate1,
                                    rate_bc: rate2,
                                    rate_ca: rate3,
                                    profit_percentage: profitPercentage,
                                    status: 'active',
                                    created_by: userId
                                });
                                opportunities.push({ currA, currB, currC, profitPercentage });
                            }
                        }
                    }
                }
            }
        }
        
        return { success: true, count: opportunities.length, opportunities };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getBalance,
    testConnection,
    scanOpportunities
};
