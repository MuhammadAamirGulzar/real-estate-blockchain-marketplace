export const getPortfolioStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // TODO: In production, this would calculate from actual investment and property data
    // For now, return user-specific mock data based on user ID to demonstrate dynamic content
    
    // Generate user-specific data based on user ID
    const userSeed = userId * 1000;
    const baseInvestment = 10000 + (userSeed % 100000);
    const profitMultiplier = 1 + (userSeed % 50) / 100; // 1-1.5x multiplier
    
    const totalInvested = baseInvestment;
    const currentValue = Math.floor(totalInvested * profitMultiplier);
    const totalProfit = currentValue - totalInvested;
    const profitPercentage = ((totalProfit / totalInvested) * 100);
    
    const dynamicStats = {
      totalInvested,
      currentValue,
      totalProfit,
      profitPercentage: parseFloat(profitPercentage.toFixed(2)),
      totalProperties: Math.floor(1 + (userSeed % 5)), // 1-5 properties
      activeInvestments: Math.floor(1 + (userSeed % 4)), // 1-4 investments
      monthlyRevenue: Math.floor(totalProfit / 12),
      yearlyRevenue: totalProfit,
      portfolioBreakdown: [
        { 
          type: "Residential", 
          percentage: 40 + (userSeed % 30), 
          value: Math.floor(currentValue * (40 + (userSeed % 30)) / 100) 
        },
        { 
          type: "Commercial", 
          percentage: 30 + (userSeed % 20), 
          value: Math.floor(currentValue * (30 + (userSeed % 20)) / 100) 
        },
        { 
          type: "Industrial", 
          percentage: 15 + (userSeed % 15), 
          value: Math.floor(currentValue * (15 + (userSeed % 15)) / 100) 
        }
      ],
      performanceHistory: [
        { month: "Jan", value: Math.floor(totalInvested * 0.95) },
        { month: "Feb", value: Math.floor(totalInvested * 0.97) },
        { month: "Mar", value: Math.floor(totalInvested * 1.01) },
        { month: "Apr", value: Math.floor(totalInvested * 1.05) },
        { month: "May", value: Math.floor(totalInvested * (profitMultiplier - 0.02)) },
        { month: "Jun", value: currentValue }
      ]
    };

    res.json(dynamicStats);
  } catch (error) {
    console.error("Get portfolio stats error:", error);
    res.status(500).json({ error: "Failed to fetch portfolio statistics" });
  }
};

export const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock transaction history
    const mockTransactions = [
      {
        id: 1,
        type: "investment",
        propertyTitle: "Luxury Downtown Apartment",
        amount: 100000,
        tokensAmount: 100,
        tokenPrice: "1000.00",
        transactionHash: "0xabc123...",
        status: "completed",
        createdAt: new Date("2024-01-15")
      },
      {
        id: 2,
        type: "investment",
        propertyTitle: "Commercial Office Space",
        amount: 100000,
        tokensAmount: 50,
        tokenPrice: "2000.00",
        transactionHash: "0xdef456...",
        status: "completed",
        createdAt: new Date("2024-02-01")
      },
      {
        id: 3,
        type: "payout",
        propertyTitle: "Luxury Downtown Apartment",
        amount: 2500,
        transactionHash: "0xghi789...",
        status: "completed",
        createdAt: new Date("2024-03-01")
      },
      {
        id: 4,
        type: "trade",
        propertyTitle: "Industrial Warehouse",
        amount: 50000,
        tokensAmount: 25,
        tokenPrice: "2000.00",
        transactionHash: "0xjkl012...",
        status: "completed",
        createdAt: new Date("2024-03-15")
      }
    ];

    res.json(mockTransactions);
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
};

export const getUserPayouts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock payout history
    const mockPayouts = [
      {
        id: 1,
        propertyId: 1,
        propertyTitle: "Luxury Downtown Apartment",
        amount: 2500,
        amountPerToken: "25.00",
        tokensOwned: 100,
        payoutDate: new Date("2024-03-01"),
        transactionHash: "0xpayout1...",
        status: "completed"
      },
      {
        id: 2,
        propertyId: 2,
        propertyTitle: "Commercial Office Space",
        amount: 1500,
        amountPerToken: "30.00",
        tokensOwned: 50,
        payoutDate: new Date("2024-03-01"),
        transactionHash: "0xpayout2...",
        status: "completed"
      },
      {
        id: 3,
        propertyId: 1,
        propertyTitle: "Luxury Downtown Apartment",
        amount: 2500,
        amountPerToken: "25.00",
        tokensOwned: 100,
        payoutDate: new Date("2024-02-01"),
        transactionHash: "0xpayout3...",
        status: "completed"
      }
    ];

    res.json(mockPayouts);
  } catch (error) {
    console.error("Get user payouts error:", error);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
};