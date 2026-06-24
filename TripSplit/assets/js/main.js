/* TripSplit module split from assets/app.js. Keep classic script order in HTML. */
(async function init() {
    bindAppEvents();
    renderAll();
    await loadTrips();
    await loadCurrentTripData();
})();
