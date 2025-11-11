const { createBinanceClient, getTickerPrices } = require('./binance-api');

async function botScheduler(context) {
    try {
        // Get all active bots
        const activeBots = await context.entities.BotConfig.filter({ is_active: true });
        
        if (!activeBots || activeBots.length === 0) {
            return { success: true, message: 'No active bots' };
        }
        
        for (const bot of activeBots) {
            try {
                // Get user's API connection
                const apiConnections = await context.entities.ApiConnection.filter({ 
                    created_by: bot.created_by,
                    is_active: true 
                });
                
                if (!apiConnections || apiConnections.length === 0) {
                    continue;
                }
                
                const connection = apiConnections[0];
                const client = createBinanceClient(
                    connection.api_key,
                    connection.api_secret,
                    connection.is_testnet
                );
                
                const prices = await getTickerPrices(client);
                
                // Scan for opportunities
                const currencies = bot.enabled_currencies || ['BTC', 'ETH', 'USDT'];
                let foundCount = 0;
                
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
                                    
                                    if (profitPercentage >= bot.min_profit_percentage) {
                                        await context.entities.ArbitrageOpportunity.create({
                                            currency_a: currA,
                                            currency_b: currB,
                                            currency_c: currC,
                                            rate_ab: rate1,
                                            rate_bc: rate2,
                                            rate_ca: rate3,
                                            profit_percentage: profitPercentage,
                                            status: 'active',
                                            created_by: bot.created_by
                                        });
                                        foundCount++;
                                    }
                                }
                            }
                        }
                    }
                }
                
                await context.entities.BotLog.create({
                    bot_config_id: bot.id,
                    log_type: 'scan',
                    message: `Scheduled scan completed. Found ${foundCount} opportunities.`,
                    created_by: bot.created_by
                });
                
            } catch (error) {
                await context.entities.BotLog.create({
                    bot_config_id: bot.id,
                    log_type: 'error',
                    message: `Scheduler error: ${error.message}`,
                    created_by: bot.created_by
                });
            }
        }
        
        return { success: true, message: 'Scheduler completed' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { botScheduler };
