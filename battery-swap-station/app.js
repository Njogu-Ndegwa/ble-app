/**
 * SwapStation - Attendant Portal
 * Battery Swapping Station Management App
 */

// App State
const state = {
    currentStep: 1,
    customer: null,
    battery: null,
    transaction: null,
    stats: {
        todaySwaps: 24,
        availableBatteries: 18,
        revenue: 312
    }
};

// Mock customer database
const mockCustomers = [
    {
        id: 'CUS-2847',
        name: 'John Doe',
        initials: 'JD',
        membership: 'Premium',
        discount: 0.15
    },
    {
        id: 'CUS-3921',
        name: 'Sarah Chen',
        initials: 'SC',
        membership: 'Standard',
        discount: 0
    },
    {
        id: 'CUS-1584',
        name: 'Mike Johnson',
        initials: 'MJ',
        membership: 'Premium',
        discount: 0.15
    }
];

// Mock battery database
const mockBatteries = [
    { serial: 'BAT-7829-XK', charge: 12, customerId: 'CUS-2847', lastSwap: '3 days ago' },
    { serial: 'BAT-4521-ZM', charge: 8, customerId: 'CUS-3921', lastSwap: '1 day ago' },
    { serial: 'BAT-9834-LP', charge: 23, customerId: 'CUS-1584', lastSwap: '5 days ago' }
];

// Pricing
const PRICING = {
    baseSwapFee: 8.00,
    energyRatePerPercent: 0.05
};

// DOM Elements
const elements = {
    screens: document.querySelectorAll('.screen'),
    steps: document.querySelectorAll('.step'),
    stepLines: document.querySelectorAll('.step-line'),
    scanOverlay: document.getElementById('scanOverlay'),
    toast: document.getElementById('toast'),
    
    // Buttons
    btnScanBattery: document.getElementById('btnScanBattery'),
    btnReject: document.getElementById('btnReject'),
    btnProceedPayment: document.getElementById('btnProceedPayment'),
    btnScanPayment: document.getElementById('btnScanPayment'),
    btnCashPayment: document.getElementById('btnCashPayment'),
    btnNewSwap: document.getElementById('btnNewSwap'),
    
    // Display elements
    customerAvatar: document.getElementById('customerAvatar'),
    customerName: document.getElementById('customerName'),
    customerId: document.getElementById('customerId'),
    batterySerial: document.getElementById('batterySerial'),
    chargeLevel: document.getElementById('chargeLevel'),
    chargePercent: document.getElementById('chargePercent'),
    lastSwap: document.getElementById('lastSwap'),
    totalAmount: document.getElementById('totalAmount'),
    paymentAmount: document.getElementById('paymentAmount'),
    
    // Receipt elements
    receiptId: document.getElementById('receiptId'),
    receiptCustomer: document.getElementById('receiptCustomer'),
    receiptNewBattery: document.getElementById('receiptNewBattery'),
    receiptAmount: document.getElementById('receiptAmount'),
    receiptMethod: document.getElementById('receiptMethod'),
    newBatteryCode: document.getElementById('newBatteryCode'),
    
    // Stats
    todaySwaps: document.getElementById('todaySwaps'),
    availableBatteries: document.getElementById('availableBatteries'),
    revenue: document.getElementById('revenue')
};

// Initialize App
function init() {
    bindEvents();
    updateStats();
}

// Event Bindings
function bindEvents() {
    elements.btnScanBattery.addEventListener('click', handleScanBattery);
    elements.btnReject.addEventListener('click', handleReject);
    elements.btnProceedPayment.addEventListener('click', handleProceedPayment);
    elements.btnScanPayment.addEventListener('click', handleScanPayment);
    elements.btnCashPayment.addEventListener('click', handleCashPayment);
    elements.btnNewSwap.addEventListener('click', handleNewSwap);
}

// Navigation
function goToStep(stepNumber) {
    state.currentStep = stepNumber;
    
    // Update progress steps
    elements.steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < stepNumber) {
            step.classList.add('completed');
        } else if (stepNum === stepNumber) {
            step.classList.add('active');
        }
    });
    
    // Update step lines
    elements.stepLines.forEach((line, index) => {
        if (index < stepNumber - 1) {
            line.classList.add('completed');
        } else {
            line.classList.remove('completed');
        }
    });
    
    // Show appropriate screen
    const screenIds = ['screen-scan', 'screen-verify', 'screen-payment', 'screen-complete'];
    elements.screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenIds[stepNumber - 1]).classList.add('active');
}

// Scan Animation
function showScanOverlay(duration = 2000) {
    return new Promise(resolve => {
        elements.scanOverlay.classList.add('active');
        setTimeout(() => {
            elements.scanOverlay.classList.remove('active');
            resolve();
        }, duration);
    });
}

// Toast Notification
function showToast(message, type = 'success') {
    elements.toast.className = `toast ${type}`;
    elements.toast.querySelector('.toast-message').textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Calculate Cost
function calculateCost(customer, battery) {
    const energyNeeded = 100 - battery.charge;
    const energyCost = energyNeeded * PRICING.energyRatePerPercent;
    const subtotal = PRICING.baseSwapFee + energyCost;
    const discount = subtotal * customer.discount;
    const total = subtotal - discount;
    
    return {
        baseFee: PRICING.baseSwapFee,
        energyCost: energyCost,
        energyNeeded: energyNeeded,
        discount: discount,
        total: total
    };
}

// Generate Transaction ID
function generateTransactionId() {
    return '#TXN-' + Math.floor(10000 + Math.random() * 90000);
}

// Generate New Battery Serial
function generateNewBatterySerial() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = Math.floor(1000 + Math.random() * 9000);
    const letters = chars[Math.floor(Math.random() * chars.length)] + 
                   chars[Math.floor(Math.random() * chars.length)];
    return `BAT-${nums}-${letters}`;
}

// Update Stats Display
function updateStats() {
    elements.todaySwaps.textContent = state.stats.todaySwaps;
    elements.availableBatteries.textContent = state.stats.availableBatteries;
    elements.revenue.textContent = '$' + state.stats.revenue;
}

// Handlers
async function handleScanBattery() {
    await showScanOverlay(1500);
    
    // Simulate finding a battery (random selection for demo)
    const randomIndex = Math.floor(Math.random() * mockBatteries.length);
    const battery = mockBatteries[randomIndex];
    const customer = mockCustomers.find(c => c.id === battery.customerId);
    
    if (!battery || !customer) {
        showToast('Battery not recognized', 'error');
        return;
    }
    
    // Store in state
    state.battery = battery;
    state.customer = customer;
    state.transaction = {
        cost: calculateCost(customer, battery),
        id: generateTransactionId(),
        newBattery: generateNewBatterySerial(),
        slot: Math.floor(1 + Math.random() * 12)
    };
    
    // Update UI
    populateVerificationScreen();
    
    // Navigate
    showToast('Battery verified successfully');
    goToStep(2);
}

function populateVerificationScreen() {
    const { customer, battery, transaction } = state;
    
    // Customer info
    elements.customerAvatar.textContent = customer.initials;
    elements.customerName.textContent = customer.name;
    elements.customerId.textContent = `ID: #${customer.id}`;
    
    // Update member badge
    const memberBadge = document.querySelector('.member-badge span');
    memberBadge.textContent = customer.membership;
    memberBadge.parentElement.style.background = 
        customer.membership === 'Premium' ? 'var(--accent-orange)' : 'var(--text-muted)';
    
    // Battery info
    elements.batterySerial.textContent = battery.serial;
    elements.chargeLevel.style.width = battery.charge + '%';
    elements.chargePercent.textContent = battery.charge + '%';
    elements.lastSwap.textContent = battery.lastSwap;
    
    // Color charge indicator based on level
    if (battery.charge < 20) {
        elements.chargeLevel.className = 'charge-level';
        elements.chargePercent.style.color = 'var(--accent-red)';
    } else if (battery.charge < 50) {
        elements.chargeLevel.className = 'charge-level medium';
        elements.chargePercent.style.color = 'var(--accent-orange)';
    } else {
        elements.chargeLevel.className = 'charge-level high';
        elements.chargePercent.style.color = 'var(--accent-green)';
    }
    
    // Cost breakdown
    const costBreakdown = document.querySelector('.cost-breakdown');
    costBreakdown.innerHTML = `
        <div class="cost-row">
            <span>Base swap fee</span>
            <span>$${transaction.cost.baseFee.toFixed(2)}</span>
        </div>
        <div class="cost-row">
            <span>Energy difference (${transaction.cost.energyNeeded}%)</span>
            <span>$${transaction.cost.energyCost.toFixed(2)}</span>
        </div>
        ${customer.discount > 0 ? `
        <div class="cost-row discount">
            <span>${customer.membership} discount</span>
            <span>-$${transaction.cost.discount.toFixed(2)}</span>
        </div>
        ` : ''}
    `;
    
    // Update discount badge visibility
    const discountBadge = document.querySelector('.cost-discount');
    if (customer.discount > 0) {
        discountBadge.style.display = 'block';
        discountBadge.textContent = `-${customer.discount * 100}% Member`;
    } else {
        discountBadge.style.display = 'none';
    }
    
    // Total
    elements.totalAmount.textContent = '$' + transaction.cost.total.toFixed(2);
}

function handleReject() {
    showToast('Transaction cancelled', 'error');
    resetTransaction();
    goToStep(1);
}

function handleProceedPayment() {
    elements.paymentAmount.textContent = '$' + state.transaction.cost.total.toFixed(2);
    goToStep(3);
}

async function handleScanPayment() {
    await showScanOverlay(1500);
    completeTransaction('Mobile Pay');
}

function handleCashPayment() {
    completeTransaction('Cash');
}

function completeTransaction(paymentMethod) {
    const { customer, transaction } = state;
    
    // Update receipt
    elements.receiptId.textContent = transaction.id;
    elements.receiptCustomer.textContent = customer.name;
    elements.receiptNewBattery.textContent = transaction.newBattery;
    elements.receiptAmount.textContent = '$' + transaction.cost.total.toFixed(2);
    elements.receiptMethod.textContent = paymentMethod;
    elements.newBatteryCode.textContent = `Slot #${transaction.slot} • ${transaction.newBattery}`;
    
    // Update stats
    state.stats.todaySwaps++;
    state.stats.availableBatteries--;
    state.stats.revenue += Math.round(transaction.cost.total);
    updateStats();
    
    // Show success
    showToast('Payment confirmed!');
    goToStep(4);
}

function handleNewSwap() {
    resetTransaction();
    goToStep(1);
}

function resetTransaction() {
    state.customer = null;
    state.battery = null;
    state.transaction = null;
}

// Haptic feedback (for mobile devices)
function haptic(style = 'light') {
    if (navigator.vibrate) {
        switch(style) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(20);
                break;
            case 'success':
                navigator.vibrate([10, 50, 10]);
                break;
        }
    }
}

// Add haptic to buttons
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => haptic('light'));
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

