import { onRequest as __api_etf_watchlist_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\etf-watchlist.js"
import { onRequest as __api_etf_watchlist_refresh_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\etf-watchlist-refresh.js"
import { onRequest as __api_fed_meeting_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\fed-meeting.js"
import { onRequest as __api_fed_rate_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\fed-rate.js"
import { onRequest as __api_forex_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\forex.js"
import { onRequest as __api_ief_yield_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\ief-yield.js"
import { onRequest as __api_ivv_weekly_net_return_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\ivv-weekly-net-return.js"
import { onRequest as __api_stock_js_onRequest } from "C:\\Users\\Gabo\\OneDrive\\Repo\\Dashboard\\functions\\api\\stock.js"

export const routes = [
    {
      routePath: "/api/etf-watchlist",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_etf_watchlist_js_onRequest],
    },
  {
      routePath: "/api/etf-watchlist-refresh",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_etf_watchlist_refresh_js_onRequest],
    },
  {
      routePath: "/api/fed-meeting",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_fed_meeting_js_onRequest],
    },
  {
      routePath: "/api/fed-rate",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_fed_rate_js_onRequest],
    },
  {
      routePath: "/api/forex",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_forex_js_onRequest],
    },
  {
      routePath: "/api/ief-yield",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_ief_yield_js_onRequest],
    },
  {
      routePath: "/api/ivv-weekly-net-return",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_ivv_weekly_net_return_js_onRequest],
    },
  {
      routePath: "/api/stock",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_stock_js_onRequest],
    },
  ]