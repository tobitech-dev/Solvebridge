(() => {
  'use strict';

  const form = document.getElementById('login-form');
  const input = document.getElementById('password');
  const error = document.getElementById('login-error');
  const button = document.getElementById('login-submit');

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    if (!input.value) {
      showError('Enter your password.');
      input.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not sign in. Try again.');
      window.location.assign('/dashboard');
    } catch (err) {
      showError(err.message || 'Could not sign in. Check your connection and try again.');
      input.select();
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
})();
