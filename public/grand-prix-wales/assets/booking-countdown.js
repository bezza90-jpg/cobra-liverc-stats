const countdown = document.querySelector('[data-booking-countdown]');

if (countdown) {
  const target = Date.parse(countdown.dataset.bookingCountdown);
  const bookingLink = document.querySelector('[data-gpw-booking-link]');
  const waiting = document.querySelector('[data-gpw-booking-waiting]');
  const opening = document.querySelector('.gpw-card-opening');
  const digits = countdown.querySelector('.gpw-countdown-digits');
  const ended = countdown.querySelector('.gpw-countdown-ended');
  const heading = countdown.querySelector('p');
  let timer;

  function update() {
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    if (!Number.isFinite(remaining)) return;

    if (remaining === 0) {
      digits.hidden = true;
      ended.hidden = false;
      heading.textContent = 'Booking is open';
      if (bookingLink) {
        bookingLink.href = bookingLink.dataset.liveBooking;
        bookingLink.textContent = 'Book GPW →';
      }
      if (waiting) waiting.hidden = true;
      if (opening) opening.textContent = 'Booking is now open';
      clearInterval(timer);
      return;
    }

    const values = {
      days: Math.floor(remaining / 86400),
      hours: Math.floor(remaining % 86400 / 3600),
      minutes: Math.floor(remaining % 3600 / 60),
      seconds: remaining % 60,
    };
    for (const [name, value] of Object.entries(values)) {
      countdown.querySelector(`[data-unit="${name}"]`).textContent = String(value).padStart(2, '0');
    }
  }

  bookingLink?.addEventListener('click', update);
  bookingLink?.addEventListener('auxclick', update);
  window.addEventListener('pageshow', update);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
  timer = setInterval(update, 1000);
  update();
}
