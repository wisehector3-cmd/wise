const Binance = require('binance-api-node').default;

function createBinanceClient(apiKey, apiSecret, isTestnet = false) {
    return Binance({
        apiKey: apiKey,
        apiSecret: apiSecret,
        useServerTime: true,
        test: isTestnet
    });
}

async function getAccountBalance(client) {
    try {
        const accountInfo = await client.accountInfo();
        return accountInfo.balances
            .filter(balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
            .map(balance => ({
                asset: balance.asset,
                free: parseFloat(balance.free),
                locked: parseFloat(balance.locked),
                total: parseFloat(balance.free) + parseFloat(balance.locked)
            }));
    } catch (error) {
        throw new Error(`Failed to get balance: ${error.message}`);
    }
}

async function getTickerPrices(client) {
    try {
        const prices = await client.prices();
        return prices;
    } catch (error) {
        throw new Error(`Failed to get prices: ${error.message}`);
    }
}

module.exports = {
    createBinanceClient,
    getAccountBalance,
    getTickerPrices
};
