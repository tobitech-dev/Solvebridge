(() => {
  'use strict';

  const COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia',
    'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
    'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
    'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad',
    'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Republic)', 'Congo (Democratic Republic)', 'Costa Rica',
    "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti', 'Dominica',
    'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
    'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
    'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary',
    'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan',
    'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho',
    'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
    'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
    'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
    'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'São Tomé and Príncipe',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
    'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste',
    'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
    'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
    'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe', 'Other',
  ];

  const MAX_INPUT_BYTES = 12 * 1024 * 1024; // reject huge originals before compressing
  const MAX_EDGE = 1600;                    // longest side after compressing
  const MAX_DATA_URL = 1800000;             // stays under the server limit
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const form = document.getElementById('problem-form');
  if (!form) return;

  const els = {
    name: document.getElementById('name'),
    country: document.getElementById('country'),
    email: document.getElementById('email'),
    problem: document.getElementById('problem'),
    count: document.getElementById('problem-count'),
    image: document.getElementById('image'),
    preview: document.getElementById('preview'),
    previewImg: document.getElementById('preview-img'),
    remove: document.getElementById('remove-image'),
    error: document.getElementById('form-error'),
    submit: document.getElementById('submit'),
    arch: document.getElementById('arch'),
    hangers: document.querySelectorAll('.hanger[data-field]'),
  };

  let imageDataUrl = null;

  /* Country list */
  const frag = document.createDocumentFragment();
  COUNTRIES.forEach((c) => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    frag.append(o);
  });
  els.country.append(frag);

  /* Validation rules, one per field */
  const rules = {
    name: () => els.name.value.trim().length >= 2,
    country: () => els.country.value !== '',
    email: () => EMAIL_RE.test(els.email.value.trim()),
    problem: () => els.problem.value.trim().length >= 20,
  };

  const messages = {
    name: 'Enter your full name.',
    country: 'Choose your country.',
    email: 'Enter a valid email address.',
    problem: 'Describe the problem in at least 20 characters.',
  };

  /* The bridge builds itself as fields are completed */
  function updateBridge() {
    let done = 0;
    els.hangers.forEach((h) => {
      const ok = rules[h.dataset.field]();
      h.classList.toggle('on', ok);
      if (ok) done += 1;
    });
    els.arch.style.strokeDashoffset = String(100 - (done / els.hangers.length) * 100);
  }

  function updateCount() {
    els.count.textContent = `${els.problem.value.length} of 5000`;
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = !message;
  }

  function markInvalid(field, invalid) {
    els[field].setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  ['name', 'country', 'email', 'problem'].forEach((field) => {
    const ev = field === 'country' ? 'change' : 'input';
    els[field].addEventListener(ev, () => {
      if (els[field].getAttribute('aria-invalid') === 'true' && rules[field]()) markInvalid(field, false);
      if (field === 'problem') updateCount();
      updateBridge();
    });
  });

  /* Image: read, shrink and re-encode as JPEG in the browser */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That file could not be read as an image. Try a JPG, PNG or WebP.'));
      };
      img.src = url;
    });
  }

  async function shrink(file) {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparency
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.85;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > MAX_DATA_URL && quality > 0.35) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    if (out.length > MAX_DATA_URL) {
      throw new Error('That image is too large. Choose a smaller one.');
    }
    return out;
  }

  function clearImage() {
    imageDataUrl = null;
    els.image.value = '';
    els.preview.hidden = true;
    els.previewImg.removeAttribute('src');
  }

  els.image.addEventListener('change', async () => {
    const file = els.image.files && els.image.files[0];
    showError('');
    if (!file) return clearImage();

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      clearImage();
      return showError('Choose a JPG, PNG or WebP image.');
    }
    if (file.size > MAX_INPUT_BYTES) {
      clearImage();
      return showError('That image is over 12 MB. Choose a smaller one.');
    }

    try {
      imageDataUrl = await shrink(file);
      els.previewImg.src = imageDataUrl;
      els.preview.hidden = false;
    } catch (err) {
      clearImage();
      showError(err.message);
    }
  });

  els.remove.addEventListener('click', () => {
    clearImage();
    els.image.focus();
  });

  /* Submit */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    let firstBad = null;
    Object.keys(rules).forEach((field) => {
      const ok = rules[field]();
      markInvalid(field, !ok);
      if (!ok && !firstBad) firstBad = field;
    });
    if (firstBad) {
      showError(messages[firstBad]);
      els[firstBad].focus();
      return;
    }

    els.submit.disabled = true;
    els.submit.textContent = 'Sending…';

    const payload = {
      name: els.name.value.trim(),
      email: els.email.value.trim(),
      country: els.country.value,
      problem: els.problem.value.trim(),
      website: form.elements.website.value,
      image: imageDataUrl ? { mime: 'image/jpeg', data: imageDataUrl.split(',')[1] } : null,
    };

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send your problem. Try again.');
      window.location.assign('/thank-you');
    } catch (err) {
      showError(err.message || 'Could not send your problem. Check your connection and try again.');
      els.submit.disabled = false;
      els.submit.textContent = 'Send my problem';
    }
  });

  updateCount();
  updateBridge();
})();
