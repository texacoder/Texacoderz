/* ---------------- Buy Us a Coffee — payment flow ----------------
   Talks to the site's own /api endpoints (see /api/create-order.js,
   /api/verify-payment.js). The amount is only ever validated and
   trusted server-side — this file just collects it and reflects
   back whatever the server/gateway decide. No secret key ever
   appears here; only the public Razorpay Key ID returned by
   /api/create-order is used to open Checkout. */
(function(){
  const MIN_AMOUNT = 10;
  const MAX_AMOUNT = 25000;

  const form = document.getElementById('coffeeForm');
  if(!form) return;

  const customField = document.getElementById('customAmountField');
  const customInput = document.getElementById('customAmountInput');
  const amountRadios = form.querySelectorAll('input[name="coffeeAmount"]');
  const emailInput = document.getElementById('coffeeEmail');
  const statusEl = document.getElementById('coffeeStatus');
  const submitBtn = document.getElementById('coffeeSubmit');
  const submitLabel = submitBtn.querySelector('.btn-label');

  let isProcessing = false;

  amountRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const isCustom = radio.value === 'custom' && radio.checked;
      customField.hidden = !isCustom;
      if(isCustom) customInput.focus();
      clearStatus();
    });
  });

  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function getSelectedAmount(){
    const checked = form.querySelector('input[name="coffeeAmount"]:checked');
    if(!checked) return NaN;
    if(checked.value === 'custom'){
      const v = Number(customInput.value);
      return Number.isFinite(v) ? Math.round(v) : NaN;
    }
    return Number(checked.value);
  }

  function setStatus(kind, text){
    statusEl.className = 'coffee-status ' + kind;
    statusEl.textContent = text;
  }
  function clearStatus(){
    statusEl.className = 'coffee-status';
    statusEl.textContent = '';
  }
  function setLoading(on){
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitLabel.textContent = on ? 'Processing…' : 'Buy Us a Coffee ☕';
  }
  function finishProcessing(){
    isProcessing = false;
    setLoading(false);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(isProcessing) return; // guards against double submits / double-clicks

    const amount = getSelectedAmount();
    const email = emailInput.value.trim();

    if(!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT){
      setStatus('error', `Please choose an amount between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.`);
      (customField.hidden ? form.querySelector('input[name="coffeeAmount"]:checked + .amount-chip') : customInput)?.focus();
      return;
    }
    if(email && !validEmail(email)){
      setStatus('error', "That email doesn't look right — you can also leave it blank.");
      emailInput.focus();
      return;
    }

    isProcessing = true;
    setLoading(true);
    setStatus('loading', 'Setting up secure checkout…');

    let orderData;
    try {
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email: email || undefined })
      });
      orderData = await orderRes.json().catch(() => ({}));
      if(!orderRes.ok){
        throw new Error(orderData.error || 'Could not start payment. Please try again.');
      }
    } catch(err){
      setStatus('error', err.message || 'Network error — please check your connection and try again.');
      finishProcessing();
      return;
    }

    if(typeof Razorpay === 'undefined'){
      setStatus('error', 'Payment checkout could not load. Please check your connection and try again.');
      finishProcessing();
      return;
    }

    setStatus('loading', 'Opening secure checkout…');

    const rzp = new Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name: 'Texacoderzz',
      description: 'Buy us a coffee ☕',
      image: 'logo.png',
      prefill: email ? { email } : undefined,
      theme: { color: '#3E7BFA' },
      handler: async function(response){
        setStatus('loading', 'Verifying your payment…');
        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if(verifyRes.ok && verifyData.success){
            setStatus('success', 'Thank you! ☕ Your support means a lot — payment received and verified.');
            form.reset();
            customField.hidden = true;
          } else {
            setStatus('error', 'We could not verify that payment. If money was deducted, please email us at texacoderzz@gmail.com and we\'ll sort it out.');
          }
        } catch(err){
          setStatus('error', 'Verification failed due to a network error. If money was deducted, please email us and we\'ll sort it out.');
        } finally {
          finishProcessing();
        }
      },
      modal: {
        ondismiss: function(){
          // User closed the checkout without paying — friendly, not an error.
          setStatus('cancelled', 'Checkout closed — no payment was made.');
          finishProcessing();
        }
      }
    });

    rzp.on('payment.failed', function(response){
      setStatus('error', 'Payment failed: ' + (response?.error?.description || 'please try again.'));
      finishProcessing();
    });

    rzp.open();
  });
})();
