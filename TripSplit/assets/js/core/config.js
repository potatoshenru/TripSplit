/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
const GAS_DEPLOYMENT_ID = 'AKfycbyvVW8qaErMom9RNLKsjlGJbOOcHq1byNysDAHqwNmMbpUHABC4uosTieBsMpq0bVTBgg';
const GAS_WEB_APP_URL = `https://script.google.com/macros/s/${GAS_DEPLOYMENT_ID}/exec`;

const GAS_WEB_APP_URLS = [GAS_WEB_APP_URL];

console.log('TripSplit GAS endpoint:', GAS_WEB_APP_URL);


const TRIP_SELECTION_MODE_KEY = 'tripsplit_trip_selection_mode';
const READONLY_GAS_ACTIONS = new Set(['getTrips', 'getArchivedTrips', 'getInitialData']);
const PREVIEW_MUTATION_SELECTOR = [
    '[data-delete-expense]',
    '[data-edit-expense]',
    '[data-open-receipt-upload]',
    '#receipt-upload-submit',
    '[data-remove-upload-preview-index]',
    '[data-remove-preview-index]',
    '#archive-trip-btn',
    '[data-unarchive-trip]',
    '[data-remove]',
    '#open-import-text-btn',
    '#parse-import-text-btn',
    '#import-text-current-btn',
    '#import-text-merge-btn',
    '[data-import-select]',
    '[data-import-item]',
    '[data-remove-import-item]'
].join(',');

const MAX_RECEIPT_FILES = 10;
const TRIP_DATA_CACHE_VERSION = 1;
const TRIP_DATA_CACHE_PREFIX = 'tripsplit_cache_';

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
