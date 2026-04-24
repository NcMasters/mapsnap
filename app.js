/* MapSnap — Core Application */
(function() {
'use strict';

// ============ STATE ============
const state = {
    map: null,
    overlay: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.7, locked: false, imageData: null },
    gps: { active: false, watchId: null, lat: null, lng: null, accuracy: null },
    touch: { startX: 0, startY: 0, startDist: 0, startAngle: 0, startOvX: 0, startOvY: 0, startScale: 1, startRotation: 0, fingers: 0 },
    db: null,
    currentId: null
};

// ============ DOM REFS ============
const $ = id => document.getElementById(id);
const mapEl = $('map');
const overlayContainer = $('overlay-container');
const overlayImage = $('overlay-image');
const gpsMarker = $('gps-marker');
const controlsPanel = $('controls-panel');
const opacitySlider = $('opacity-slider');
const rotationSlider = $('rotation-slider');
const scaleSlider = $('scale-slider');
const opacityValue = $('opacity-value');
const rotationValue = $('rotation-value');
const scaleValue = $('scale-value');
const modalSource = $('modal-source');
const modalCrop = $('modal-crop');
const cropCanvas = $('crop-canvas');
const drawer = $('drawer');
const savedMapsList = $('saved-maps-list');
const toast = $('toast');
const toastMsg = $('toast-message');

// ============ i18n ============
const translations = {
    en: {
        controls_title: "Overlay Controls",
        label_opacity: "Opacity",
        label_rotation: "Rotation",
        label_scale: "Scale",
        btn_lock: "Lock overlay",
        btn_unlock: "Unlock overlay",
        btn_gps: "GPS Tracking",
        btn_stop_gps: "Stop GPS",
        btn_save: "Save map",
        btn_delete: "Delete",
        source_title: "Add map image",
        source_desc: "Take a photo of a physical map or choose from your gallery.",
        source_camera: "Camera",
        source_gallery: "Gallery",
        btn_cancel: "Cancel",
        crop_title: "Crop image",
        btn_use_image: "Use image",
        drawer_title: "My maps",
        section_language: "Language",
        empty_state: "No saved maps yet",
        empty_subtext: "Press + to add your first map",
        toast_saved: "✅ Map saved!",
        toast_deleted: "Map deleted",
        toast_gps_started: "📍 GPS tracking active",
        toast_gps_stopped: "GPS tracking stopped",
        toast_gps_error: "⚠️ GPS error: ",
        toast_gps_not_available: "⚠️ GPS not available",
        toast_lock_required: "⚠️ Lock overlay first!",
        toast_no_image: "⚠️ No image to save",
        toast_load_success: "Map loaded",
        toast_locked: "🔒 Overlay locked — map can now be moved",
        toast_unlocked: "🔓 Overlay unlocked — align mode",
        confirm_delete: "Are you sure you want to delete this map?",
        map_name_prefix: "Map "
    },
    da: {
        controls_title: "Overlay-kontroller",
        label_opacity: "Gennemsigtighed",
        label_rotation: "Rotation",
        label_scale: "Skalering",
        btn_lock: "Lås overlay",
        btn_unlock: "Oplås overlay",
        btn_gps: "GPS Tracking",
        btn_stop_gps: "Stop GPS",
        btn_save: "Gem kort",
        btn_delete: "Slet",
        source_title: "Tilføj kort-billede",
        source_desc: "Tag et billede af et fysisk kort, eller vælg fra dit galleri.",
        source_camera: "Kamera",
        source_gallery: "Galleri",
        btn_cancel: "Annuller",
        crop_title: "Beskær billede",
        btn_use_image: "Brug billede",
        drawer_title: "Mine kort",
        section_language: "Sprog",
        empty_state: "Ingen gemte kort endnu",
        empty_subtext: "Tryk + for at tilføje dit første kort",
        toast_saved: "✅ Kort gemt!",
        toast_deleted: "Kort slettet",
        toast_gps_started: "📍 GPS tracking aktiv",
        toast_gps_stopped: "GPS tracking stoppet",
        toast_gps_error: "⚠️ GPS fejl: ",
        toast_gps_not_available: "⚠️ GPS ikke tilgængelig",
        toast_lock_required: "⚠️ Lås overlay først!",
        toast_no_image: "⚠️ Intet billede at gemme",
        toast_load_success: "Kort indlæst",
        toast_locked: "🔒 Overlay låst — kortet kan nu flyttes",
        toast_unlocked: "🔓 Overlay oplåst — justeringstilstand",
        confirm_delete: "Er du sikker på, at du vil slette dette kort?",
        map_name_prefix: "Kort "
    }
};

function init() {
    initMap();
    initEventListeners();
    initDB();
    setLanguage(state.currentLanguage);
}

function setLanguage(lang) {
    state.currentLanguage = lang;
    localStorage.setItem('mapsnap_lang', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            if (el.tagName === 'SPAN' || el.children.length === 0) {
                el.textContent = translations[lang][key];
            } else {
                const span = el.querySelector('span');
                if (span) span.textContent = translations[lang][key];
                else {
                    for (let node of el.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                            node.textContent = translations[lang][key];
                            break;
                        }
                    }
                }
            }
        }
    });

    updateLockUI();
    updateGPSUI();
    renderSavedMaps();
    
    $('btn-lang-en').classList.toggle('active', lang === 'en');
    $('btn-lang-da').classList.toggle('active', lang === 'da');
}

function updateGPSUI() {
    const btn = $('btn-gps');
    if (state.gps.active) {
        btn.classList.add('active');
        btn.querySelector('span').textContent = translations[state.currentLanguage].btn_stop_gps;
    } else {
        btn.classList.remove('active');
        btn.querySelector('span').textContent = translations[state.currentLanguage].btn_gps;
    }
}

function initMap() {
    state.map = L.map('map', {
        center: [55.676, 12.568],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
        className: 'map-tiles-dark' // Added for CSS filtering
    }).addTo(state.map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(state.map);
    // Update overlay position when map moves
    state.map.on('move zoom moveend zoomend', updateOverlayPosition);
}

// ============ IndexedDB ============
function initDB() {
    const req = indexedDB.open('MapSnapDB', 1);
    req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('overlays')) {
            const store = db.createObjectStore('overlays', { keyPath: 'id', autoIncrement: true });
            store.createIndex('created', 'created');
        }
    };
    req.onsuccess = e => { state.db = e.target.result; };
    req.onerror = () => { console.error('DB error'); };
}

function dbSave(data) {
    return new Promise((resolve, reject) => {
        if (!state.db) return reject('No DB');
        const tx = state.db.transaction('overlays', 'readwrite');
        const store = tx.objectStore('overlays');
        const req = data.id ? store.put(data) : store.add(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbGetAll() {
    return new Promise((resolve, reject) => {
        if (!state.db) return resolve([]);
        const tx = state.db.transaction('overlays', 'readonly');
        const req = tx.objectStore('overlays').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbDelete(id) {
    return new Promise((resolve, reject) => {
        if (!state.db) return reject('No DB');
        const tx = state.db.transaction('overlays', 'readwrite');
        tx.objectStore('overlays').delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
    });
}

// ============ EVENTS ============
function bindEvents() {
    // Top bar
    $('btn-menu').onclick = openDrawer;
    $('btn-add').onclick = () => showModal(modalSource);

    // Source modal
    $('btn-camera').onclick = () => { hideModal(modalSource); $('camera-input').click(); };
    $('btn-gallery').onclick = () => { hideModal(modalSource); $('file-input').click(); };
    $('btn-cancel-source').onclick = () => hideModal(modalSource);
    modalSource.querySelector('.modal-backdrop').onclick = () => hideModal(modalSource);

    // File inputs
    $('file-input').onchange = handleFileSelect;
    $('camera-input').onchange = handleFileSelect;

    // Crop modal
    $('btn-crop-cancel').onclick = () => hideModal(modalCrop);
    $('btn-crop-confirm').onclick = confirmCrop;
    modalCrop.querySelector('.modal-backdrop').onclick = () => hideModal(modalCrop);

    // Controls
    $('btn-close-controls').onclick = () => controlsPanel.classList.add('hidden');
    opacitySlider.oninput = () => { state.overlay.opacity = opacitySlider.value / 100; opacityValue.textContent = opacitySlider.value + '%'; applyOverlayTransform(); };
    rotationSlider.oninput = () => { state.overlay.rotation = parseFloat(rotationSlider.value); rotationValue.textContent = rotationSlider.value + '°'; applyOverlayTransform(); };
    scaleSlider.oninput = () => { state.overlay.scale = scaleSlider.value / 100; scaleValue.textContent = scaleSlider.value + '%'; applyOverlayTransform(); };

    // Action buttons
    $('btn-lock').onclick = toggleLock;
    $('btn-gps').onclick = toggleGPS;
    $('btn-save').onclick = saveOverlay;
    $('btn-delete').onclick = deleteOverlay;

    // Drawer
    $('btn-close-drawer').onclick = closeDrawer;
    drawer.querySelector('.drawer-backdrop').onclick = closeDrawer;

    // Touch gestures on overlay
    overlayContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    overlayContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    overlayContainer.addEventListener('touchend', onTouchEnd, { passive: false });

    // Mouse fallback for desktop
    overlayContainer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// ============ FILE / IMAGE ============
function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    hideModal(modalSource); // Ensure source modal is hidden
    const reader = new FileReader();
    reader.onload = ev => showCropModal(ev.target.result);
    reader.readAsDataURL(file);
}

let cropImageSrc = null;
let cropRect = { x: 0, y: 0, w: 0, h: 0, origX: 0, origY: 0, origW: 0, origH: 0 };
let cropDragMode = null; // 'move', 'tl', 'tr', 'bl', 'br'
let cropStartX = 0, cropStartY = 0;

function showCropModal(src) {
    cropImageSrc = src;
    showModal(modalCrop);
    const img = new Image();
    img.onload = () => {
        const ctx = cropCanvas.getContext('2d');
        const maxW = Math.min(window.innerWidth * 0.85, 600);
        const maxH = window.innerHeight * 0.55;
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        w *= ratio; h *= ratio;
        cropCanvas.width = w;
        cropCanvas.height = h;
        $('crop-area').style.width = w + 'px';
        $('crop-area').style.height = h + 'px';
        ctx.drawImage(img, 0, 0, w, h);
        
        const sel = $('crop-selection');
        const margin = Math.min(w, h) * 0.1;
        cropRect = { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 };
        sel.style.display = 'block';
        updateCropSelection();
        
        sel.onmousedown = sel.ontouchstart = startCropDrag;
        document.onmousemove = document.ontouchmove = moveCropDrag;
        document.onmouseup = document.ontouchend = endCropDrag;
    };
    img.src = src;
}

function updateCropSelection() {
    const sel = $('crop-selection');
    sel.style.left = cropRect.x + 'px';
    sel.style.top = cropRect.y + 'px';
    sel.style.width = cropRect.w + 'px';
    sel.style.height = cropRect.h + 'px';

    $('crop-mask-top').style.height = cropRect.y + 'px';
    $('crop-mask-bottom').style.top = (cropRect.y + cropRect.h) + 'px';
    $('crop-mask-left').style.top = cropRect.y + 'px';
    $('crop-mask-left').style.height = cropRect.h + 'px';
    $('crop-mask-left').style.width = cropRect.x + 'px';
    $('crop-mask-right').style.top = cropRect.y + 'px';
    $('crop-mask-right').style.height = cropRect.h + 'px';
    $('crop-mask-right').style.left = (cropRect.x + cropRect.w) + 'px';
}

function startCropDrag(e) {
    if (!modalCrop.classList.contains('hidden') && e.target.closest('#crop-area')) {
        e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        if (e.target.classList.contains('crop-handle')) {
            cropDragMode = e.target.dataset.handle;
        } else {
            cropDragMode = 'move';
        }
        cropStartX = pt.clientX;
        cropStartY = pt.clientY;
        cropRect.origX = cropRect.x;
        cropRect.origY = cropRect.y;
        cropRect.origW = cropRect.w;
        cropRect.origH = cropRect.h;
    }
}

function moveCropDrag(e) {
    if (!cropDragMode) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - cropStartX;
    const dy = pt.clientY - cropStartY;
    const minSize = 40;
    
    if (cropDragMode === 'move') {
        cropRect.x = Math.max(0, Math.min(cropCanvas.width - cropRect.w, cropRect.origX + dx));
        cropRect.y = Math.max(0, Math.min(cropCanvas.height - cropRect.h, cropRect.origY + dy));
    } else {
        if (cropDragMode.includes('l')) {
            const newX = Math.min(cropRect.origX + cropRect.origW - minSize, Math.max(0, cropRect.origX + dx));
            cropRect.w = cropRect.origX + cropRect.origW - newX;
            cropRect.x = newX;
        }
        if (cropDragMode.includes('r')) {
            cropRect.w = Math.max(minSize, Math.min(cropCanvas.width - cropRect.origX, cropRect.origW + dx));
        }
        if (cropDragMode.includes('t')) {
            const newY = Math.min(cropRect.origY + cropRect.origH - minSize, Math.max(0, cropRect.origY + dy));
            cropRect.h = cropRect.origY + cropRect.origH - newY;
            cropRect.y = newY;
        }
        if (cropDragMode.includes('b')) {
            cropRect.h = Math.max(minSize, Math.min(cropCanvas.height - cropRect.origY, cropRect.origH + dy));
        }
    }
    updateCropSelection();
}

function endCropDrag() { cropDragMode = null; }

function confirmCrop() {
    const img = new Image();
    img.onload = () => {
        const scaleX = img.width / cropCanvas.width;
        const scaleY = img.height / cropCanvas.height;
        const c = document.createElement('canvas');
        c.width = cropRect.w * scaleX;
        c.height = cropRect.h * scaleY;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, cropRect.x * scaleX, cropRect.y * scaleY, c.width, c.height, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        hideModal(modalCrop);
        loadOverlayImage(dataUrl);
    };
    img.src = cropImageSrc;
}

// ============ OVERLAY ============
function loadOverlayImage(dataUrl) {
    state.overlay.imageData = dataUrl;
    state.overlay.x = 0;
    state.overlay.y = 0;
    state.overlay.scale = 1;
    state.overlay.rotation = 0;
    state.overlay.opacity = 0.7;
    state.overlay.locked = false;
    state.currentId = null;

    overlayImage.onload = () => {
        overlayImage.classList.add('visible');
        overlayContainer.classList.add('interactive');
        controlsPanel.classList.remove('hidden');
        syncSliders();
        applyOverlayTransform();
        showToast('Justér billedet så det passer med kortet');
    };
    overlayImage.src = dataUrl;
}

function syncSliders() {
    opacitySlider.value = Math.round(state.overlay.opacity * 100);
    opacityValue.textContent = opacitySlider.value + '%';
    rotationSlider.value = state.overlay.rotation;
    rotationValue.textContent = state.overlay.rotation.toFixed(1) + '°';
    scaleSlider.value = Math.round(state.overlay.scale * 100);
    scaleValue.textContent = scaleSlider.value + '%';
}

function applyOverlayTransform() {
    if (!overlayImage.naturalWidth) return;
    const mapSize = state.map.getSize();
    const cx = mapSize.x / 2 + state.overlay.x;
    const cy = mapSize.y / 2 + state.overlay.y;
    const s = state.overlay.scale;
    const r = state.overlay.rotation;
    const w = overlayImage.naturalWidth;
    const h = overlayImage.naturalHeight;
    overlayImage.style.left = (cx - w / 2) + 'px';
    overlayImage.style.top = (cy - h / 2) + 'px';
    overlayImage.style.width = w + 'px';
    overlayImage.style.height = h + 'px';
    overlayImage.style.transform = `rotate(${r}deg) scale(${s})`;
    overlayImage.style.opacity = state.overlay.opacity;
}

function updateOverlayPosition() {
    if (!state.overlay.locked || !state.overlay._anchorLatLng) return;
    // When locked, overlay follows the map
    const anchor = state.map.latLngToContainerPoint(state.overlay._anchorLatLng);
    const mapSize = state.map.getSize();
    state.overlay.x = anchor.x - mapSize.x / 2;
    state.overlay.y = anchor.y - mapSize.y / 2;
    // Adjust scale based on zoom change
    const zoomDiff = state.map.getZoom() - state.overlay._anchorZoom;
    const effectiveScale = state.overlay._baseScale * Math.pow(2, zoomDiff);
    overlayImage.style.left = (anchor.x - overlayImage.naturalWidth / 2) + 'px';
    overlayImage.style.top = (anchor.y - overlayImage.naturalHeight / 2) + 'px';
    overlayImage.style.transform = `rotate(${state.overlay.rotation}deg) scale(${effectiveScale})`;
    overlayImage.style.opacity = state.overlay.opacity;
    updateGPSMarker();
}

// ============ TOUCH GESTURES ============
let mouseDragging = false;

function onTouchStart(e) {
    if (state.overlay.locked) return;
    if (!overlayImage.classList.contains('visible')) return;
    e.preventDefault();
    const touches = e.touches;
    state.touch.fingers = touches.length;
    if (touches.length === 1) {
        state.touch.startX = touches[0].clientX;
        state.touch.startY = touches[0].clientY;
        state.touch.startOvX = state.overlay.x;
        state.touch.startOvY = state.overlay.y;
    } else if (touches.length === 2) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        state.touch.startDist = Math.sqrt(dx * dx + dy * dy);
        state.touch.startAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        state.touch.startScale = state.overlay.scale;
        state.touch.startRotation = state.overlay.rotation;
        state.touch.startX = (touches[0].clientX + touches[1].clientX) / 2;
        state.touch.startY = (touches[0].clientY + touches[1].clientY) / 2;
        state.touch.startOvX = state.overlay.x;
        state.touch.startOvY = state.overlay.y;
    }
}

function onTouchMove(e) {
    if (state.overlay.locked) return;
    if (!overlayImage.classList.contains('visible')) return;
    e.preventDefault();
    const touches = e.touches;
    if (touches.length === 1 && state.touch.fingers === 1) {
        state.overlay.x = state.touch.startOvX + (touches[0].clientX - state.touch.startX);
        state.overlay.y = state.touch.startOvY + (touches[0].clientY - state.touch.startY);
        applyOverlayTransform();
    } else if (touches.length === 2) {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        // Scale
        state.overlay.scale = state.touch.startScale * (dist / state.touch.startDist);
        state.overlay.scale = Math.max(0.1, Math.min(5, state.overlay.scale));
        // Rotation
        state.overlay.rotation = state.touch.startRotation + (angle - state.touch.startAngle);
        // Pan (midpoint)
        const mx = (touches[0].clientX + touches[1].clientX) / 2;
        const my = (touches[0].clientY + touches[1].clientY) / 2;
        state.overlay.x = state.touch.startOvX + (mx - state.touch.startX);
        state.overlay.y = state.touch.startOvY + (my - state.touch.startY);
        syncSliders();
        applyOverlayTransform();
    }
}

function onTouchEnd(e) {
    state.touch.fingers = e.touches.length;
}

function onMouseDown(e) {
    if (state.overlay.locked) return;
    if (!overlayImage.classList.contains('visible')) return;
    e.preventDefault();
    mouseDragging = true;
    state.touch.startX = e.clientX;
    state.touch.startY = e.clientY;
    state.touch.startOvX = state.overlay.x;
    state.touch.startOvY = state.overlay.y;
}

function onMouseMove(e) {
    if (!mouseDragging) return;
    state.overlay.x = state.touch.startOvX + (e.clientX - state.touch.startX);
    state.overlay.y = state.touch.startOvY + (e.clientY - state.touch.startY);
function onMouseUp() { mouseDragging = false; }

// ============ LOCK / UNLOCK ============
function toggleLock() {
    state.overlay.locked = !state.overlay.locked;
    updateLockUI();
}

function updateLockUI() {
    const btn = $('btn-lock');
    if (state.overlay.locked) {
        const mapSize = state.map.getSize();
        const cx = mapSize.x / 2 + state.overlay.x;
        const cy = mapSize.y / 2 + state.overlay.y;
        state.overlay._anchorLatLng = state.map.containerPointToLatLng([cx, cy]);
        state.overlay._anchorZoom = state.map.getZoom();
        state.overlay._baseScale = state.overlay.scale;
        overlayContainer.classList.remove('interactive');
        btn.classList.add('locked');
        btn.querySelector('span').textContent = translations[state.currentLanguage].btn_unlock;
        state.map.dragging.enable();
        state.map.touchZoom.enable();
        state.map.doubleClickZoom.enable();
        state.map.scrollWheelZoom.enable();
        showToast(translations[state.currentLanguage].toast_locked);
    } else {
        delete state.overlay._anchorLatLng;
        delete state.overlay._anchorZoom;
        delete state.overlay._baseScale;
        overlayContainer.classList.add('interactive');
        btn.classList.remove('locked');
        btn.querySelector('span').textContent = 'Lås overlay';
        showToast('🔓 Overlay oplåst — justér billedet');
    }
}

// ============ GPS ============
function toggleGPS() {
    const btn = $('btn-gps');
    const lang = state.currentLanguage;
    if (state.gps.active) {
        if (state.gps.watchId !== null) navigator.geolocation.clearWatch(state.gps.watchId);
        state.gps.active = false;
        state.gps.watchId = null;
        gpsMarker.classList.add('hidden');
        updateGPSUI();
        showToast(translations[lang].toast_gps_stopped);
        return;
    }
    if (!navigator.geolocation) { showToast(translations[lang].toast_gps_not_available); return; }
    if (!state.overlay.locked) { showToast(translations[lang].toast_lock_required); return; }
    state.gps.active = true;
    updateGPSUI();
    showToast(translations[lang].toast_gps_started);
    state.gps.watchId = navigator.geolocation.watchPosition(
        pos => {
            state.gps.lat = pos.coords.latitude;
            state.gps.lng = pos.coords.longitude;
            state.gps.accuracy = pos.coords.accuracy;
            updateGPSMarker();
        },
        err => { showToast(translations[lang].toast_gps_error + err.message); },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
}

function updateGPSMarker() {
    if (!state.gps.active || state.gps.lat === null) return;
    if (!state.overlay.locked || !state.overlay._anchorLatLng) return;
    const screenPt = state.map.latLngToContainerPoint([state.gps.lat, state.gps.lng]);
    gpsMarker.classList.remove('hidden');
    gpsMarker.style.left = screenPt.x + 'px';
    gpsMarker.style.top = screenPt.y + 'px';
    if (state.gps.accuracy) {
        const metersPerPixel = 40075016.686 * Math.cos(state.gps.lat * Math.PI / 180) / Math.pow(2, state.map.getZoom() + 8);
        const accPx = Math.max(20, state.gps.accuracy / metersPerPixel);
        const accEl = gpsMarker.querySelector('.gps-marker-accuracy');
        accEl.style.width = accPx * 2 + 'px';
        accEl.style.height = accPx * 2 + 'px';
    }
}

// ============ SAVE / LOAD / DELETE ============
async function saveOverlay() {
    const lang = state.currentLanguage;
    if (!state.overlay.imageData) { showToast(translations[lang].toast_no_image); return; }
    const center = state.map.getCenter();
    const data = {
        name: translations[lang].map_name_prefix + new Date().toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-US'),
        imageData: state.overlay.imageData,
        x: state.overlay.x,
        y: state.overlay.y,
        scale: state.overlay.scale,
        rotation: state.overlay.rotation,
        opacity: state.overlay.opacity,
        locked: state.overlay.locked,
        anchorLat: state.overlay._anchorLatLng ? state.overlay._anchorLatLng.lat : center.lat,
        anchorLng: state.overlay._anchorLatLng ? state.overlay._anchorLatLng.lng : center.lng,
        anchorZoom: state.overlay._anchorZoom || state.map.getZoom(),
        baseScale: state.overlay._baseScale || state.overlay.scale,
        mapCenter: [center.lat, center.lng],
        mapZoom: state.map.getZoom(),
        created: Date.now()
    };
    if (state.currentId) data.id = state.currentId;
    try {
        const id = await dbSave(data);
        state.currentId = id || state.currentId;
        showToast(translations[lang].toast_saved);
    } catch (e) {
        showToast('⚠️ Error: ' + e);
    }
}

async function loadOverlay(id) {
    const lang = state.currentLanguage;
    const all = await dbGetAll();
    const data = all.find(o => o.id === id);
    if (!data) return;
    state.currentId = data.id;
    state.overlay.x = data.x;
    state.overlay.y = data.y;
    state.overlay.scale = data.scale;
    state.overlay.rotation = data.rotation;
    state.overlay.opacity = data.opacity;
    state.overlay.imageData = data.imageData;
    state.overlay.locked = false;
    state.map.setView(data.mapCenter, data.mapZoom, { animate: false });
    overlayImage.onload = () => {
        overlayImage.classList.add('visible');
        controlsPanel.classList.remove('hidden');
        syncSliders();
        if (data.locked && data.anchorLat != null) {
            applyOverlayTransform();
            state.overlay._anchorLatLng = L.latLng(data.anchorLat, data.anchorLng);
            state.overlay._anchorZoom = data.anchorZoom;
            state.overlay._baseScale = data.baseScale;
            state.overlay.locked = true;
            updateLockUI();
            updateOverlayPosition();
        } else {
            overlayContainer.classList.add('interactive');
            applyOverlayTransform();
        }
    };
    overlayImage.src = data.imageData;
    hideDrawer();
    showToast(translations[lang].toast_load_success);
}

async function deleteOverlay() {
    const lang = state.currentLanguage;
    if (!state.overlay.imageData) return;
    if (!confirm(translations[lang].confirm_delete)) return;
    if (state.currentId) {
        await dbDelete(state.currentId);
    }
    overlayImage.classList.remove('visible');
    overlayImage.src = '';
    overlayContainer.classList.remove('interactive');
    controlsPanel.classList.add('hidden');
    gpsMarker.classList.add('hidden');
    if (state.gps.watchId !== null) navigator.geolocation.clearWatch(state.gps.watchId);
    state.gps.active = false;
    state.overlay = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.7, locked: false, imageData: null };
    state.currentId = null;
    updateLockUI();
    updateGPSUI();
    showToast(translations[lang].toast_deleted);
    renderSavedMaps();
}

// ============ DRAWER ============
async function openDrawer() {
    drawer.classList.remove('hidden');
    const overlays = await dbGetAll();
    if (overlays.length === 0) {
        savedMapsList.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><p>Ingen gemte kort endnu</p><p class="subtext">Tryk + for at tilføje dit første kort</p></div>';
        return;
    }
    savedMapsList.innerHTML = overlays.sort((a, b) => b.created - a.created).map(o => {
        const date = new Date(o.created).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const lat = (o.anchorLat || o.mapCenter[0]).toFixed(4);
        const lng = (o.anchorLng || o.mapCenter[1]).toFixed(4);
        return `<div class="saved-map-card" data-id="${o.id}">
            <img class="saved-map-thumb" src="${o.imageData}" alt="${o.name}">
            <div class="saved-map-info">
                <div class="saved-map-name">${o.name}</div>
                <div class="saved-map-date">${date}</div>
                <div class="saved-map-coords">${lat}, ${lng}</div>
            </div>
        </div>`;
    }).join('');
    savedMapsList.querySelectorAll('.saved-map-card').forEach(card => {
        card.onclick = () => loadOverlay(parseInt(card.dataset.id));
    });
}

function closeDrawer() { drawer.classList.add('hidden'); }

// ============ MODALS ============
function showModal(el) { el.classList.remove('hidden'); }
function hideModal(el) { el.classList.add('hidden'); }

// ============ TOAST ============
let toastTimer = null;
function showToast(msg) {
    clearTimeout(toastTimer);
    toastMsg.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
        toast.classList.add('hidden');
    }, 3000);
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', init);

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
