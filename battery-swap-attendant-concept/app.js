document.addEventListener('DOMContentLoaded', () => {
    // Navigation & Flow Control
    const views = {
        dashboard: document.getElementById('view-dashboard'),
        scanning: document.getElementById('view-scanning'),
        details: document.getElementById('view-details'),
        payment: document.getElementById('view-payment'),
        success: document.getElementById('view-success')
    };

    // Buttons
    const btnStartSwap = document.getElementById('btn-start-swap');
    const btnCancelScan = document.getElementById('btn-cancel-scan');
    const btnConfirmPayment = document.getElementById('btn-confirm-payment');
    const btnBackDetails = document.getElementById('btn-back-details');
    const paymentTrigger = document.getElementById('payment-trigger');
    const btnFinish = document.getElementById('btn-finish');

    // State
    let currentSwap = {
        id: null,
        customer: null,
        cost: 0
    };

    // Helper: Switch View
    function switchView(viewName) {
        // Hide all
        Object.values(views).forEach(view => {
            view.classList.remove('active');
            setTimeout(() => {
                if(!view.classList.contains('active')) view.classList.add('hidden');
            }, 300); // Wait for transition
        });

        // Show target
        const target = views[viewName];
        target.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    }

    // Action: Start Swap (Go to Scanning)
    btnStartSwap.addEventListener('click', () => {
        switchView('scanning');
        
        // Simulate Scan Delay (2.5s)
        setTimeout(() => {
            simulateScanSuccess();
        }, 2500);
    });

    // Action: Cancel Scan
    btnCancelScan.addEventListener('click', () => {
        switchView('dashboard');
    });

    // Logic: Scan Success -> Show Details
    function simulateScanSuccess() {
        // Mock Data fetch
        currentSwap = {
            id: "BAT-8832",
            customer: "Sarah Jenkins",
            cost: 4.80
        };
        
        // Provide haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
        
        switchView('details');
    }

    // Action: Confirm Details -> Go to Payment
    btnConfirmPayment.addEventListener('click', () => {
        switchView('payment');
    });

    // Action: Go Back from Payment
    btnBackDetails.addEventListener('click', () => {
        switchView('details');
    });

    // Action: Simulate Payment Scan
    paymentTrigger.addEventListener('click', () => {
        // Visual feedback on trigger
        paymentTrigger.style.borderColor = 'var(--primary)';
        paymentTrigger.innerHTML = '<span class="material-icons-round" style="color:var(--primary)">check_circle</span><p style="color:var(--primary)">Scanned!</p>';
        
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);

        setTimeout(() => {
            switchView('success');
            
            // Simulate Dispense Status Update
            const badge = document.querySelector('.status-badge');
            setTimeout(() => {
                badge.textContent = "OPEN";
                badge.style.color = "var(--primary)";
            }, 1500);
        }, 800);
    });

    // Action: Finish -> Back to Dashboard
    btnFinish.addEventListener('click', () => {
        // Reset Payment Trigger UI for next time
        paymentTrigger.style.borderColor = '';
        paymentTrigger.innerHTML = '<span class="material-icons-round">qr_code_2</span><p>Tap to Simulate Scan</p>';
        document.querySelector('.status-badge').textContent = "OPENING...";
        document.querySelector('.status-badge').style.color = "var(--warning)";

        switchView('dashboard');
    });

});
