/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === '1';
const previewTripIdFromUrl = getPreviewTripIdFromUrl();
const storedTripId = localStorage.getItem('tripsplit_current_trip_id');
const storedTripSelectionMode = localStorage.getItem(TRIP_SELECTION_MODE_KEY);
let currentTripId = isPreviewMode ? previewTripIdFromUrl : (storedTripId || 'trip_default');
let shouldSelectLatestTripOnLoad = !isPreviewMode && storedTripSelectionMode !== 'manual';

let trips = [
    { id: 'trip_default', name: '東京五日遊', baseCurrency: 'TWD' },
    { id: 'trip_osaka', name: '大阪七日遊', baseCurrency: 'TWD' }
];
let archivedTrips = [];
let members = [];
let categories = [];
let paymentMethods = [];
let expenses = [];
let selectedCategory = '';
let expenseReceipts = [];
let expenseParticipants = [];
let selectedReceiptFiles = [];
let selectedReceiptUploadFiles = [];
let activeReceiptUploadExpenseId = '';
let exchangeRates = { JPY: 0.2185, USD: 32.1, KRW: 0.0235, EUR: 34.8, THB: 0.88, TWD: 1 };
let activeLoadToken = 0;

function currentTrip() {
    const activeTrip = trips.find(trip => trip.id === currentTripId);
    if (activeTrip) return activeTrip;

    if (isPreviewMode) {
        const archivedTrip = archivedTrips.find(trip => trip.id === currentTripId);
        if (archivedTrip) return archivedTrip;
        return {
            id: currentTripId || '',
            name: currentTripId ? `帳本 ${currentTripId}` : '未指定帳本',
            baseCurrency: 'TWD'
        };
    }

    return trips[0] || { id: currentTripId || '', name: 'TripSplit', baseCurrency: 'TWD' };
}

function clearLoadedTripData() {
    members = [];
    categories = [];
    paymentMethods = [];
    expenses = [];
    expenseReceipts = [];
    expenseParticipants = [];
}

let expenseSearchTerm = '';
let expenseFilters = {
    quickDate: '',
    category: '',
    payer: '',
    payment: '',
    from: '',
    to: ''
};
const EXPENSE_TABLE_PAGE_SIZE = 10;
let expenseViewMode = 'card';
let expenseTablePage = 1;
let selectedExpenseTableDetailId = '';
let expandedExpenseIds = new Set();
let expandedMergedNoteIds = new Set();
let openExpenseMenuId = '';
let pendingExpenseResetCurrency = '';
let activeEditingExpenseId = '';
