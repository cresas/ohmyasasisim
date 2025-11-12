// Ohm Yasası Simülasyonu - Vanilla JavaScript Implementation

// ============================================================================
// State Management Store
// ============================================================================

function createStore(initialState) {
    let state = { ...initialState };
    const listeners = new Map();
    let listenerId = 0;

    return {
        getState: () => ({ ...state }),
        
        setState: (partial) => {
            const prevState = { ...state };
            state = { ...state, ...partial };
            
            // Notify subscribers
            listeners.forEach((callback, id) => {
                callback(state, prevState);
            });
        },
        
        subscribe: (callback) => {
            const id = listenerId++;
            listeners.set(id, callback);
            return () => listeners.delete(id);
        }
    };
}

// ============================================================================
// Application State
// ============================================================================

const LAMP_RESISTANCE = 8;

const store = createStore({
    voltage: 5,
    resistance: 10,
    measurements: [],
    measurementCounter: 1,
    probes: {
        red: { x: 200, y: 150, connectedTo: null },
        black: { x: 200, y: 200, connectedTo: null }
    },
    voltmeterDevice: { x: 300, y: 300 },
    ammeterDevice: { x: 180, y: 250 },
    notes: '',
    savedNotes: '',
    lastSaved: null
});

// ============================================================================
// Selectors (Computed Values)
// ============================================================================

function getTotalResistance(state) {
    return state.resistance + LAMP_RESISTANCE;
}

function getCurrent(state) {
    return state.voltage / getTotalResistance(state);
}

function getVoltmeterReading(state) {
    const { probes } = state;
    const redProbe = probes.red;
    const blackProbe = probes.black;
    
    if (!redProbe.connectedTo || !blackProbe.connectedTo) return 0;
    
    const voltage = state.voltage;
    const resistance = state.resistance;
    const current = getCurrent(state);
    
    const getPotentialAtPoint = (x, y) => {
        // Upper wire
        if (y >= 65 && y <= 160 && x >= 80 && x <= 500) {
            if (x <= 190) return voltage;
            if (x >= 320) return voltage - (current * resistance);
            const progress = (x - 190) / (320 - 190);
            return voltage - (current * resistance * progress);
        }
        
        // Right wire - lamp area
        if (x >= 380 && x <= 500 && y >= 80 && y <= 280) {
            if (y <= 160) return voltage - (current * resistance);
            if (y >= 210) return 0;
            const progress = (y - 160) / (210 - 160);
            return (voltage - (current * resistance)) - (current * LAMP_RESISTANCE * progress);
        }
        
        // Lamp perimeter
        if (x >= 380 && x <= 500 && y >= 100 && y <= 260) {
            if (y <= 175) return voltage - (current * resistance);
            return 0;
        }
        
        // Bottom wire
        if (y >= 255 && y <= 285 && x >= 80 && x <= 420) {
            return 0;
        }
        
        // Left wire - battery
        if (x >= 45 && x <= 75 && y >= 100 && y <= 250) {
            if (y >= 195) return 0;
            if (y <= 165) return voltage;
            return voltage * (1 - (y - 165) / (195 - 165));
        }
        
        return 0;
    };
    
    const redPotential = getPotentialAtPoint(redProbe.x, redProbe.y);
    const blackPotential = getPotentialAtPoint(blackProbe.x, blackProbe.y);
    
    return redPotential - blackPotential;
}

function isPointOnWire(x, y) {
    const tolerance = 30;
    
    // Upper wire
    if (y >= 80 - tolerance && y <= 150 && x >= 80 && x <= 500) return true;
    
    // Right wire
    if (x >= 440 - tolerance && x <= 440 + tolerance && y >= 80 && y <= 280) return true;
    
    // Bottom wire
    if (y >= 270 - tolerance && y <= 270 + tolerance && x >= 80 && x <= 420) return true;
    
    // Left wire
    if (x >= 60 - tolerance && x <= 60 + tolerance && y >= 100 && y <= 250) return true;
    
    // Lamp area
    if (x >= 380 && x <= 500 && y >= 80 && y <= 280) return true;
    
    // Bridge area
    if (x >= 400 && x <= 450 && y >= 80 && y <= 160) return true;
    
    return false;
}

// ============================================================================
// Toast Notifications
// ============================================================================

const toast = {
    success: (message) => showToast(message, 'success'),
    info: (message) => showToast(message, 'info'),
    error: (message) => showToast(message, 'error')
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
        error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>'
    };
    
    toast.innerHTML = `
        <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${icons[type]}
        </svg>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// Control Panel Module
// ============================================================================

function initControlPanel() {
    const voltageSlider = document.getElementById('voltage-slider');
    const voltageInput = document.getElementById('voltage-input');
    const voltageDisplay = document.getElementById('voltage-display');
    const resistanceSlider = document.getElementById('resistance-slider');
    const resistanceInput = document.getElementById('resistance-input');
    const resistanceDisplay = document.getElementById('resistance-display');
    const resistancePreset = document.getElementById('resistance-preset');
    const addMeasurementBtn = document.getElementById('add-measurement-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    // Voltage controls
    const updateVoltage = (value) => {
        const v = Math.max(0.5, Math.min(20, parseFloat(value) || 5));
        store.setState({ voltage: v });
    };
    
    voltageSlider.addEventListener('input', (e) => updateVoltage(e.target.value));
    voltageInput.addEventListener('change', (e) => updateVoltage(e.target.value));
    
    document.querySelectorAll('.voltage-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            updateVoltage(btn.dataset.value);
        });
    });
    
    // Resistance controls
    const updateResistance = (value) => {
        const r = Math.max(1, Math.min(100, parseInt(value) || 10));
        store.setState({ resistance: r });
    };
    
    resistanceSlider.addEventListener('input', (e) => updateResistance(e.target.value));
    resistanceInput.addEventListener('change', (e) => updateResistance(e.target.value));
    resistancePreset.addEventListener('change', (e) => updateResistance(e.target.value));
    
    // Add measurement
    addMeasurementBtn.addEventListener('click', () => {
        const state = store.getState();
        const totalResistance = getTotalResistance(state);
        const current = getCurrent(state);
        
        const newMeasurement = {
            id: Date.now(),
            measurementNumber: state.measurementCounter,
            voltage: state.voltage,
            current: parseFloat(current.toFixed(3)),
            resistance: totalResistance,
            timestamp: new Date()
        };
        
        store.setState({
            measurements: [...state.measurements, newMeasurement],
            measurementCounter: state.measurementCounter + 1
        });
        
        toast.success(`Ölçüm ${state.measurementCounter} eklendi: V=${state.voltage}V, I=${newMeasurement.current}A, R=${totalResistance}Ω`);
    });
    
    // Reset
    resetBtn.addEventListener('click', () => {
        store.setState({
            voltage: 5,
            resistance: 10,
            measurements: [],
            measurementCounter: 1
        });
        toast.info('Tüm ölçümler temizlendi');
    });
    
    // Subscribe to state changes
    store.subscribe((state) => {
        voltageSlider.value = state.voltage;
        voltageInput.value = state.voltage;
        voltageDisplay.textContent = state.voltage;
        
        resistanceSlider.value = state.resistance;
        resistanceInput.value = state.resistance;
        resistanceDisplay.textContent = state.resistance;
        resistancePreset.value = state.resistance;
        
        // Update calculated values
        const current = getCurrent(state);
        const totalResistance = getTotalResistance(state);
        
        document.getElementById('current-value').textContent = current.toFixed(3);
        document.getElementById('total-resistance-value').textContent = totalResistance;
        
        // Update instant values (Anlık Değerler)
        updateInstantValues(state);
        
        // Update alerts
        updateAlerts(state);
        
        // Update voltage preset button states
        document.querySelectorAll('.voltage-preset').forEach(btn => {
            if (parseInt(btn.dataset.value) === state.voltage) {
                btn.classList.add('active');
                btn.style.background = 'hsl(210 85% 45% / 0.1)';
                btn.style.borderColor = 'var(--primary)';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.borderColor = 'var(--border)';
            }
        });
    });
}

function updateInstantValues(state) {
    const current = getCurrent(state);
    const totalResistance = getTotalResistance(state);
    const voltmeterReading = getVoltmeterReading(state);
    
    // Update source voltage
    const sourceVoltageElement = document.getElementById('source-voltage');
    if (sourceVoltageElement) {
        sourceVoltageElement.textContent = state.voltage.toFixed(2);
    }
    
    // Update main current
    const mainCurrentElement = document.getElementById('main-current');
    if (mainCurrentElement) {
        mainCurrentElement.textContent = current.toFixed(3);
    }
    
    // Update resistance
    const mainResistanceElement = document.getElementById('main-resistance');
    if (mainResistanceElement) {
        mainResistanceElement.textContent = totalResistance;
    }
    
    // Update voltmeter reading
    const voltmeterElement = document.getElementById('voltmeter-reading');
    if (voltmeterElement) {
        voltmeterElement.textContent = voltmeterReading.toFixed(2);
    }
    
    // Update probe status
    const probeStatusElement = document.getElementById('probe-status');
    if (probeStatusElement) {
        const redConnected = state.probes.red.connectedTo && isPointOnWire(state.probes.red.x, state.probes.red.y);
        const blackConnected = state.probes.black.connectedTo && isPointOnWire(state.probes.black.x, state.probes.black.y);
        const connectedCount = (redConnected ? 1 : 0) + (blackConnected ? 1 : 0);
        
        probeStatusElement.textContent = `${connectedCount}/2 prob bağlı`;
        
        if (connectedCount === 2) {
            probeStatusElement.style.color = 'var(--primary)';
        } else if (connectedCount === 1) {
            probeStatusElement.style.color = 'hsl(45, 85%, 55%)';
        } else {
            probeStatusElement.style.color = 'var(--muted-foreground)';
        }
    }
    
    // Update Ohm's law formula
    const ohmFormulaElement = document.getElementById('ohm-formula');
    if (ohmFormulaElement) {
        ohmFormulaElement.textContent = `${state.voltage} = ${current.toFixed(3)} × ${totalResistance}`;
    }
}

function updateAlerts(state) {
    const container = document.getElementById('alerts-container');
    const isVeryLowResistance = state.resistance <= 1;
    const current = getCurrent(state);
    const isHighCurrent = current > 2;
    
    let html = '';
    
    if (isVeryLowResistance) {
        html += `
            <div class="alert alert-destructive">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div>
                    <strong>Dikkat!</strong> Çok düşük direnç değeri yüksek akıma neden olur. 
                    Gerçek hayatta bu durum tehlikeli olabilir ve süperiletkenlik ile ilişkilidir.
                </div>
            </div>
        `;
    }
    
    if (isHighCurrent) {
        html += `
            <div class="alert alert-accent">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div>
                    Yüksek akım değeri tespit edildi: ${current.toFixed(3)}A
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ============================================================================
// Circuit Simulation Module
// ============================================================================

function initCircuit() {
    const container = document.getElementById('circuit-container');
    
    // Clear any existing content
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 500 350');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.cursor = 'default';
    
    renderCircuit(svg);
    container.appendChild(svg);
    
    // Dragging state
    let dragging = null;
    
    // Event handlers
    svg.addEventListener('mousedown', handleMouseDown);
    svg.addEventListener('mousemove', handleMouseMove);
    svg.addEventListener('mouseup', handleMouseUp);
    svg.addEventListener('mouseleave', handleMouseUp);
    
    function handleMouseDown(e) {
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (500 / rect.width);
        const y = (e.clientY - rect.top) * (350 / rect.height);
        
        // Check if clicking on a probe
        const state = store.getState();
        const redProbe = state.probes.red;
        const blackProbe = state.probes.black;
        
        if (Math.hypot(x - redProbe.x, y - redProbe.y) < 15) {
            dragging = 'red';
            e.preventDefault();
        } else if (Math.hypot(x - blackProbe.x, y - blackProbe.y) < 15) {
            dragging = 'black';
            e.preventDefault();
        } else if (Math.hypot(x - state.voltmeterDevice.x - 40, y - state.voltmeterDevice.y - 25) < 30) {
            dragging = 'voltmeter';
            e.preventDefault();
        } else if (Math.hypot(x - state.ammeterDevice.x - 25, y - state.ammeterDevice.y - 20) < 25) {
            dragging = 'ammeter';
            e.preventDefault();
        }
    }
    
    function handleMouseMove(e) {
        if (!dragging) return;
        
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (500 / rect.width);
        const y = (e.clientY - rect.top) * (350 / rect.height);
        
        const state = store.getState();
        
        if (dragging === 'red' || dragging === 'black') {
            const newProbes = { ...state.probes };
            newProbes[dragging] = { ...newProbes[dragging], x, y };
            store.setState({ probes: newProbes });
        } else if (dragging === 'voltmeter') {
            store.setState({ voltmeterDevice: { x: Math.max(0, Math.min(420, x)), y: Math.max(250, Math.min(350, y)) } });
        } else if (dragging === 'ammeter') {
            store.setState({ ammeterDevice: { x: Math.max(0, Math.min(450, x)), y: Math.max(0, Math.min(310, y)) } });
        }
    }
    
    function handleMouseUp() {
        if (dragging === 'red' || dragging === 'black') {
            const state = store.getState();
            const probe = state.probes[dragging];
            
            if (isPointOnWire(probe.x, probe.y)) {
                const newProbes = { ...state.probes };
                newProbes[dragging] = {
                    ...probe,
                    connectedTo: `wire-${Math.round(probe.x)}-${Math.round(probe.y)}`
                };
                store.setState({ probes: newProbes });
            } else {
                const newProbes = { ...state.probes };
                newProbes[dragging] = { ...probe, connectedTo: null };
                store.setState({ probes: newProbes });
            }
        }
        
        dragging = null;
    }
    
    // Update circuit on state changes
    store.subscribe((state) => {
        svg.innerHTML = '';
        renderCircuit(svg);
        
        // Also update instant values when circuit is re-rendered
        updateInstantValues(state);
    });
}

function renderCircuit(svg) {
    const state = store.getState();
    const current = getCurrent(state);
    const voltmeterReading = getVoltmeterReading(state);
    const ammeterReading = isPointOnWire(state.ammeterDevice.x + 25, state.ammeterDevice.y + 20) ? current : 0;
    
    svg.innerHTML = `
        <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
            </filter>
        </defs>
        
        <!-- Circuit wires -->
        <g>
            <path d="M 80 80 L 220 80" fill="none" stroke="hsl(42, 85%, 45%)" stroke-width="6" stroke-linecap="round"/>
            <path d="M 300 80 L 420 80 Q 440 80 440 100 L 440 250 Q 440 270 420 270 L 80 270 Q 60 270 60 250 L 60 100 Q 60 80 80 80" 
                  fill="none" stroke="hsl(42, 85%, 45%)" stroke-width="6" stroke-linecap="round"/>
        </g>
        
        <!-- Electron animation -->
        ${Array.from({ length: Math.min(Math.floor(current * 2), 8) }, (_, i) => `
            <circle r="4" fill="hsl(220, 85%, 55%)" opacity="0.8">
                <animateMotion dur="${6 / Math.max(current, 0.1)}s" repeatCount="indefinite" 
                    path="M 80 80 L 420 80 L 440 100 L 440 250 L 440 270 L 80 270 L 60 250 L 60 100 Z"
                    begin="${i * (6 / Math.max(current, 0.1) / Math.min(Math.floor(current * 2), 8))}s"/>
            </circle>
        `).join('')}
        
        <!-- Battery -->
        <g transform="translate(40, 140)" filter="url(#shadow)">
            <rect x="5" y="15" width="30" height="40" fill="hsl(var(--circuit-component))" rx="6" stroke="hsl(var(--border))" stroke-width="2"/>
            <rect x="15" y="10" width="10" height="8" fill="hsl(var(--circuit-positive))" rx="2"/>
            <rect x="17" y="8" width="6" height="4" fill="hsl(var(--circuit-positive))" rx="1"/>
            <rect x="15" y="55" width="10" height="8" fill="hsl(var(--circuit-negative))" rx="2"/>
            <text x="50" y="35" font-size="14" fill="currentColor" font-weight="600">PİL</text>
            <text x="50" y="50" font-size="12" fill="#ffffff" font-weight="bold">${state.voltage}V</text>
            <circle cx="20" cy="14" r="10" fill="#dc2626" stroke="white" stroke-width="2"/>
            <text x="20" y="19" font-size="16" fill="white" text-anchor="middle" font-weight="900">+</text>
            <circle cx="20" cy="60" r="10" fill="#1f2937" stroke="white" stroke-width="2"/>
            <text x="20" y="65" font-size="16" fill="white" text-anchor="middle" font-weight="900">−</text>
        </g>
        
        <!-- Resistor -->
        <g transform="translate(200, 65)" filter="url(#shadow)">
            <path d="M 0 15 L 15 15 L 20 5 L 30 25 L 40 5 L 50 25 L 60 5 L 70 25 L 80 15 L 100 15" 
                  fill="none" stroke="#8b5a2b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="50" y="45" font-size="14" fill="currentColor" text-anchor="middle" font-weight="bold">${state.resistance}Ω</text>
            <text x="50" y="-25" font-size="12" fill="currentColor" text-anchor="middle" font-weight="600">AYARLI DİRENÇ</text>
            <text x="50" y="-12" font-size="10" fill="#666" text-anchor="middle">(REOSTA)</text>
        </g>
        
        <!-- Lamp -->
        <g transform="translate(420, 140)" filter="url(#shadow)">
            <!-- Main lamp body -->
            <rect x="0" y="40" width="30" height="30" fill="hsl(var(--circuit-component))" rx="4"/>
            <circle cx="15" cy="25" r="20" fill="rgba(255, 193, 7, ${Math.min(current * 0.3 + 0.1, 1)})" 
                    stroke="#495057" stroke-width="4" opacity="1"/>
            <path d="M 8 20 Q 15 15 22 20 Q 15 25 8 25 Q 15 30 22 25" fill="none" 
                  stroke="hsl(30, 90%, 60%)" stroke-width="3" opacity="0.85"/>
            
            <!-- Light rays (always visible, opacity based on current) -->
            <g opacity="${Math.min(current * 0.6 + 0.2, 0.9)}">
                <line x1="15" y1="5" x2="15" y2="-5" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="30" y1="10" x2="40" y2="0" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="35" y1="25" x2="45" y2="25" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="30" y1="40" x2="40" y2="50" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="0" y1="10" x2="-10" y2="0" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="-5" y1="25" x2="-15" y2="25" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
                <line x1="0" y1="40" x2="-10" y2="50" stroke="rgb(255, 193, 7)" stroke-width="3" stroke-linecap="round"/>
            </g>
            
            <!-- Lamp base (gri çıkıntı) -->
            <rect x="6" y="70" width="18" height="12" fill="hsl(0, 0%, 65%)" rx="3" 
                  stroke="hsl(var(--border))" stroke-width="1"/>
            
            <text x="-60" y="15" font-size="14" fill="currentColor" font-weight="600">LAMBA</text>
            <text x="-60" y="30" font-size="12" fill="#8b5a2b" font-weight="bold">${LAMP_RESISTANCE}Ω</text>
        </g>
        
        <!-- Ammeter -->
        <g transform="translate(${state.ammeterDevice.x}, ${state.ammeterDevice.y})" filter="url(#shadow)">
            <!-- Main body with light blue background -->
            <rect x="0" y="0" width="50" height="40" fill="hsl(200, 50%, 75%)" stroke="white" 
                  stroke-width="2" rx="8" style="cursor: grab; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3))"/>
            <!-- Inner white display -->
            <rect x="6" y="6" width="38" height="22" fill="white" stroke="hsl(var(--border))" stroke-width="1" rx="4"/>
            <text x="25" y="-8" font-size="12" fill="currentColor" text-anchor="middle" font-weight="bold">AMPERMETRE</text>
            <text x="25" y="22" font-size="14" fill="black" text-anchor="middle" font-weight="bold">
                ${ammeterReading.toFixed(3)}A
            </text>
        </g>
        
        <!-- Voltmeter probes -->
        ${renderProbe(state.probes.red, '#dc2626', state.voltmeterDevice, true)}
        ${renderProbe(state.probes.black, '#000000', state.voltmeterDevice, false)}
        
        <!-- Voltmeter -->
        <g transform="translate(${state.voltmeterDevice.x}, ${state.voltmeterDevice.y})">
            <rect x="0" y="0" width="80" height="50" fill="#2d3748" stroke="#4a5568" stroke-width="2" rx="8"
                  style="cursor: grab; filter: drop-shadow(3px 3px 8px rgba(0,0,0,0.4))"/>
            <rect x="5" y="5" width="70" height="30" fill="#1a202c" stroke="#2d3748" stroke-width="1" rx="4"/>
            <rect x="7" y="7" width="66" height="26" fill="#0f3b0f" rx="2"/>
            <text x="40" y="25" font-size="16" font-family="monospace" font-weight="bold" fill="#00ff00" 
                  text-anchor="middle">${voltmeterReading.toFixed(2)}V</text>
            <text x="40" y="46" font-size="8" fill="#9ca3af" text-anchor="middle">VOLTMETRE</text>
        </g>
        
        <!-- Current direction arrows -->
        <g>
            <!-- Üst tel - sağa doğru -->
            <path d="M 150 75 L 165 80 L 150 85 Z" fill="#1565C0"/>
            
            <!-- Sağ dikey tel - aşağı doğru -->
            <path d="M 435 120 L 440 135 L 445 120 Z" fill="#1565C0"/>
            
            <!-- Alt tel - sola doğru -->
            <path d="M 350 275 L 335 270 L 350 265 Z" fill="#1565C0"/>
            
            <!-- Sol dikey tel - yukarı doğru -->
            <path d="M 65 220 L 60 205 L 55 220 Z" fill="#1565C0"/>
        </g>
    `;
}

function renderProbe(probe, color, voltmeterDevice, isRed) {
    const getCablePath = (startX, startY, endX, endY) => {
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const sag = Math.min(distance * 0.2, 50);
        const cp1X = startX + dx * 0.25;
        const cp1Y = startY + dy * 0.25 + sag * 0.3;
        const cp2X = startX + dx * 0.75;
        const cp2Y = startY + dy * 0.75 + sag * 0.3;
        return `M ${startX} ${startY} C ${cp1X} ${cp1Y} ${cp2X} ${cp2Y} ${endX} ${endY}`;
    };
    
    const startX = voltmeterDevice.x + (isRed ? 20 : 10);
    const startY = voltmeterDevice.y + 35;
    
    return `
        <path d="${getCablePath(startX, startY, probe.x, probe.y)}" 
              stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.9"/>
        <circle cx="${probe.x}" cy="${probe.y}" r="10" fill="${color}" stroke="hsl(var(--border))" stroke-width="2"
                style="cursor: grab; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.4))"/>
        <circle cx="${probe.x}" cy="${probe.y}" r="6" fill="${probe.connectedTo ? '#ffd700' : '#c0c0c0'}" 
                stroke="${probe.connectedTo ? '#b8860b' : '#a0a0a0'}" stroke-width="1"/>
        <circle cx="${probe.x}" cy="${probe.y}" r="2" fill="${probe.connectedTo ? '#ffed4e' : '#e0e0e0'}"/>
        ${probe.connectedTo && isPointOnWire(probe.x, probe.y) ? `
            <circle cx="${probe.x}" cy="${probe.y}" r="15" fill="none" stroke="${color}" 
                    stroke-width="2" stroke-dasharray="3,3" opacity="0.7" class="pulse"/>
        ` : ''}
    `;
}

// ============================================================================
// Data Table Module
// ============================================================================

function initDataTable() {
    store.subscribe((state) => {
        renderDataTable(state);
    });
    
    // Initial render
    renderDataTable(store.getState());
}

let currentSort = 'time';

function renderDataTable(state) {
    const container = document.getElementById('data-table-container');
    const measurements = state.measurements;
    
    if (measurements.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                    </svg>
                </div>
                <div class="empty-title">Henüz Ölçüm Yok</div>
                <div class="empty-text">Kontrol panelinden "Ölçüm Ekle" butonuna tıklayarak veri toplamaya başlayın.</div>
            </div>
        `;
        return;
    }
    
    // Statistics
    const maxCurrent = Math.max(...measurements.map(m => m.current));
    const minCurrent = Math.min(...measurements.map(m => m.current));
    
    // Sort measurements
    const sorted = [...measurements].sort((a, b) => {
        switch (currentSort) {
            case 'voltage': return b.voltage - a.voltage;
            case 'current': return b.current - a.current;
            default: return b.timestamp.getTime() - a.timestamp.getTime();
        }
    });
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-box stat-primary">
                <div class="stat-value">${measurements.length}</div>
                <div class="stat-label">Toplam Ölçüm</div>
            </div>
        </div>
        
        <div class="data-table-controls">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.875rem; color: var(--muted-foreground);">Sıralama:</span>
                <div class="sort-buttons">
                    <button class="btn btn-sm ${currentSort === 'time' ? 'btn-primary' : 'btn-outline'}" onclick="changeSort('time')">Zaman</button>
                    <button class="btn btn-sm ${currentSort === 'voltage' ? 'btn-primary' : 'btn-outline'}" onclick="changeSort('voltage')">Gerilim</button>
                    <button class="btn btn-sm ${currentSort === 'current' ? 'btn-primary' : 'btn-outline'}" onclick="changeSort('current')">Akım</button>
                </div>
            </div>
            <div class="table-actions">
                <button class="btn btn-sm btn-outline" onclick="exportCSV()">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                </button>
                <button class="btn btn-sm btn-outline" onclick="clearMeasurements()">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <div class="data-table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 3rem;">#</th>
                        <th>Gerilim</th>
                        <th>Akım</th>
                        <th>Direnç</th>
                        <th>Zaman</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((m, index) => `
                        <tr>
                            <td style="font-family: monospace; font-size: 0.75rem;">${measurements.length - index}</td>
                            <td><span class="badge badge-voltage">${m.voltage}V</span></td>
                            <td><span class="badge" style="background: hsl(160 85% 45% / 0.1); color: hsl(160 85% 45%); border: 1px solid hsl(160 85% 45% / 0.3);">${m.current.toFixed(3)}A</span></td>
                            <td><span class="badge badge-resistance">${m.resistance}Ω</span></td>
                            <td style="font-size: 0.75rem; color: var(--muted-foreground);">${m.timestamp.toLocaleTimeString('tr-TR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="table-summary">
            <div class="summary-box">
                <div class="summary-value">Min: ${minCurrent.toFixed(3)}A</div>
                <div class="summary-label">En düşük akım</div>
            </div>
            <div class="summary-box">
                <div class="summary-value">Max: ${maxCurrent.toFixed(3)}A</div>
                <div class="summary-label">En yüksek akım</div>
            </div>
        </div>
    `;
}

function changeSort(sort) {
    currentSort = sort;
    renderDataTable(store.getState());
}

function exportCSV() {
    const state = store.getState();
    if (state.measurements.length === 0) return;
    
    const headers = ['Sıra No', 'Gerilim (V)', 'Akım (A)', 'Direnç (Ω)', 'Zaman'];
    const csvContent = [
        headers.join(','),
        ...state.measurements.map((m, i) => [
            i + 1,
            m.voltage,
            m.current.toFixed(3),
            m.resistance,
            m.timestamp.toLocaleString('tr-TR')
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ohm_yasasi_olcumleri_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('CSV dosyası indirildi');
}

function clearMeasurements() {
    store.setState({
        measurements: [],
        measurementCounter: 1
    });
    toast.info('Tüm ölçümler temizlendi');
}

// ============================================================================
// Chart Module
// ============================================================================

let chartInstance = null;

function initChart() {
    const canvas = document.getElementById('vi-chart');
    const ctx = canvas.getContext('2d');
    
    store.subscribe((state) => {
        updateChart(state, ctx);
    });
    
    // Initial render
    updateChart(store.getState(), ctx);
}

function updateChart(state, ctx) {
    const measurements = state.measurements;
    const current = getCurrent(state);
    const totalResistance = getTotalResistance(state);
    
    // Prepare data
    const measurementData = measurements.map(m => ({
        x: m.current,
        y: m.voltage
    }));
    
    const currentData = [{
        x: current,
        y: state.voltage
    }];
    
    // Theoretical line - fixed maximum for stable visualization
    const measuredMaxCurrent = measurements.length > 0 ? Math.max(...measurements.map(m => m.current)) : 0;
    const maxCurrent = Math.max(
        measuredMaxCurrent,
        current,
        2.0  // Fixed maximum for stable graph scaling
    );
    
    const theoreticalData = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
        const I = (maxCurrent / steps) * i;
        theoreticalData.push({
            x: I,
            y: I * totalResistance
        });
    }
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Teorik Doğru (V=I×R)',
                    data: theoreticalData,
                    type: 'line',
                    borderColor: 'hsl(210, 85%, 45%)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Geçmiş Ölçümler',
                    data: measurementData,
                    backgroundColor: 'black',
                    pointRadius: 5
                },
                {
                    label: 'Anlık Değer',
                    data: currentData,
                    backgroundColor: 'red',
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `Gerilim: ${context.parsed.y.toFixed(2)}V, Akım: ${context.parsed.x.toFixed(3)}A`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Akım (A)'
                    },
                    ticks: {
                        callback: (value) => value.toFixed(2)
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Gerilim (V)'
                    },
                    ticks: {
                        callback: (value) => value.toFixed(2)
                    }
                }
            }
        }
    });
    
    // Update chart info
    const container = document.getElementById('chart-container');
    const parent = container.parentElement;
    
    // Remove old notes if any
    const oldNotes = parent.querySelector('.chart-notes');
    if (oldNotes) oldNotes.remove();
    
    // Add notes
    if (measurements.length > 0 || current > 0) {
        const notes = document.createElement('div');
        notes.className = 'chart-notes';
        notes.innerHTML = `
            <h4 class="chart-notes-title">Gözlem Notları</h4>
            <p>• V-I grafiğinde doğrusal bir ilişki görüyorsanız, Ohm Yasası doğrulanmış demektir.</p>
            <p>• Eğim = R_toplam = ${totalResistance}Ω (ayarlı direnç + lamba direnci)</p>
            <p>• Mavi kesikli çizgi, toplam direnç için teorik V = I × R_toplam doğrusunu gösterir.</p>
            ${measurements.length >= 5 ? '<p style="color: var(--primary);">• Yeterli veri topladınız! Şimdi sonuçları analiz edebilirsiniz.</p>' : ''}
        `;
        parent.appendChild(notes);
    }
}

// ============================================================================
// Export Tools Module
// ============================================================================

function initExportTools() {
    const exportBtn = document.getElementById('export-pdf-btn');
    const exportCount = document.getElementById('export-count');
    const successMsg = document.getElementById('export-success-msg');
    
    exportBtn.addEventListener('click', exportPDF);
    
    store.subscribe((state) => {
        exportCount.textContent = `${state.measurements.length} veri`;
        exportBtn.disabled = state.measurements.length === 0;
        
        if (state.measurements.length >= 5) {
            successMsg.style.display = 'flex';
        } else {
            successMsg.style.display = 'none';
        }
    });
}

function exportPDF() {
    const state = store.getState();
    if (state.measurements.length === 0) {
        toast.error('Rapor oluşturulacak veri bulunmuyor!');
        return;
    }
    
    const avgVoltage = state.measurements.reduce((sum, m) => sum + m.voltage, 0) / state.measurements.length;
    const avgCurrent = state.measurements.reduce((sum, m) => sum + m.current, 0) / state.measurements.length;
    const maxCurrent = Math.max(...state.measurements.map(m => m.current));
    const minCurrent = Math.min(...state.measurements.map(m => m.current));
    
    const reportHTML = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Ohm Yasası Deney Raporu</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 25px; }
        .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        .data-table th { background-color: #f2f2f2; }
        .statistics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9; }
        .formula { background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center; font-family: monospace; }
        .conclusion { background: #fff3e0; padding: 15px; border-radius: 5px; border-left: 4px solid #ff9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Ohm Yasası Simülasyon Raporu</h1>
        <p><strong>Kazanım:</strong> FİZ.10.3.3 - Ohm Yasası ile ilgili tümevarımsal akıl yürütebilme</p>
        <p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
    </div>
    
    <div class="section">
        <h2>Deney Amacı</h2>
        <p>Bu deneyin amacı, elektrik akımı ve potansiyel fark arasındaki ilişkiyi inceleyerek Ohm Yasası'nı (V = I × R) tümevarımsal yöntemle keşfetmektir.</p>
    </div>
    
    <div class="section">
        <h2>Kullanılan Formül</h2>
        <div class="formula">
            <h3>V = I × R</h3>
            <p>V: Potansiyel fark (Gerilim) - Volt</p>
            <p>I: Elektrik akımı - Amper</p>
            <p>R: Elektriksel direnç - Ohm</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Toplanan Veriler</h2>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Ölçüm No</th>
                    <th>Gerilim (V)</th>
                    <th>Akım (A)</th>
                    <th>Direnç (Ω)</th>
                    <th>Zaman</th>
                </tr>
            </thead>
            <tbody>
                ${state.measurements.map(m => `
                <tr>
                    <td>${m.measurementNumber}</td>
                    <td>${m.voltage}</td>
                    <td>${m.current.toFixed(3)}</td>
                    <td>${m.resistance}</td>
                    <td>${m.timestamp.toLocaleString('tr-TR')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h2>İstatistiksel Analiz</h2>
        <div class="statistics">
            <div class="stat-card">
                <h4>Toplam Ölçüm</h4>
                <p><strong>${state.measurements.length}</strong> adet</p>
            </div>
            <div class="stat-card">
                <h4>Ortalama Gerilim</h4>
                <p><strong>${avgVoltage.toFixed(2)} V</strong></p>
            </div>
            <div class="stat-card">
                <h4>Ortalama Akım</h4>
                <p><strong>${avgCurrent.toFixed(3)} A</strong></p>
            </div>
            <div class="stat-card">
                <h4>Akım Aralığı</h4>
                <p><strong>${minCurrent.toFixed(3)} - ${maxCurrent.toFixed(3)} A</strong></p>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>Sonuç ve Değerlendirme</h2>
        <div class="conclusion">
            <h4>Gözlemlerimiz:</h4>
            <ul>
                <li>Potansiyel fark arttıkça akım da ${avgCurrent > 0.5 ? 'belirgin şekilde' : ''} artmıştır.</li>
                <li>Direnç sabit tutulduğunda, V ve I arasında ${state.measurements.length >= 3 ? 'doğrusal' : ''} bir ilişki gözlenmiştir.</li>
                <li>Bu sonuçlar Ohm Yasası'nı (V = I × R) doğrulamaktadır.</li>
            </ul>
            
            <h4>Öğrendiklerimiz:</h4>
            <p>Bu simülasyon sayesinde elektrik akımı, gerilim ve direnç arasındaki matematik ilişkiyi 
            pratik olarak gözlemledik. Ohm Yasası'nın günlük hayattaki elektriksel hesaplamalarda 
            ne kadar önemli olduğunu anladık.</p>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        }
    </script>
</body>
</html>`;
    
    const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ohm_yasasi_raporu_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('PDF raporu oluşturuldu! Tarayıcınızdan yazdırabilirsiniz.');
}

// ============================================================================
// Student Notes Module
// ============================================================================

function initStudentNotes() {
    const textarea = document.getElementById('student-notes');
    const saveBtn = document.getElementById('save-notes-btn');
    const clearBtn = document.getElementById('clear-notes-btn');
    const charCount = document.getElementById('char-count');
    const charBadge = document.getElementById('char-badge');
    const unsavedBadge = document.getElementById('unsaved-badge');
    const savedTimeBadge = document.getElementById('saved-time-badge');
    const selfEval = document.getElementById('self-eval');
    
    // Load saved notes
    const saved = localStorage.getItem('ohm-law-notes');
    if (saved) {
        textarea.value = saved;
        store.setState({ notes: saved, savedNotes: saved });
    }
    
    textarea.addEventListener('input', (e) => {
        const value = e.target.value;
        store.setState({ notes: value });
        
        charCount.textContent = `${value.length}/1000 karakter`;
        
        if (value.length >= 100) {
            charBadge.style.display = 'inline-flex';
        } else {
            charBadge.style.display = 'none';
        }
        
        if (value.length > 200) {
            selfEval.style.display = 'block';
        } else {
            selfEval.style.display = 'none';
        }
    });
    
    saveBtn.addEventListener('click', () => {
        const state = store.getState();
        localStorage.setItem('ohm-law-notes', state.notes);
        const now = new Date();
        store.setState({ savedNotes: state.notes, lastSaved: now });
        toast.success('Notlarınız kaydedildi!');
    });
    
    clearBtn.addEventListener('click', () => {
        textarea.value = '';
        localStorage.removeItem('ohm-law-notes');
        store.setState({ notes: '', savedNotes: '', lastSaved: null });
        toast.info('Notlar temizlendi');
    });
    
    store.subscribe((state) => {
        const hasUnsaved = state.notes !== state.savedNotes;
        
        saveBtn.disabled = !hasUnsaved || state.notes.trim().length === 0;
        clearBtn.disabled = state.notes.length === 0;
        
        if (hasUnsaved) {
            unsavedBadge.style.display = 'inline-flex';
        } else {
            unsavedBadge.style.display = 'none';
        }
        
        if (state.lastSaved) {
            savedTimeBadge.textContent = state.lastSaved.toLocaleTimeString('tr-TR');
            savedTimeBadge.style.display = 'inline-flex';
        } else {
            savedTimeBadge.style.display = 'none';
        }
    });
}

// ============================================================================
// User Guide Modal
// ============================================================================

function initUserGuide() {
    const modal = document.getElementById('user-guide-modal');
    const openBtn = document.getElementById('user-guide-btn');
    const closeBtn = document.getElementById('close-guide-btn');
    const content = document.getElementById('user-guide-content');
    
    const sections = [
        {
            title: "Genel Bakış",
            icon: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
            content: [
                "Bu simülasyon, Ohm Yasası'nı (V = I × R) interaktif olarak öğrenme imkanı sağlamaktadır.",
                "Gerilim ve direnç değerleri değiştirilerek akımdaki değişim gözlemlenebilmektedir.",
                "Ölçümler yapılarak V-I grafiği oluşturulabilir ve sonuçlar analiz edilebilir."
            ]
        },
        {
            title: "Devre Simülasyonu",
            icon: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>',
            content: [
                "Sol üst köşede elektrik devresinin animasyonlu görünümü bulunmaktadır.",
                "Gerilim ve akım değerleri değiştikçe animasyon güncellenmektedir.",
                "Devre üzerindeki değerler gerçek zamanlı olarak güncellenmektedir.",
                "",
                "Voltmetre ve Ampermetre:",
                "• Voltmetre ve ampermetre fare ile hareket ettirilebilir",
                "• Voltmetre uçları arasındaki potansiyel farkı ölçmektedir",
                "• Ampermetre devredeki akım değerini göstermektedir",
                "• Ölçüm aletlerinin uçları dokundurulduğu noktalar arasındaki farkı ölçer"
            ]
        },
        {
            title: "Kontrol Paneli",
            icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
            content: [
                "Gerilim Ayarları:",
                "• Gerilim değerleri 0.5V-20V arası manuel olarak değiştirilebilir",
                "• Manuel giriş alanı kullanılabilir",
                "• Hızlı seçim butonları (3V, 9V, 12V) mevcuttur",
                "",
                "Direnç Ayarları:",
                "• Direnç değerleri 1Ω-100Ω arası manuel olarak değiştirilebilir",
                "• Manuel giriş alanı kullanılabilir",
                "• Hazır değerler açılır menüsünden seçilebilir",
                "",
                "Hesaplanan Değerler:",
                "• Anlık akım değeri (I = V ÷ R) gösterilir",
                "• Eşdeğer direnç değeri (R = V ÷ I) hesaplanır"
            ]
        },
        {
            title: "Ölçüm İşlemleri",
            icon: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
            content: [
                "Ölçüm Ekleme:",
                "• 'Ölçüm Ekle' butonuna tıklayınız",
                "• Mevcut V, I, R değerleri kaydedilir",
                "• Her ölçüme otomatik numara verilir",
                "",
                "Sıfırlama:",
                "• Tüm ölçümler silinir",
                "• Gerilim 5V, direnç 10Ω'a döner",
                "• Ölçüm numarası 1'e sıfırlanır"
            ]
        },
        {
            title: "V-I Grafiği",
            icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>',
            content: [
                "Grafik Özellikleri:",
                "• Siyah noktalar: Geçmiş ölçümler",
                "• Kırmızı nokta: Anlık değer",
                "• Mavi kesikli çizgi: Ölçüm bağlantıları",
                "• Düz çizgi: Teorik V = I × R doğrusu",
                "",
                "Etkileşim:",
                "• Noktalara fare ile dokunarak detay görüntülenebilir",
                "• Tooltip'te ölçüm detayları görüntülenir",
                "• Direnç değiştiğinde doğru eğimi güncellenir"
            ]
        },
        {
            title: "Ölçüm Verileri Tablosu",
            icon: '<path d="M12 3v18"></path><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path>',
            content: [
                "Tablo Özellikleri:",
                "• Tüm ölçümler listelenmektedir",
                "• Renkli rozetlerle değer kategorileri gösterilir",
                "• Kaydırılabilir alan mevcuttur",
                "",
                "Sıralama Seçenekleri:",
                "• Zaman: En yeni ölçümler üstte",
                "• Gerilim: En yüksek gerilim üstte",
                "• Akım: En yüksek akım üstte",
                "",
                "İstatistikler:",
                "• Toplam ölçüm sayısı gösterilir",
                "• Minimum ve maksimum akım değerleri hesaplanır"
            ]
        },
        {
            title: "PDF Rapor Oluşturma",
            icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>',
            content: [
                "Rapor İçeriği:",
                "• Deney amacı ve formüller",
                "• Tüm ölçüm verileri tablosu",
                "• İstatistiksel analiz",
                "• Sonuç ve değerlendirme",
                "",
                "Kullanım:",
                "• En az bir ölçüm yapılması gerekmektedir",
                "• 'PDF Raporu Oluştur' butonuna tıklayınız",
                "• Tarayıcıda açılan rapor yazdırılabilir",
                "• Rapor otomatik PDF formatında indirilir"
            ]
        },
        {
            title: "Öğrenci Notları",
            icon: '<path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"></path><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"></path><path d="m2.3 2.3 7.286 7.286"></path><circle cx="11" cy="11" r="2"></circle>',
            content: [
                "Not Alma:",
                "• Gözlemler ve sonuçlar yazılabilir",
                "• 1000 karaktere kadar yazma imkanı mevcuttur",
                "• Yönlendirici sorulardan yararlanılabilir",
                "",
                "Kayıt İşlemi:",
                "• 'Kaydet' butonuna tıklayınız",
                "• Notlar tarayıcıda yerel olarak saklanır",
                "• Sayfa yenilendiğinde notlar kaybolmaz",
                "• Son kayıt zamanı gösterilir"
            ]
        }
    ];
    
    content.innerHTML = sections.map((section, index) => `
        <div class="guide-section">
            <div class="guide-section-header">
                <div class="guide-icon-box">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${section.icon}</svg>
                </div>
                <h3 class="guide-section-title">${section.title}</h3>
                <div class="badge badge-outline guide-section-badge">${index + 1}/${sections.length}</div>
            </div>
            <div class="guide-content">
                ${section.content.map(line => {
                    if (line === "") return '<div style="height: 0.5rem;"></div>';
                    if (line.endsWith(":")) return `<div class="guide-heading">${line}</div>`;
                    if (line.startsWith("•")) return `<div class="guide-item"><span>•</span><span>${line.substring(2)}</span></div>`;
                    return `<p>${line}</p>`;
                }).join('')}
            </div>
            ${index < sections.length - 1 ? '<hr class="guide-separator">' : ''}
        </div>
    `).join('');
    
    openBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// ============================================================================
// Theme Toggle
// ============================================================================

// Initialize theme state
let currentTheme = localStorage.getItem('theme') || 'light';

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    if (!themeToggle || !themeIcon) {
        console.log('Theme toggle elements not found');
        return;
    }
    
    // Initialize theme
    function initializeTheme() {
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
        
        // Set active state for button
        themeToggle.setAttribute('data-theme', currentTheme);
    }
    
    // Toggle theme function
    function toggleTheme() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        themeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
        
        // Set active state for button
        themeToggle.setAttribute('data-theme', currentTheme);
        
        // Show toast notification
        showToast(`Tema ${currentTheme === 'dark' ? 'koyu' : 'açık'} moda geçti`, 'success');
    }
    
    // Initialize theme on load
    initializeTheme();
    
    // Add click event listener
    themeToggle.addEventListener('click', toggleTheme);
    
    console.log('Theme toggle initialized');
}

// ============================================================================
// Initialize Application
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initControlPanel();
    initCircuit();
    initDataTable();
    initChart();
    initExportTools();
    initStudentNotes();
    initUserGuide();
    initThemeToggle();
});
