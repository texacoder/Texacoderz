/* ---------------- Logo swap ----------------
   All brand marks default to the "TX" text mark. If logo.png is present
   in the site folder, it's swapped in automatically and the mark gets a
   dark plate + hairline ring (via .has-img) so a colored logo — e.g. the
   blue mark — sits cleanly on the ink background instead of clashing
   with a flat orange square. Nothing to do here if no logo.png exists;
   the text mark stays and no broken image ever shows. */
(function swapLogo(){
  const test = new Image();
  test.onload = () => {
    document.querySelectorAll('.brand-mark').forEach(el=>{
      el.classList.add('has-img');
      el.innerHTML = `<img src="logo.png" alt="Texacoderzz logo">`;
    });
  };
  test.onerror = () => { /* no logo.png yet — keep the text mark */ };
  test.src = 'logo.png';
})();

/* ---------------- Mobile nav toggle ---------------- */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if(navToggle && navLinks){
  navToggle.addEventListener('click', ()=>{
    navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });
  navLinks.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> navLinks.classList.remove('open')));
}

/* ---------------- Terminal hero animation (home page only) ---------------- */
const termBody = document.getElementById('termBody');
if(termBody){
  const lines = [
    {html:'<span class="l-prompt">$</span> <span class="l-cmd">texa new client-site</span>'},
    {html:'<span class="l-out">→ drafting layout, copy, components…</span>'},
    {html:'<span class="l-out">→ engineer review in progress…</span>'},
    {html:'<span class="l-ok">✓ build passed</span> <span class="l-out">· 3.2s</span>'},
    {html:'<span class="l-prompt">$</span> <span class="l-cmd">texa deploy</span>'},
    {html:'<span class="l-accent">✓ live at yourbusiness.com</span>'},
  ];
  let i = 0;
  let cursorEl = null;

  function typeNext(){
    if(i >= lines.length){
      cursorEl = document.createElement('div');
      cursorEl.innerHTML = '<span class="l-prompt">$</span> <span class="cursor"></span>';
      termBody.appendChild(cursorEl);
      // Hold on the finished state, then clear and loop — so the
      // terminal stays alive instead of freezing after one run.
      setTimeout(resetAndRestart, 2600);
      return;
    }
    const div = document.createElement('div');
    div.className = 'tline';
    div.innerHTML = lines[i].html;
    termBody.appendChild(div);
    i++;
    setTimeout(typeNext, i === 1 ? 500 : 650);
  }

  function resetAndRestart(){
    termBody.innerHTML = '';
    i = 0;
    typeNext();
  }

  typeNext();
}

/* ---------------- Contact form ---------------- */
const ACCESS_KEY = "b889dc21-865f-4361-bcd0-fd4174c98804";
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

const contactForm = document.getElementById('contactForm');
if(contactForm){
  contactForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const msg = document.getElementById('contactMsg');
    const name = document.getElementById('cName').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const message = document.getElementById('cMessage').value.trim();

    if(!name || !validEmail(email) || !message){
      msg.className = 'contact-msg error';
      msg.textContent = 'Please fill out all fields with a valid email.';
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          name, email, message,
          subject: `Texacoderzz Website | New Inquiry from ${name}`
        })
      });
      const result = await response.json();
      if(result.success){
        msg.className = 'contact-msg success';
        msg.textContent = "Message sent — we'll get back to you within 24–48 hours.";
        e.target.reset();
      } else {
        throw new Error(result.message);
      }
    } catch(err){
      msg.className = 'contact-msg error';
      msg.textContent = 'Failed to send message. Please try again or email us directly.';
    }
    btn.disabled = false; btn.textContent = originalText;
  });
}

/* ---------------- Footer year ---------------- */
document.querySelectorAll('.footer-year').forEach(el=> el.textContent = new Date().getFullYear());
