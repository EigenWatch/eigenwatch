export const defaultBetaPerks = [
  {
    key: "free_pro_month",
    description: "One month of full free Pro access for beta testers",
    is_active: false,
    config: {},
  },
  {
    key: "discounted_pro",
    description: "Discounted Pro subscription for beta testers",
    is_active: false,
    config: {
      enabled: true,
      discount_percent: 50,
    },
  },
];
