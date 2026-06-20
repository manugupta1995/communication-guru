// Monetization config. The app is 100% client-side, so the only real cost is
// hosting (a static site = effectively free). That makes even a low price
// almost pure margin.
//
// CHECKOUT_URL: set this to a real payment link (Stripe Payment Link, Gumroad,
// Lemon Squeezy, or Razorpay for India) — no backend needed. After paying,
// users return and unlock with the code below (or wire a license check later).

export const PRICING = {
  proMonthlyINR: 399,
  proMonthlyUSD: 6,
  proAnnualINR: 2999,
}

// TODO(manu): replace with your live payment link before launch.
export const CHECKOUT_URL = 'https://example.gumroad.com/l/communication-guru'

// Simple post-purchase unlock for the no-backend MVP. Swap for a real license
// check when you add a backend.
export const UNLOCK_CODE = 'GURU-PRO'

export const PRO_BENEFITS = [
  'Unlimited practice sessions',
  'Full progress history + trends',
  'All rhetoric techniques & drills',
  'Early access to Style, Invention & Memory layers',
]
