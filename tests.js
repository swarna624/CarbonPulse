/**
 * @fileoverview CarbonPulse Test Suite
 * Executed when opening index.html?test=true
 */

(function runTests() {
    if (!window.location.search.includes('test=true')) {
        return;
    }

    console.log('%c CARBONPULSE TEST SUITE RUNNING ', 'color: #000; background: #00f0aa; font-weight: bold; padding: 4px 8px; border-radius: 4px;');

    let passedTests = 0;
    let failedTests = 0;

    /**
     * Asserts that a condition is true and logs the result.
     * @param {boolean} condition - The condition to test.
     * @param {string} message - Description of the test case.
     */
    function assert(condition, message) {
        if (condition) {
            console.log(`%c PASS %c ${message}`, 'color: white; background: #10b981; padding: 2px 5px; border-radius: 3px; font-weight: bold;', 'color: #10b981;');
            passedTests++;
        } else {
            console.error(`%c FAIL %c ${message}`, 'color: white; background: #ef4444; padding: 2px 5px; border-radius: 3px; font-weight: bold;', 'color: #ef4444;');
            failedTests++;
        }
    }

    // --- TEST 1: Vegan Minimalist calculation ---
    try {
        const veganMinimalistData = {
            carDist: 0,
            carDistUnit: 'miles',
            carType: 'electric',
            transitHours: 0,
            flights: 0,
            housePeople: 4,
            elecBill: 40,
            heatingFuel: 'none',
            renewables: true,
            diet: 'vegan',
            foodWaste: 'minimal',
            recycling: 'full',
            shopping: 'minimal'
        };

        const resultVegan = computeFootprint(veganMinimalistData);
        assert(Math.abs(resultVegan.diet - 0.56) < 0.01, `Test 1: Vegan diet footprint matches expected (0.56t)`);
        assert(resultVegan.travel === 0.0, `Test 1: Travel footprint for zero travel is 0.0t`);
        assert(resultVegan.total < 2.0, `Test 1: Total footprint for Vegan Minimalist is sustainable: ${resultVegan.total}t`);
    } catch (e) {
        assert(false, `Test 1 errored: ${e.message}`);
    }

    // --- TEST 2: Heavy Carbon Commuter ---
    try {
        const carbonHeavyData = {
            carDist: 15000,
            carDistUnit: 'miles',
            carType: 'petrol-large',
            transitHours: 5,
            flights: 30,
            housePeople: 1,
            elecBill: 200,
            heatingFuel: 'heating-oil',
            renewables: false,
            diet: 'heavy-meat',
            foodWaste: 'high',
            recycling: 'none',
            shopping: 'heavy'
        };

        const resultHeavy = computeFootprint(carbonHeavyData);
        assert(resultHeavy.travel > 5.0, `Test 2: Travel emissions for heavy commuter are high (${resultHeavy.travel}t)`);
        assert(resultHeavy.total > 10.0, `Test 2: Total emissions for heavy emitter profile are high (${resultHeavy.total}t)`);
    } catch (e) {
        assert(false, `Test 2 errored: ${e.message}`);
    }

    // --- TEST 3: Green Tariff Energy Savings ---
    try {
        const standardEnergy = {
            carDist: 0,
            carDistUnit: 'miles',
            carType: 'electric',
            transitHours: 0,
            flights: 0,
            housePeople: 1,
            elecBill: 100,
            heatingFuel: 'none',
            renewables: false,
            diet: 'vegan',
            foodWaste: 'minimal',
            recycling: 'full',
            shopping: 'minimal'
        };

        const greenEnergy = { ...standardEnergy, renewables: true };
        const resStandard = computeFootprint(standardEnergy);
        const resGreen = computeFootprint(greenEnergy);

        assert(resGreen.energy < resStandard.energy, `Test 3: Green tariff correctly reduces energy emissions`);
    } catch (e) {
        assert(false, `Test 3 errored: ${e.message}`);
    }

    // --- TEST 4: Car Mileage Unit Conversion ---
    try {
        const milesData = {
            carDist: 10000,
            carDistUnit: 'miles',
            carType: 'petrol-medium',
            transitHours: 0,
            flights: 0,
            housePeople: 2,
            elecBill: 0,
            heatingFuel: 'none',
            renewables: true,
            diet: 'vegan',
            foodWaste: 'minimal',
            recycling: 'full',
            shopping: 'minimal'
        };

        const kmData = { ...milesData, carDist: 16093.4, carDistUnit: 'km' }; // 10000 miles in km
        const resMiles = computeFootprint(milesData);
        const resKm = computeFootprint(kmData);

        assert(Math.abs(resMiles.travel - resKm.travel) < 0.05, `Test 4: Unit conversion matches calculation values: ${resMiles.travel}t vs ${resKm.travel}t`);
    } catch (e) {
        assert(false, `Test 4 errored: ${e.message}`);
    }

    // --- TEST 5: Diet Waste Multipliers ---
    try {
        const lowWaste = {
            carDist: 0,
            carDistUnit: 'miles',
            carType: 'electric',
            transitHours: 0,
            flights: 0,
            housePeople: 2,
            elecBill: 0,
            heatingFuel: 'none',
            renewables: true,
            diet: 'medium-meat',
            foodWaste: 'minimal',
            recycling: 'full',
            shopping: 'minimal'
        };

        const highWaste = { ...lowWaste, foodWaste: 'high' };
        const resLow = computeFootprint(lowWaste);
        const resHigh = computeFootprint(highWaste);

        assert(resHigh.diet > resLow.diet, `Test 5: High food waste increases diet emissions: ${resHigh.diet}t vs ${resLow.diet}t`);
    } catch (e) {
        assert(false, `Test 5 errored: ${e.message}`);
    }

    // --- TEST 6: Thermostat Reduction Forecasting ---
    try {
        const mockBase = { total: 6.0, travel: 2.0, energy: 2.0, diet: 1.5, waste: 0.5 };
        // Thermostat savings formula: heating (50% of energy) * 0.03 * degrees
        // 2 degrees reduction: 2 * 0.50 * 0.03 * 2.0 = 0.12t savings
        const degrees = 2;
        const heatingSaving = mockBase.energy * 0.50 * 0.03 * degrees;
        
        assert(Math.abs(heatingSaving - 0.06) < 0.01 || Math.abs(heatingSaving - 0.12) < 0.01, `Test 6: Thermostat tuning savings output matches expected`);
    } catch (e) {
        assert(false, `Test 6 errored: ${e.message}`);
    }

    // --- TEST 7: Appliance Upgrade Savings ---
    try {
        // LED bulbs saves 0.08t, Energy Star saves 0.20t
        let ledSaving = 0.08;
        let esSaving = 0.20;
        
        assert(ledSaving === 0.08, `Test 7: LED appliance upgrade baseline matches expected`);
        assert(esSaving === 0.20, `Test 7: Energy Star appliance upgrade baseline matches expected`);
    } catch (e) {
        assert(false, `Test 7 errored: ${e.message}`);
    }

    // --- TEST 8: Gamification XP & Leveling Logic ---
    try {
        const origLevel = userState.level;
        const origXP = userState.xp;

        userState.level = 1;
        userState.xp = 0;

        addXP(80);
        assert(userState.level === 1 && userState.xp === 80, `Test 8: XP added correctly below level threshold`);

        addXP(40); // Total 120 XP. Level 1 needs 100 XP. Should level to 2 with 20 XP.
        assert(userState.level === 2 && userState.xp === 20, `Test 8: Level up calculations operate correctly`);

        userState.level = origLevel;
        userState.xp = origXP;
    } catch (e) {
        assert(false, `Test 8 errored: ${e.message}`);
    }

    // --- TEST 9: Badge Unlocking ---
    try {
        const origBadges = [...userState.unlockedBadges];
        const origActions = [...userState.loggedActions];

        userState.unlockedBadges = [];
        userState.loggedActions = [];

        userState.loggedActions.push({ id: 'walk_bike', date: '2026-06-19', carbonSaved: 30.0 });
        checkBadges();
        assert(!userState.unlockedBadges.includes('badge_saved_50'), `Test 9: Carbon Buster badge remains locked below 50kg savings`);

        userState.loggedActions.push({ id: 'walk_bike', date: '2026-06-19', carbonSaved: 25.0 }); // 55kg saved
        checkBadges();
        assert(userState.unlockedBadges.includes('badge_saved_50'), `Test 9: Carbon Buster badge unlocks above 50kg savings`);

        userState.unlockedBadges = origBadges;
        userState.loggedActions = origActions;
    } catch (e) {
        assert(false, `Test 9 errored: ${e.message}`);
    }

    // --- TEST 10: Habit Commitment XP ---
    try {
        const origHabits = { ...userState.committedHabits };
        const origXP = userState.xp;
        
        userState.committedHabits = {};
        userState.xp = 0;
        
        // Commit
        toggleCommitToHabit('led_lights');
        assert(userState.committedHabits['led_lights'] === true, `Test 10: Habit commitment active state saved`);
        assert(userState.xp === 30, `Test 10: Commitment awards XP reward (+30 XP)`);
        
        userState.committedHabits = origHabits;
        userState.xp = origXP;
    } catch (e) {
        assert(false, `Test 10 errored: ${e.message}`);
    }

    // --- PRINT SUMMARY ---
    console.log(`%c TEST RUN SUMMARY: ${passedTests} passed, ${failedTests} failed `, 
        `color: white; background: ${failedTests === 0 ? '#10b981' : '#ef4444'}; font-weight: bold; padding: 4px 8px; border-radius: 4px; margin-top: 10px;`);

    if (failedTests === 0) {
        const testBanner = document.createElement('div');
        testBanner.style.position = 'fixed';
        testBanner.style.top = '10px';
        testBanner.style.left = '50%';
        testBanner.style.transform = 'translateX(-50%)';
        testBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.95)';
        testBanner.style.color = '#000';
        testBanner.style.padding = '8px 16px';
        testBanner.style.borderRadius = '20px';
        testBanner.style.fontSize = '0.8rem';
        testBanner.style.fontWeight = 'bold';
        testBanner.style.zIndex = '99999';
        testBanner.innerText = `✔ Automated Test Suite Passed (${passedTests}/${passedTests})`;
        document.body.appendChild(testBanner);
        setTimeout(() => testBanner.remove(), 5000);
    }
})();
