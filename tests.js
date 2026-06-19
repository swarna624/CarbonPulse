/**
 * CarbonPulse Test Suite
 * Executed when opening index.html?test=true
 */

(function runTests() {
    if (!window.location.search.includes('test=true')) {
        return;
    }

    console.log('%c CARBONPULSE TEST SUITE RUNNING ', 'color: #000; background: #00f0aa; font-weight: bold; padding: 4px 8px; border-radius: 4px;');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`%c PASS %c ${message}`, 'color: white; background: #10b981; padding: 2px 5px; border-radius: 3px; font-weight: bold;', 'color: #10b981;');
            passedTests++;
        } else {
            console.error(`%c FAIL %c ${message}`, 'color: white; background: #ef4444; padding: 2px 5px; border-radius: 3px; font-weight: bold;', 'color: #ef4444;');
            failedTests++;
        }
    }

    // --- TEST CASE 1: Baseline Calculator Logic (Vegan Minimalist vs. Heavy Meat Driver) ---
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
        
        // Diet should be 0.7 * 0.8 = 0.56 tonnes
        assert(Math.abs(resultVegan.diet - 0.56) < 0.01, `Vegan diet footprint calculated correctly: ${resultVegan.diet}t (expected 0.56t)`);
        
        // Travel should be 0.0 tonnes since distance, flights, and transit are 0
        assert(resultVegan.travel === 0.0, `Travel footprint for zero travel is 0.0t`);
        
        // Total should be low
        assert(resultVegan.total < 2.0, `Total footprint for Vegan Minimalist is sustainable: ${resultVegan.total}t (< 2.0t)`);

    } catch (e) {
        assert(false, `Test Case 1 errored: ${e.message}`);
    }

    // --- TEST CASE 2: Heavy Carbon Profile ---
    try {
        const carbonHeavyData = {
            carDist: 15000,
            carDistUnit: 'miles',
            carType: 'petrol-large', // SUV
            transitHours: 5,
            flights: 30, // 30 hours of flights
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
        assert(resultHeavy.travel > 5.0, `Travel emissions for heavy commuter are high: ${resultHeavy.travel}t (> 5t)`);
        assert(resultHeavy.total > 10.0, `Total emissions for heavy emitter profile are high: ${resultHeavy.total}t (> 10t)`);

    } catch (e) {
        assert(false, `Test Case 2 errored: ${e.message}`);
    }

    // --- TEST CASE 3: Green Tariff Energy Savings ---
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

        assert(resGreen.energy < resStandard.energy, `Green tariff reduces electricity emissions: ${resGreen.energy}t (green) vs ${resStandard.energy}t (standard)`);

    } catch (e) {
        assert(false, `Test Case 3 errored: ${e.message}`);
    }

    // --- TEST CASE 4: Gamification XP & Leveling Logic ---
    try {
        // Cache original values to restore later
        const origLevel = userState.level;
        const origXP = userState.xp;

        // Reset
        userState.level = 1;
        userState.xp = 0;

        addXP(80);
        assert(userState.level === 1 && userState.xp === 80, `XP added correctly below level threshold`);

        addXP(40); // Total 120 XP. Level 1 needs 100 XP. Should level up to 2, with 20 XP remaining.
        assert(userState.level === 2 && userState.xp === 20, `Level up logic works correctly: Level ${userState.level}, XP ${userState.xp}`);

        // Restore state values
        userState.level = origLevel;
        userState.xp = origXP;

    } catch (e) {
        assert(false, `Test Case 4 errored: ${e.message}`);
    }

    // --- TEST CASE 5: Badge Unlocking ---
    try {
        const origBadges = [...userState.unlockedBadges];
        const origActions = [...userState.loggedActions];

        userState.unlockedBadges = [];
        userState.loggedActions = [];

        // Log actions to accumulate saved carbon
        // Carbon Buster badge needs 50 kg saved
        userState.loggedActions.push({ id: 'walk_bike', date: '2026-06-19', carbonSaved: 30.0 });
        checkBadges();
        assert(!userState.unlockedBadges.includes('badge_saved_50'), `Carbon Buster badge is locked below 50kg saved`);

        userState.loggedActions.push({ id: 'walk_bike', date: '2026-06-19', carbonSaved: 25.0 }); // Total 55kg saved
        checkBadges();
        assert(userState.unlockedBadges.includes('badge_saved_50'), `Carbon Buster badge is unlocked above 50kg saved`);

        // Restore
        userState.unlockedBadges = origBadges;
        userState.loggedActions = origActions;

    } catch (e) {
        assert(false, `Test Case 5 errored: ${e.message}`);
    }

    // --- PRINT SUMMARY ---
    console.log(`%c TEST RUN SUMMARY: ${passedTests} passed, ${failedTests} failed `, 
        `color: white; background: ${failedTests === 0 ? '#10b981' : '#ef4444'}; font-weight: bold; padding: 4px 8px; border-radius: 4px; margin-top: 10px;`);

    // Dynamic Test Report Display in UI
    if (failedTests === 0) {
        const testBanner = document.createElement('div');
        testBanner.style.position = 'fixed';
        testBanner.style.top = '10px';
        testBanner.style.left = '50%';
        testBanner.style.transform = 'translateX(-50%)';
        testBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.9)';
        testBanner.style.color = '#fff';
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
