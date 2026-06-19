// CarbonPulse Application Logic

// --- STATE MANAGEMENT ---
const DEFAULT_STATE = {
    hasCompletedCalculator: false,
    calculatorData: {
        carDist: 5000,
        carDistUnit: 'miles',
        carType: 'petrol-medium',
        transitHours: 2,
        flights: 4,
        housePeople: 2,
        elecBill: 80,
        heatingFuel: 'natural-gas',
        renewables: false,
        diet: 'heavy-meat',
        foodWaste: 'average',
        recycling: 'partial',
        shopping: 'moderate'
    },
    carbonFootprint: {
        total: 0.0,
        travel: 0.0,
        energy: 0.0,
        diet: 0.0,
        waste: 0.0
    },
    loggedActions: [],
    committedHabits: {},
    streak: 0,
    lastLoggedDate: null,
    xp: 0,
    level: 1,
    unlockedBadges: [],
    monthlySaved: 0.0 // in kg
};

let userState = { ...DEFAULT_STATE };

// Safe state sanitizer to prevent prototype pollution and schema mismatch
function sanitizeState(loaded) {
    if (!loaded || typeof loaded !== 'object') return { ...DEFAULT_STATE };
    const clean = { ...DEFAULT_STATE };
    
    for (const key in DEFAULT_STATE) {
        if (Object.prototype.hasOwnProperty.call(loaded, key) && key !== '__proto__' && key !== 'constructor') {
            const val = loaded[key];
            if (val !== undefined) {
                if (typeof DEFAULT_STATE[key] === 'object' && DEFAULT_STATE[key] !== null) {
                    if (Array.isArray(DEFAULT_STATE[key])) {
                        clean[key] = Array.isArray(val) ? val.filter(x => typeof x !== 'function') : [...DEFAULT_STATE[key]];
                    } else {
                        clean[key] = { ...DEFAULT_STATE[key] };
                        for (const subKey in DEFAULT_STATE[key]) {
                            if (Object.prototype.hasOwnProperty.call(val, subKey) && subKey !== '__proto__' && subKey !== 'constructor') {
                                clean[key][subKey] = val[subKey];
                            }
                        }
                    }
                } else {
                    clean[key] = val;
                }
            }
        }
    }
    return clean;
}

// Load state from LocalStorage
function loadState() {
    const saved = localStorage.getItem('carbonpulse_user_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            userState = sanitizeState(parsed);
        } catch (e) {
            console.error("Error parsing saved state, resetting...", e);
            userState = { ...DEFAULT_STATE };
        }
    }
}

// Save state to LocalStorage
function saveState() {
    localStorage.setItem('carbonpulse_user_state', JSON.stringify(userState));
    updateUIElements();
}

// --- CONSTANTS & EMISSION FACTORS ---
// Emission factors are in Tonnes CO2e per unit per year
const EMISSION_FACTORS = {
    // Travel (per mile)
    car: {
        'petrol-medium': 0.00031,
        'petrol-large': 0.00044,
        'diesel': 0.00028,
        'hybrid': 0.00018,
        'electric': 0.00008
    },
    transitPerHourWeekly: 0.0015 * 52, // hours/wk * 52 * average footprint
    flightPerHour: 0.09, // tonnes per hour (includes radiative forcing)

    // Energy (per person per year)
    elecCostPerKWh: 0.15,
    elecGridFactor: 0.00038, // tonnes CO2e per kWh
    elecGreenFactor: 0.00002, // 95% reduction for renewable
    heating: {
        'natural-gas': 1.5,
        'electricity': 0.8,
        'heating-oil': 2.2,
        'none': 0.1
    },

    // Diet (tonnes per year)
    diet: {
        'heavy-meat': 2.8,
        'medium-meat': 1.8,
        'vegetarian': 1.2,
        'vegan': 0.7
    },
    foodWasteMultiplier: {
        'minimal': 0.8,
        'average': 1.0,
        'high': 1.25
    },

    // Consumption & Waste (tonnes per year)
    shopping: {
        'minimal': 0.5,
        'moderate': 1.2,
        'heavy': 2.5
    },
    recyclingSaving: {
        'full': -0.3,
        'partial': -0.1,
        'none': 0.0
    }
};

// Available Green Actions
const GREEN_ACTIONS = [
    {
        id: 'walk_bike',
        title: 'Walk or Cycle instead of Driving',
        desc: 'Choose active transit for a trip. Helps reduce tailpipe emissions and traffic congestion.',
        category: 'travel',
        impact: 'High',
        saving: 2.5, // kg CO2e
        xp: 15,
        type: 'daily',
        icon: 'bike'
    },
    {
        id: 'public_transit',
        title: 'Take Public Transit',
        desc: 'Ride the train, tram, or bus for your commute instead of taking a private car.',
        category: 'travel',
        impact: 'Medium',
        saving: 1.8,
        xp: 12,
        type: 'daily',
        icon: 'train'
    },
    {
        id: 'meatless_day',
        title: 'Meatless Day',
        desc: 'Substitute meat with plant-based protein (beans, lentils, tofu) for a full day.',
        category: 'diet',
        impact: 'High',
        saving: 3.2,
        xp: 20,
        type: 'daily',
        icon: 'carrot'
    },
    {
        id: 'cold_wash',
        title: 'Wash Laundry at 30°C / Cold',
        desc: 'Heating water accounts for 75-90% of laundry energy. Washing cold protects fabrics and saves energy.',
        category: 'energy',
        impact: 'Low',
        saving: 0.6,
        xp: 10,
        type: 'daily',
        icon: 'droplets'
    },
    {
        id: 'unplug_standby',
        title: 'Power Down Standby Devices',
        desc: 'Turn off power strips and unplug chargers when not in use to avoid phantom energy loads.',
        category: 'energy',
        impact: 'Low',
        saving: 0.3,
        xp: 8,
        type: 'daily',
        icon: 'plug'
    },
    {
        id: 'no_plastic',
        title: 'Avoid Single-Use Plastics',
        desc: 'Bring reusable grocery bags, water bottles, and metal straws to reduce packaging waste.',
        category: 'waste',
        impact: 'Low',
        saving: 0.4,
        xp: 10,
        type: 'daily',
        icon: 'trash-2'
    },
    {
        id: 'buy_secondhand',
        title: 'Shop Second-Hand',
        desc: 'Purchase clothes, furniture, or electronics pre-loved rather than buying brand new.',
        category: 'waste',
        impact: 'High',
        saving: 4.0,
        xp: 20,
        type: 'daily',
        icon: 'shopping-bag'
    },
    {
        id: 'compost_setup',
        title: 'Compost Organic Waste',
        desc: 'Divert food scraps from landfills, where they produce methane, and turn them into soil nutrients.',
        category: 'waste',
        impact: 'High',
        saving: 2.3, // daily equivalent over time
        xp: 50,
        type: 'habit',
        icon: 'container'
    },
    {
        id: 'led_lights',
        title: 'Install LED Bulbs',
        desc: 'Upgrade remaining halogen or incandescent household bulbs to energy-efficient LEDs.',
        category: 'energy',
        impact: 'Medium',
        saving: 1.5,
        xp: 40,
        type: 'habit',
        icon: 'lightbulb'
    }
];

// Achievements & Badges List
const BADGES = [
    { id: 'badge_calculator', title: 'First Steps', desc: 'Completed your first carbon footprint calculation.', icon: 'award' },
    { id: 'badge_streak_3', title: 'Streak Master', desc: 'Maintained a 3-day action logging streak.', icon: 'flame' },
    { id: 'badge_saved_50', title: 'Carbon Buster', desc: 'Saved 50 kg of cumulative carbon emissions.', icon: 'trending-down' },
    { id: 'badge_diet_5', title: 'Plant Champion', desc: 'Logged 5 Meatless Days.', icon: 'sprout' },
    { id: 'badge_habits_3', title: 'Habitual Green', desc: 'Committed to 3 eco habits in the Action Hub.', icon: 'check-square' }
];

// Global Chart Instance
let breakdownChartInstance = null;

// --- CARBON CALCULATIONS ---
function computeFootprint(data) {
    // 1. Travel Emissions
    let mileage = Number(data.carDist) || 0;
    if (data.carDistUnit === 'km') {
        mileage = mileage * 0.621371; // convert to miles
    }
    const carFactor = EMISSION_FACTORS.car[data.carType] || EMISSION_FACTORS.car['petrol-medium'];
    const travelCar = mileage * carFactor;
    
    const travelTransit = (Number(data.transitHours) || 0) * EMISSION_FACTORS.transitPerHourWeekly;
    const travelFlights = (Number(data.flights) || 0) * EMISSION_FACTORS.flightPerHour;
    
    const travelTotal = travelCar + travelTransit + travelFlights;

    // 2. Energy Emissions
    const occupants = Number(data.housePeople) || 1;
    const yearlyElecCost = (Number(data.elecBill) || 0) * 12;
    const yearlyKWh = yearlyElecCost / EMISSION_FACTORS.elecCostPerKWh;
    const gridFactor = data.renewables ? EMISSION_FACTORS.elecGreenFactor : EMISSION_FACTORS.elecGridFactor;
    
    const energyElectricity = (yearlyKWh * gridFactor) / occupants;
    const energyHeating = EMISSION_FACTORS.heating[data.heatingFuel] / occupants;
    
    const energyTotal = energyElectricity + energyHeating;

    // 3. Diet Emissions
    const dietBase = EMISSION_FACTORS.diet[data.diet] || EMISSION_FACTORS.diet['medium-meat'];
    const wasteMult = EMISSION_FACTORS.foodWasteMultiplier[data.foodWaste] || 1.0;
    const dietTotal = dietBase * wasteMult;

    // 4. Waste & Consumption Emissions
    const shopBase = EMISSION_FACTORS.shopping[data.shopping] || EMISSION_FACTORS.shopping['moderate'];
    const recycleSave = EMISSION_FACTORS.recyclingSaving[data.recycling] || 0;
    // Ensure waste emissions do not go below 0.1t
    const wasteTotal = Math.max(0.1, shopBase + recycleSave);

    const total = travelTotal + energyTotal + dietTotal + wasteTotal;

    return {
        total: Number(total.toFixed(2)),
        travel: Number(travelTotal.toFixed(2)),
        energy: Number(energyTotal.toFixed(2)),
        diet: Number(dietTotal.toFixed(2)),
        waste: Number(wasteTotal.toFixed(2))
    };
}

// Update the live estimator preview (Right-hand side card in Calculator Tab)
function updateLiveCalculatorPreview() {
    const data = getFormDataFromCalculator();
    const result = computeFootprint(data);
    
    document.getElementById('calc-live-val').innerText = result.total.toFixed(1);
    document.getElementById('bar-val-travel').innerText = result.travel.toFixed(1) + 't';
    document.getElementById('bar-val-energy').innerText = result.energy.toFixed(1) + 't';
    document.getElementById('bar-val-diet').innerText = result.diet.toFixed(1) + 't';
    document.getElementById('bar-val-waste').innerText = result.waste.toFixed(1) + 't';
    
    // Scale live bars relative to a standard category maximum of 5 tonnes
    const maxVal = 5.0;
    document.getElementById('bar-fill-travel').style.width = Math.min(100, (result.travel / maxVal) * 100) + '%';
    document.getElementById('bar-fill-energy').style.width = Math.min(100, (result.energy / maxVal) * 100) + '%';
    document.getElementById('bar-fill-diet').style.width = Math.min(100, (result.diet / maxVal) * 100) + '%';
    document.getElementById('bar-fill-waste').style.width = Math.min(100, (result.waste / maxVal) * 100) + '%';
}

function getFormDataFromCalculator() {
    // Diet radio selections
    let dietVal = 'medium-meat';
    const dietRadios = document.getElementsByName('calc-diet');
    for (const radio of dietRadios) {
        if (radio.checked) {
            dietVal = radio.value;
            break;
        }
    }

    return {
        carDist: Math.max(0, Number(document.getElementById('calc-car-dist').value) || 0),
        carDistUnit: document.getElementById('calc-car-dist-unit').value,
        carType: document.getElementById('calc-car-type').value,
        transitHours: Math.max(0, Math.min(168, Number(document.getElementById('calc-transit-hours').value) || 0)),
        flights: Math.max(0, Number(document.getElementById('calc-flights').value) || 0),
        housePeople: Math.max(1, Number(document.getElementById('calc-house-people').value) || 1),
        elecBill: Math.max(0, Number(document.getElementById('calc-elec-bill').value) || 0),
        heatingFuel: document.getElementById('calc-heating-fuel').value,
        renewables: document.getElementById('calc-renewables').checked,
        diet: dietVal,
        foodWaste: document.getElementById('calc-food-waste').value,
        recycling: document.getElementById('calc-recycling').value,
        shopping: document.getElementById('calc-shopping').value
    };
}

function populateCalculatorInputs() {
    const data = userState.calculatorData;
    document.getElementById('calc-car-dist').value = data.carDist;
    document.getElementById('calc-car-dist-unit').value = data.carDistUnit;
    document.getElementById('calc-car-type').value = data.carType;
    document.getElementById('calc-transit-hours').value = data.transitHours;
    document.getElementById('calc-flights').value = data.flights;
    document.getElementById('calc-house-people').value = data.housePeople;
    document.getElementById('calc-elec-bill').value = data.elecBill;
    document.getElementById('calc-heating-fuel').value = data.heatingFuel;
    document.getElementById('calc-renewables').checked = data.renewables;
    
    const dietRadios = document.getElementsByName('calc-diet');
    for (const radio of dietRadios) {
        radio.checked = (radio.value === data.diet);
    }
    
    document.getElementById('calc-food-waste').value = data.foodWaste;
    document.getElementById('calc-recycling').value = data.recycling;
    document.getElementById('calc-shopping').value = data.shopping;
}

// --- GAMIFICATION SYSTEMS ---
function addXP(amount) {
    userState.xp += amount;
    const xpNeeded = userState.level * 100;
    if (userState.xp >= xpNeeded) {
        userState.xp -= xpNeeded;
        userState.level += 1;
        showToast(`Level Up! You are now Level ${userState.level}`);
    }
    checkBadges();
}

function showToast(message) {
    const toast = document.getElementById('achievement-toast');
    document.getElementById('toast-achievement-name').innerText = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function checkBadges() {
    const currentBadges = userState.unlockedBadges;

    // 1. Calculator Badge
    if (userState.hasCompletedCalculator && !currentBadges.includes('badge_calculator')) {
        unlockBadge('badge_calculator');
    }
    
    // 2. Cumulative savings badge (50 kg)
    const totalSavedKg = userState.loggedActions.reduce((sum, act) => sum + act.carbonSaved, 0);
    if (totalSavedKg >= 50.0 && !currentBadges.includes('badge_saved_50')) {
        unlockBadge('badge_saved_50');
    }

    // 3. Streak 3-day badge
    if (userState.streak >= 3 && !currentBadges.includes('badge_streak_3')) {
        unlockBadge('badge_streak_3');
    }

    // 4. Plant Champion (5 meatless days logged)
    const meatlessCount = userState.loggedActions.filter(act => act.id === 'meatless_day').length;
    if (meatlessCount >= 5 && !currentBadges.includes('badge_diet_5')) {
        unlockBadge('badge_diet_5');
    }

    // 5. Habitual Green (committed to 3 habits)
    const committedCount = Object.keys(userState.committedHabits).filter(key => userState.committedHabits[key] === true).length;
    if (committedCount >= 3 && !currentBadges.includes('badge_habits_3')) {
        unlockBadge('badge_habits_3');
    }
}

function unlockBadge(id) {
    userState.unlockedBadges.push(id);
    const badge = BADGES.find(b => b.id === id);
    if (badge) {
        showToast(`Unlocked: ${badge.title}!`);
    }
    saveState();
}

// Log a green action
function logGreenAction(actionId) {
    const action = GREEN_ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    // Manage streaks
    const todayStr = new Date().toISOString().split('T')[0];
    if (userState.lastLoggedDate) {
        const lastDate = new Date(userState.lastLoggedDate);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            userState.streak += 1;
        } else if (diffDays > 1) {
            userState.streak = 1; // reset streak if missed a day
        }
    } else {
        userState.streak = 1;
    }
    
    userState.lastLoggedDate = todayStr;
    userState.monthlySaved += action.saving;
    
    // Add to history
    userState.loggedActions.push({
        id: actionId,
        date: todayStr,
        carbonSaved: action.saving
    });

    addXP(action.xp);
    saveState();
    
    // Trigger flying floating text effect (micro-animation)
    triggerFloatingText(action.saving);
}

function triggerFloatingText(saving) {
    const floatEl = document.createElement('div');
    floatEl.innerText = `-${saving.toFixed(1)} kg CO₂`;
    floatEl.style.position = 'fixed';
    floatEl.style.bottom = '50px';
    floatEl.style.right = '50px';
    floatEl.style.color = 'var(--accent)';
    floatEl.style.fontWeight = 'bold';
    floatEl.style.fontSize = '1.5rem';
    floatEl.style.zIndex = '9999';
    floatEl.style.transition = 'all 1s ease-out';
    
    document.body.appendChild(floatEl);
    
    setTimeout(() => {
        floatEl.style.transform = 'translateY(-120px)';
        floatEl.style.opacity = '0';
    }, 50);

    setTimeout(() => {
        floatEl.remove();
    }, 1100);
}

function toggleCommitToHabit(actionId) {
    const isCommitted = userState.committedHabits[actionId];
    if (isCommitted) {
        userState.committedHabits[actionId] = false;
    } else {
        userState.committedHabits[actionId] = true;
        addXP(30); // Commit reward
        showToast("Committed to new Habit!");
    }
    checkBadges();
    saveState();
    renderActionCards();
}

// --- RENDER FUNCTIONS ---
function renderActionCards(categoryFilter = 'all') {
    const container = document.getElementById('actions-list-container');
    container.innerHTML = '';

    const filtered = categoryFilter === 'all'
        ? GREEN_ACTIONS
        : GREEN_ACTIONS.filter(a => a.category === categoryFilter);

    filtered.forEach(action => {
        const isCommitted = userState.committedHabits[action.id] || false;
        
        const card = document.createElement('div');
        card.className = `card action-card ${action.category}-act`;
        card.setAttribute('tabindex', '0');

        const actionMain = document.createElement('div');
        actionMain.className = 'action-main';

        const actionIcon = document.createElement('div');
        actionIcon.className = 'action-icon';
        const iconI = document.createElement('i');
        iconI.setAttribute('data-lucide', action.icon || 'leaf');
        iconI.setAttribute('aria-hidden', 'true');
        actionIcon.appendChild(iconI);

        const actionDetails = document.createElement('div');
        actionDetails.className = 'action-details';

        const h4 = document.createElement('h4');
        h4.textContent = action.title;

        const p = document.createElement('p');
        p.textContent = action.desc;

        const actionMeta = document.createElement('div');
        actionMeta.className = 'action-meta';

        const xpSpan = document.createElement('span');
        xpSpan.className = 'meta-pill xp';
        xpSpan.textContent = `+${action.xp} XP`;

        const savingSpan = document.createElement('span');
        savingSpan.className = 'meta-pill carbon-saving';
        savingSpan.textContent = `Saves ${action.saving} kg CO₂e`;

        actionMeta.appendChild(xpSpan);
        actionMeta.appendChild(savingSpan);

        actionDetails.appendChild(h4);
        actionDetails.appendChild(p);
        actionDetails.appendChild(actionMeta);

        actionMain.appendChild(actionIcon);
        actionMain.appendChild(actionDetails);

        const actionFooter = document.createElement('div');
        actionFooter.className = 'action-footer';

        if (action.type === 'habit') {
            const indicator = document.createElement('div');
            indicator.className = 'habit-committed-indicator';
            
            if (isCommitted) {
                const checkIcon = document.createElement('i');
                checkIcon.setAttribute('data-lucide', 'check-square');
                checkIcon.className = 'saved-icon';
                checkIcon.setAttribute('aria-hidden', 'true');
                indicator.appendChild(checkIcon);
                indicator.appendChild(document.createTextNode(' Committed'));
            } else {
                const notCommSpan = document.createElement('span');
                notCommSpan.style.color = 'var(--text-muted)';
                notCommSpan.textContent = 'Not committed';
                indicator.appendChild(notCommSpan);
            }

            const commitBtn = document.createElement('button');
            commitBtn.className = `btn btn-sm ${isCommitted ? 'btn-secondary' : 'btn-primary'}`;
            commitBtn.textContent = isCommitted ? 'Release Commit' : 'Commit to Habit';
            commitBtn.setAttribute('aria-label', `${isCommitted ? 'Release commit from' : 'Commit to'} habit: ${action.title}`);
            commitBtn.addEventListener('click', () => toggleCommitToHabit(action.id));

            actionFooter.appendChild(indicator);
            actionFooter.appendChild(commitBtn);
        } else {
            const spacer = document.createElement('span');
            
            const logBtn = document.createElement('button');
            logBtn.className = 'btn btn-sm btn-primary';
            logBtn.textContent = 'Log Action';
            logBtn.setAttribute('aria-label', `Log action: ${action.title}`);
            logBtn.addEventListener('click', () => logGreenAction(action.id));

            actionFooter.appendChild(spacer);
            actionFooter.appendChild(logBtn);
        }

        card.appendChild(actionMain);
        card.appendChild(actionFooter);
        container.appendChild(card);
    });
    
    // Re-initialize Lucide icons in generated HTML
    lucide.createIcons();
}

function updateUIElements() {
    // 1. Dashboard Total Footprint & benchmark
    const dashVal = document.getElementById('dash-total-footprint');
    const benchUserBar = document.getElementById('bench-user-bar');
    const statusMsg = document.getElementById('footprint-status-msg');
    
    if (userState.hasCompletedCalculator) {
        const total = userState.carbonFootprint.total;
        dashVal.innerText = total.toFixed(1);
        
        // Max range of the benchmark is 10.0 tonnes
        const userPercentage = Math.min(100, (total / 10.0) * 100);
        benchUserBar.style.width = userPercentage + '%';
        
        // Update benchmark description for screen readers
        const benchBarDesc = document.getElementById('bench-bar-desc');
        if (benchBarDesc) {
            benchBarDesc.setAttribute('aria-label', `Footprint benchmark comparison bar. Left marker is Paris target (2.0t). Middle marker is Global average (4.5t). Your footprint position is at ${total.toFixed(1)} tonnes.`);
        }
        
        // Dynamic status text securely using DOM creation to prevent innerHTML issues
        statusMsg.textContent = '';
        if (total <= 2.0) {
            const bold = document.createElement('strong');
            bold.style.color = 'var(--success)';
            bold.textContent = 'Fantastic! ';
            statusMsg.appendChild(bold);
            statusMsg.appendChild(document.createTextNode('Your footprint is within the sustainable global target limit.'));
            benchUserBar.style.background = 'var(--accent-gradient)';
        } else if (total <= 4.5) {
            statusMsg.appendChild(document.createTextNode('Your footprint is better than the global average, but adjustments can push you under the '));
            const span = document.createElement('span');
            span.style.color = 'var(--accent)';
            span.textContent = '2.0t target';
            statusMsg.appendChild(span);
            statusMsg.appendChild(document.createTextNode('.'));
            benchUserBar.style.background = 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)';
        } else {
            statusMsg.textContent = 'Your footprint is above average. Try committing to habits or reducing commuting to see immediate improvements.';
            benchUserBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)';
        }
    } else {
        dashVal.innerText = '--';
        benchUserBar.style.width = '0%';
        statusMsg.innerText = 'Complete the footprint calculator to see where you stand!';
    }

    // 2. Global Header stats
    const totalSavedKg = userState.loggedActions.reduce((sum, act) => sum + act.carbonSaved, 0);
    document.getElementById('stat-total-saved').innerText = totalSavedKg.toFixed(1);
    document.getElementById('stat-streak').innerText = userState.streak;

    // 3. User level & XP
    document.getElementById('user-level').innerText = userState.level;
    document.getElementById('current-xp').innerText = userState.xp;
    document.getElementById('next-level-xp').innerText = userState.level * 100;
    
    const xpPercent = (userState.xp / (userState.level * 100)) * 100;
    const progressBar = document.getElementById('xp-progress');
    progressBar.style.width = xpPercent + '%';
    progressBar.setAttribute('aria-valuenow', Math.round(xpPercent));
    progressBar.setAttribute('aria-valuemax', '100');

    // 4. Monthly Goal Progress Ring
    const goalSaved = userState.monthlySaved;
    const monthlyTarget = 50.0; // kg
    const goalPercent = Math.min(100, Math.round((goalSaved / monthlyTarget) * 100));
    
    document.getElementById('goal-percent-text').innerText = `${goalPercent}%`;
    document.getElementById('goal-current-saved').innerText = `${goalSaved.toFixed(1)} kg`;
    
    const circle = document.getElementById('goal-progress-circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (goalPercent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    const progressWrapper = document.getElementById('goal-progress-wrapper');
    if (progressWrapper) {
        progressWrapper.setAttribute('aria-label', `Goal progress circular meter. Currently saved ${goalSaved.toFixed(1)} kg CO2e, representing ${goalPercent}% towards your ${monthlyTarget} kg monthly savings target.`);
    }

    // 5. Badges
    const badgesContainer = document.getElementById('badges-container');
    badgesContainer.innerHTML = '';
    
    BADGES.forEach(badge => {
        const isUnlocked = userState.unlockedBadges.includes(badge.id);
        const item = document.createElement('div');
        item.className = `badge-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        item.setAttribute('tabindex', '0');
        item.setAttribute('title', badge.desc);
        item.setAttribute('aria-label', `Badge: ${badge.title}. Status: ${isUnlocked ? 'Unlocked' : 'Locked'}. Description: ${badge.desc}`);
        
        const badgeIcon = document.createElement('div');
        badgeIcon.className = 'badge-icon';
        const iconI = document.createElement('i');
        iconI.setAttribute('data-lucide', isUnlocked ? badge.icon : 'lock');
        iconI.setAttribute('aria-hidden', 'true');
        badgeIcon.appendChild(iconI);
        
        const badgeTitle = document.createElement('div');
        badgeTitle.className = 'badge-title';
        badgeTitle.textContent = badge.title;
        
        item.appendChild(badgeIcon);
        item.appendChild(badgeTitle);
        badgesContainer.appendChild(item);
    });

    // 6. Simulator values
    document.getElementById('sim-current-val').innerText = userState.hasCompletedCalculator ? userState.carbonFootprint.total.toFixed(1) : '5.5';

    // Refresh charts
    renderBreakdownChart();
    
    lucide.createIcons();
}

// Chart.js rendering
function renderBreakdownChart() {
    const ctx = document.getElementById('breakdownChart');
    const placeholder = document.getElementById('chart-placeholder-text');
    
    if (!ctx) return;

    if (!userState.hasCompletedCalculator) {
        ctx.style.display = 'none';
        placeholder.style.display = 'flex';
        return;
    }

    ctx.style.display = 'block';
    placeholder.style.display = 'none';

    const dataVals = [
        userState.carbonFootprint.travel,
        userState.carbonFootprint.energy,
        userState.carbonFootprint.diet,
        userState.carbonFootprint.waste
    ];

    if (breakdownChartInstance) {
        breakdownChartInstance.data.datasets[0].data = dataVals;
        breakdownChartInstance.update();
    } else {
        breakdownChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Travel', 'Energy & Housing', 'Diet & Food', 'Waste & Shopping'],
                datasets: [{
                    data: dataVals,
                    backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'],
                    borderWidth: 1,
                    borderColor: '#111815'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 12 },
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${context.raw.toFixed(1)} t CO₂e`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

// --- MULTI-STEP CALCULATOR CONTROL ---
let currentCalcStep = 1;
const totalCalcSteps = 4;

function setupStepNavigator() {
    const btnPrev = document.getElementById('btn-calc-prev');
    const btnNext = document.getElementById('btn-calc-next');
    
    btnPrev.addEventListener('click', () => {
        if (currentCalcStep > 1) {
            changeStep(currentCalcStep - 1);
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentCalcStep < totalCalcSteps) {
            changeStep(currentCalcStep + 1);
        }
    });

    // Input listeners to trigger real-time updates
    const inputs = document.querySelectorAll('.calc-steps-card input, .calc-steps-card select');
    inputs.forEach(input => {
        input.addEventListener('input', updateLiveCalculatorPreview);
        input.addEventListener('change', updateLiveCalculatorPreview);
    });
}

function changeStep(targetStep) {
    // Hide current pane
    document.getElementById(`step-pane-${currentCalcStep}`).classList.remove('active');
    
    const currentStepNode = document.querySelector(`.step-node[data-step="${currentCalcStep}"]`);
    currentStepNode.classList.remove('active');
    currentStepNode.removeAttribute('aria-current');
    
    if (targetStep < currentCalcStep) {
        currentStepNode.classList.remove('completed');
    } else {
        currentStepNode.classList.add('completed');
    }

    // Show target pane
    document.getElementById(`step-pane-${targetStep}`).classList.add('active');
    
    const targetStepNode = document.querySelector(`.step-node[data-step="${targetStep}"]`);
    targetStepNode.classList.add('active');
    targetStepNode.setAttribute('aria-current', 'step');
    
    currentCalcStep = targetStep;

    // Button states
    const btnPrev = document.getElementById('btn-calc-prev');
    const btnNext = document.getElementById('btn-calc-next');

    btnPrev.disabled = (currentCalcStep === 1);
    
    // Clean, secure DOM manipulation to avoid innerHTML variables issues on buttons
    btnNext.textContent = '';
    if (currentCalcStep === totalCalcSteps) {
        btnNext.appendChild(document.createTextNode('Finish '));
        const checkIcon = document.createElement('i');
        checkIcon.setAttribute('data-lucide', 'check');
        checkIcon.setAttribute('aria-hidden', 'true');
        btnNext.appendChild(checkIcon);
    } else {
        btnNext.appendChild(document.createTextNode('Next '));
        const arrowIcon = document.createElement('i');
        arrowIcon.setAttribute('data-lucide', 'arrow-right');
        arrowIcon.setAttribute('aria-hidden', 'true');
        btnNext.appendChild(arrowIcon);
    }
    
    lucide.createIcons();
}

// --- SIMULATOR FORCASTING LOGIC ---
function setupSimulator() {
    const sliderCommute = document.getElementById('sim-slider-commute');
    const sliderMeat = document.getElementById('sim-slider-meat');
    const sliderThermo = document.getElementById('sim-slider-thermo');
    const sliderAppliances = document.getElementById('sim-slider-appliances');

    const updateForecast = () => {
        // Read slider values
        const valCommute = Number(sliderCommute.value);
        const valMeat = Number(sliderMeat.value);
        const valThermo = Number(sliderThermo.value);
        const valAppliances = Number(sliderAppliances.value);

        // Update labels and ARIA values
        const txtCommute = `${valCommute}% less driving`;
        document.getElementById('sim-val-commute').innerText = txtCommute;
        sliderCommute.setAttribute('aria-valuenow', valCommute);
        sliderCommute.setAttribute('aria-valuetext', txtCommute);
        
        const txtMeat = `${valMeat} days / week`;
        document.getElementById('sim-val-meat').innerText = txtMeat;
        sliderMeat.setAttribute('aria-valuenow', valMeat);
        sliderMeat.setAttribute('aria-valuetext', txtMeat);
        
        const txtThermo = `${valThermo}°C reduction`;
        document.getElementById('sim-val-thermo').innerText = txtThermo;
        sliderThermo.setAttribute('aria-valuenow', valThermo);
        sliderThermo.setAttribute('aria-valuetext', txtThermo);
        
        let appLabel = 'Standard efficiency';
        if (valAppliances === 1) appLabel = 'LED Upgrade';
        if (valAppliances === 2) appLabel = 'Energy Star';
        document.getElementById('sim-val-appliances').innerText = appLabel;
        sliderAppliances.setAttribute('aria-valuenow', valAppliances);
        sliderAppliances.setAttribute('aria-valuetext', appLabel);

        // Base values (falls back to defaults if calculator not finished)
        const base = userState.hasCompletedCalculator 
            ? userState.carbonFootprint 
            : { total: 5.5, travel: 2.2, energy: 1.8, diet: 1.0, waste: 0.5 };
            
        // Calculate savings
        let travelSaving = base.travel * 0.70 * (valCommute / 100); // assume 70% of car travels are commuting
        
        // Meat saving: vegetarian diet saves ~40% of meat diet. Vegan saves ~75%.
        // Assuming V days replaces heavy-meat with vegetarian equivalents
        let dietSaving = base.diet * 0.40 * (valMeat / 7);
        
        // Thermostat: saves roughly 3% of heating footprint per degree
        let energyHeatingSaving = base.energy * 0.50 * 0.03 * valThermo; // assume heating is 50% of energy card
        
        // Appliances: LED saves 0.08t, Energy Star saves 0.2t
        let applianceSaving = 0.0;
        if (valAppliances === 1) applianceSaving = 0.08;
        if (valAppliances === 2) applianceSaving = 0.20;

        let totalSavings = travelSaving + dietSaving + energyHeatingSaving + applianceSaving;
        totalSavings = Math.min(base.total, totalSavings); // cannot save more than total footprint
        
        const projectedFootprint = Math.max(0.1, base.total - totalSavings);

        // Display results
        document.getElementById('sim-projected-val').innerText = projectedFootprint.toFixed(1);
        
        const callout = document.getElementById('sim-savings-callout');
        const trees = Math.round(totalSavings * 40); // 1 tonne CO2 ≈ 40 trees per year
        const miles = Math.round(totalSavings * 2500); // 1 tonne CO2 ≈ 2500 driving miles

        document.getElementById('sim-equivalent-trees').innerText = `${trees} trees`;
        document.getElementById('sim-equivalent-miles').innerText = `${miles.toLocaleString()} miles`;

        if (totalSavings > 0) {
            callout.querySelector('h4').innerText = `Annual Carbon Saving: ${totalSavings.toFixed(2)} tonnes`;
            callout.querySelector('p').innerText = `By committing to these reductions, you'll reduce your impact by ${((totalSavings / base.total) * 100).toFixed(0)}%!`;
            callout.style.borderColor = 'rgba(0, 240, 170, 0.4)';
        } else {
            callout.querySelector('h4').innerText = `Adjust the Sliders`;
            callout.querySelector('p').innerText = `Slide handles to forecast how modifications drop your footprint.`;
            callout.style.borderColor = 'rgba(0, 240, 170, 0.15)';
        }
    };

    [sliderCommute, sliderMeat, sliderThermo, sliderAppliances].forEach(slider => {
        slider.addEventListener('input', updateForecast);
    });

    updateForecast();
}

// --- TAB SWITHING & NAV ---
function setupTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const panels = document.querySelectorAll('.tab-panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            panels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            targetPanel.classList.add('active');

            // Dynamic headers
            const pageTitle = document.getElementById('page-title');
            const pageSubtitle = document.getElementById('page-subtitle');
            
            if (targetTab === 'dashboard') {
                pageTitle.innerText = "Dashboard Overview";
                pageSubtitle.innerText = "Track your carbon reduction journey and daily actions.";
            } else if (targetTab === 'calculator') {
                pageTitle.innerText = "Carbon Footprint Calculator";
                pageSubtitle.innerText = "Complete the multi-step calculator to discover your emission categories.";
                populateCalculatorInputs();
                updateLiveCalculatorPreview();
            } else if (targetTab === 'actions') {
                pageTitle.innerText = "Green Actions Hub";
                pageSubtitle.innerText = "Complete green actions to save carbon and level up.";
                renderActionCards();
            } else if (targetTab === 'simulator') {
                pageTitle.innerText = "What-If Simulation";
                pageSubtitle.innerText = "Analyze forecast shifts by tuning lifestyle changes.";
                // Refresh simulator base calculations
                document.getElementById('sim-current-val').innerText = userState.hasCompletedCalculator ? userState.carbonFootprint.total.toFixed(1) : '5.5';
                const event = new Event('input');
                document.getElementById('sim-slider-commute').dispatchEvent(event);
            } else if (targetTab === 'insights') {
                pageTitle.innerText = "Insights & Eco Quiz";
                pageSubtitle.innerText = "Improve your ecological knowledge and learn more about sustainability.";
            }
        });
    });

    // Action filter button clicks
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(fBtn => {
        fBtn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            fBtn.classList.add('active');
            fBtn.setAttribute('aria-selected', 'true');
            renderActionCards(fBtn.getAttribute('data-filter'));
        });
    });

    // Quick commute button on dashboard
    document.getElementById('btn-quick-log').addEventListener('click', () => {
        logGreenAction('walk_bike');
        showToast("Logged active transit: -2.5kg CO₂!");
    });
}

// --- EDUCATIONAL ACCORDION ---
function setupAccordion() {
    const triggers = document.querySelectorAll('.accordion-trigger');
    triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const item = trigger.parentElement;
            const content = item.querySelector('.accordion-content');
            
            // Toggle active state
            const isActive = item.classList.contains('active');
            
            // Close all items
            document.querySelectorAll('.accordion-item').forEach(i => {
                i.classList.remove('active');
                i.querySelector('.accordion-content').style.maxHeight = '0px';
                
                const t = i.querySelector('.accordion-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            });

            if (!isActive) {
                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + "px";
                trigger.setAttribute('aria-expanded', 'true');
            } else {
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    });
}

// --- INTERACTIVE QUIZ SYSTEM ---
const QUIZ_QUESTIONS = [
    {
        q: "Which of the following lifestyle shifts typically achieves the single highest annual carbon footprint reduction?",
        options: [
            { text: "Upgrading home lights to LEDs", correct: false },
            { text: "Composting all household food waste", correct: false },
            { text: "Living completely car-free", correct: true },
            { text: "Washing laundry clothes in cold water", correct: false }
        ],
        explanation: "Living car-free saves roughly 2.0 tonnes of CO2e per year, compared to LED upgrades (~0.1t) or composting (~0.2t)."
    },
    {
        q: "What portion of global greenhouse gas emissions is estimated to come from food and agriculture production?",
        options: [
            { text: "About 5%", correct: false },
            { text: "About 12%", correct: false },
            { text: "About 26%", correct: true },
            { text: "About 50%", correct: false }
        ],
        explanation: "Food production is incredibly resource-intensive and accounts for roughly 26% (around a quarter) of global emissions."
    },
    {
        q: "Which greenhouse gas is the most potent per molecule compared to Carbon Dioxide over a 100-year timescale?",
        options: [
            { text: "Methane (CH₄)", correct: false },
            { text: "Nitrous Oxide (N₂O)", correct: true },
            { text: "Water Vapor", correct: false },
            { text: "Oxygen (O₂)", correct: false }
        ],
        explanation: "Nitrous oxide (often from agricultural soil treatments) is roughly 298x more potent than CO2, while methane is ~28x more potent."
    }
];

let currentQuizIndex = 0;
let quizScore = 0;

function setupQuiz() {
    renderQuizQuestion();
    
    document.getElementById('btn-quiz-restart').addEventListener('click', () => {
        currentQuizIndex = 0;
        quizScore = 0;
        document.getElementById('quiz-result-view').style.display = 'none';
        document.getElementById('quiz-question-view').style.display = 'block';
        renderQuizQuestion();
    });
}

function renderQuizQuestion() {
    const qData = QUIZ_QUESTIONS[currentQuizIndex];
    document.getElementById('quiz-current-num').innerText = currentQuizIndex + 1;
    document.getElementById('quiz-question-text').innerText = qData.q;
    
    const progressPercent = ((currentQuizIndex + 1) / QUIZ_QUESTIONS.length) * 100;
    document.getElementById('quiz-bar-fill').style.width = `${progressPercent}%`;

    const optionsContainer = document.getElementById('quiz-options-list');
    optionsContainer.innerHTML = '';

    qData.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.innerText = opt.text;
        btn.addEventListener('click', () => handleQuizAnswer(opt.correct, btn));
        optionsContainer.appendChild(btn);
    });
}

function handleQuizAnswer(isCorrect, selectedBtn) {
    // Disable all options
    const btns = document.querySelectorAll('.quiz-opt-btn');
    btns.forEach(b => b.disabled = true);

    const qData = QUIZ_QUESTIONS[currentQuizIndex];
    
    // Highlight answer
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        quizScore += 1;
    } else {
        selectedBtn.classList.add('incorrect');
        // find correct one
        btns.forEach(b => {
            const optText = b.innerText;
            const matchOpt = qData.options.find(o => o.text === optText);
            if (matchOpt && matchOpt.correct) {
                b.classList.add('correct');
            }
        });
    }

    // Add explanation card dynamically below securely using DOM creation to prevent innerHTML issues
    const expl = document.createElement('div');
    expl.className = 'metric-status-msg';
    expl.style.marginTop = '15px';
    expl.style.borderLeftColor = isCorrect ? 'var(--success)' : 'var(--danger)';
    
    const strong = document.createElement('strong');
    strong.textContent = isCorrect ? 'Correct! ' : 'Incorrect. ';
    expl.appendChild(strong);
    
    expl.appendChild(document.createTextNode(qData.explanation));
    document.getElementById('quiz-options-list').appendChild(expl);

    // Next question trigger after 3.5s delay
    setTimeout(() => {
        currentQuizIndex += 1;
        if (currentQuizIndex < QUIZ_QUESTIONS.length) {
            renderQuizQuestion();
        } else {
            showQuizResults();
        }
    }, 3800);
}

function showQuizResults() {
    document.getElementById('quiz-question-view').style.display = 'none';
    const resultView = document.getElementById('quiz-result-view');
    resultView.style.display = 'block';
    
    document.getElementById('quiz-score').innerText = quizScore;
    
    let xpReward = 10 * quizScore; // 10 XP per correct answer
    if (quizScore === QUIZ_QUESTIONS.length) {
        xpReward += 20; // 20 XP completion bonus for perfect score
    }
    
    document.getElementById('quiz-xp-awarded-text').innerText = `+${xpReward} XP Earned`;
    
    addXP(xpReward);
    saveState();
}

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    
    setupTabNavigation();
    setupStepNavigator();
    setupSimulator();
    setupAccordion();
    setupQuiz();

    // Save Calculator Action
    document.getElementById('btn-save-calculator').addEventListener('click', () => {
        const formData = getFormDataFromCalculator();
        const results = computeFootprint(formData);
        
        userState.hasCompletedCalculator = true;
        userState.calculatorData = formData;
        userState.carbonFootprint = results;
        
        addXP(50); // XP reward for completing calculator
        showToast("Calculator Updated!");
        
        // Reset steps for next time
        changeStep(1);
        
        saveState();
        
        // Automatically switch back to dashboard tab
        document.querySelector('.nav-btn[data-tab="dashboard"]').click();
    });

    // Make functions globally available for inline HTML buttons
    window.logGreenAction = logGreenAction;
    window.toggleCommitToHabit = toggleCommitToHabit;

    updateUIElements();
});
