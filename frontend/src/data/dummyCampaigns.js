export const dummyCampaigns = [
  {
    id: "123456789",
    name: "Sommerkampanje 2024",
    status: "active",
    objective: "conversions",
    spend: 1500,
    impressions: 25000,
    clicks: 1200,
    conversions: 45,
    purchaseValue: 4500,
    roas: 3.0,
    adSets: [
      {
        id: "ads_1",
        name: "Sommerkampanje - Ad Set 1",
        status: "active",
        dailyBudget: 50,
        bidAmount: 2.5,
        ads: [
          {
            id: "ad_1",
            name: "Sommerkampanje - Ad 1",
            status: "active",
            creative: {
              text: "Nyt sommeren med våre nye produkter!",
              imageUrl: "https://example.com/summer1.jpg"
            }
          },
          {
            id: "ad_2",
            name: "Sommerkampanje - Ad 2",
            status: "active",
            creative: {
              text: "Spesialtilbud denne sommeren!",
              imageUrl: "https://example.com/summer2.jpg"
            }
          }
        ]
      },
      {
        id: "ads_2",
        name: "Sommerkampanje - Ad Set 2",
        status: "active",
        dailyBudget: 75,
        bidAmount: 3.0,
        ads: [
          {
            id: "ad_3",
            name: "Sommerkampanje - Ad 3",
            status: "active",
            creative: {
              text: "Sommerens beste tilbud!",
              imageUrl: "https://example.com/summer3.jpg"
            }
          }
        ]
      }
    ]
  },
  {
    id: "987654321",
    name: "Vinterkampanje 2024",
    status: "paused",
    objective: "conversions",
    spend: 2000,
    impressions: 35000,
    clicks: 1800,
    conversions: 60,
    purchaseValue: 6000,
    roas: 3.0,
    adSets: [
      {
        id: "ads_3",
        name: "Vinterkampanje - Ad Set 1",
        status: "paused",
        dailyBudget: 100,
        bidAmount: 3.5,
        ads: [
          {
            id: "ad_4",
            name: "Vinterkampanje - Ad 1",
            status: "paused",
            creative: {
              text: "Vinterens beste tilbud!",
              imageUrl: "https://example.com/winter1.jpg"
            }
          }
        ]
      }
    ]
  },
  {
    id: "456789123",
    name: "Nyhetsbrev Kampanje",
    status: "completed",
    objective: "conversions",
    spend: 800,
    impressions: 15000,
    clicks: 900,
    conversions: 30,
    purchaseValue: 2400,
    roas: 3.0,
    adSets: [
      {
        id: "ads_4",
        name: "Nyhetsbrev - Ad Set 1",
        status: "completed",
        dailyBudget: 25,
        bidAmount: 2.0,
        ads: [
          {
            id: "ad_5",
            name: "Nyhetsbrev - Ad 1",
            status: "completed",
            creative: {
              text: "Meld deg på vårt nyhetsbrev!",
              imageUrl: "https://example.com/newsletter1.jpg"
            }
          }
        ]
      }
    ]
  }
]; 