const GAS_DEPLOYMENT_ID = 'AKfycbyoisQO8KNvO2eMyUnmwBzDQQ_5FJ3C98lNuZsty_Z3GuaJ2he0kLDPOqMh8DapozLCWQ';
const GAS_WEB_APP_URL = `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

const GAS_WEB_APP_URLS = [GAS_WEB_APP_URL];

console.log('TripSplit GAS endpoint:', GAS_WEB_APP_URL);

//const GAS_WEB_APP_URLS = [normalizeGasUrl(GAS_WEB_APP_URL)].filter(Boolean);

function buildGasUrl(baseUrl, query) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${query.toString()}`;
}

let currentTripId = localStorage.getItem('tripsplit_current_trip_id') || 'trip_default';
let shouldSelectLatestTripOnLoad = true;

let trips = [
  { id: 'trip_default', name: '東京五日遊', baseCurrency: 'TWD' },
  { id: 'trip_osaka', name: '大阪七日遊', baseCurrency: 'TWD' }
];
let archivedTrips = [];
let members = [];
let categories = [];
let paymentMethods = [];
let expenses = [];
let expenseReceipts = [];
let selectedReceiptFiles = [];
let exchangeRates = { JPY: 0.2185, USD: 32.1, KRW: 0.0235, EUR: 34.8, THB: 0.88, TWD: 1 };

const MAX_RECEIPT_FILES = 4;

const fallbackDataByTrip = {
  trip_default: {
    members: [
      { id: 'mem_1', name: 'Dustin', note: '發起人', avatar: 'D' },
      { id: 'mem_2', name: 'Amy', note: '旅伴', avatar: 'A' },
      { id: 'mem_3', name: 'Ben', note: '旅伴', avatar: 'B' },
      { id: 'mem_4', name: 'Cindy', note: '旅伴', avatar: 'C' }
    ],
    categories: [
      { id: 'cat_1', name: '餐飲', icon: '🍜', note: '預設分類' },
      { id: 'cat_2', name: '早餐', icon: '🍳', note: '自訂分類' },
      { id: 'cat_3', name: '門票', icon: '🎟', note: '自訂分類' },
      { id: 'cat_4', name: '交通', icon: '🚆', note: '預設分類' }
    ],
    paymentMethods: [
      { id: 'pay_1', name: '現金', icon: '💵', note: '預設方式' },
      { id: 'pay_2', name: 'Visa', icon: '💳', note: '信用卡' },
      { id: 'pay_3', name: 'LINE Pay', icon: '📱', note: '行動支付' }
    ],
    expenses: [
      { title: '築地早餐', icon: '🍳', payer: 'Dustin', category: '早餐', payment: 'Visa', currency: 'JPY', amount: 12000, rate: 0.2185, twd: 2622, split: '平均分' }
    ]
  },
  trip_osaka: {
    members: [{ id: 'mem_o1', name: 'Dustin', note: '發起人', avatar: 'D' }],
    categories: [{ id: 'cat_o1', name: '餐飲', icon: '🍜', note: '預設分類' }],
    paymentMethods: [{ id: 'pay_o1', name: '現金', icon: '💵', note: '預設方式' }],
    expenses: []
  }
};

const money = new Intl.NumberFormat('zh-TW');
const $ = (selector) => document.querySelector(selector);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
