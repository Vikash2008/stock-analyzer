// Mirrors PortfolioBundle fields serialized by backend/serializers.py

export interface Holding {
  portfolio:       string
  symbol:          string
  exchange:        string
  yf_symbol:       string
  currency:        'INR' | 'USD'
  quantity:        number
  avg_cost:        number
  total_invested:  number
  current_price:   number
  current_value:   number
  unrealized_pnl:  number
  pnl_pct:         number | null
  sector:          string | null
  company:         string | null
  name:            string | null
  disp_invested:   number
  disp_current:    number
  disp_gain:       number
  disp_pnl_pct:    number | null
  previous_close:  number | null
  today_gain:      number | null   // null when prev_close unavailable
  today_pct:       number | null
  disp_today_gain: number | null
}

export interface Transaction {
  portfolio: string
  symbol:    string
  exchange:  string
  yf_symbol: string
  currency:  'INR' | 'USD'
  type:      'BUY' | 'SELL' | 'DIVIDEND'
  date:      string           // ISO-8601
  quantity:  number
  price:     number
  charges:   number
  name:      string | null
}

export interface Realized {
  portfolio:    string
  symbol:       string
  exchange:     string
  currency:     'INR' | 'USD'
  type:         'SELL' | 'DIVIDEND'
  buy_date:     string | null  // ISO-8601 or null (DIVIDEND)
  sell_date:    string         // ISO-8601
  quantity:     number
  buy_price:    number
  sell_price:   number
  realized_pnl: number
}

export interface QuickStats {
  yf_symbol:            string
  currency:             'INR' | 'USD'
  trailing_pe:          number | null
  forward_pe:           number | null
  market_cap:           number | null
  market_cap_display:   string | null
  week_52_high:         number | null
  week_52_low:          number | null
  current_price:        number | null
  beta:                 number | null
  dividend_yield:       number | null
  target_mean_price:    number | null
  recommendation:       string | null
  num_analyst_opinions: number | null
  upside_pct:           number | null
  debt_to_equity:       number | null
  return_on_equity:     number | null
  return_on_assets:     number | null
  roce:                 number | null
  profit_margins:       number | null
  trailing_eps:         number | null
  revenue_growth:       number | null
  price_to_book:        number | null
  peg_ratio:            number | null
  earnings_growth:      number | null
  earnings_growth_3y:   number | null
  revenue_growth_3y:    number | null
  pe_history:           Array<{ date: string; pe: number; price: number | null; ttm_eps: number | null }> | null
  partial:              boolean
}

export interface PortfolioData {
  currency:            'INR' | 'USD'
  usd_inr:             number
  total_invested:      number
  total_current:       number
  total_gain:          number
  return_pct:          number
  as_of:               string         // ISO-8601
  all_portfolios:      string[]
  selected_portfolios: string[]
  cache_status:        string
  xirr_total:          number | null
  xirr_stk:            number | null
  xirr_mf:             number | null
  xirr_by_portfolio:   Record<string, number>
  holdings:            Holding[]
  transactions:        Transaction[]
  realized:            Realized[]
}
