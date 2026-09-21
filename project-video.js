/* SchooledUp demo dialog: opens a native <dialog> with the project video.
   Close button and Escape close it, pause the video, and return focus to the
   button that opened it. No dependencies. */
(() => {
  'use strict';

  const DIALOG_ID = 'schooledup-demo';
  const dialog = document.getElementById(DIALOG_ID);
  if (!dialog) return;

  const video = dialog.querySelector('video');
  const openers = document.querySelectorAll('[data-video-open="' + DIALOG_ID + '"]');
  let opener = null;

  const pause = () => {
    if (video && !video.paused) video.pause();
  };

  const open = (trigger) => {
    opener = trigger || null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const close = () => {
    pause();
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  };

  openers.forEach((trigger) => {
    trigger.addEventListener('click', () => open(trigger));
  });

  const closeButton = dialog.querySelector('[data-video-close]');
  if (closeButton) closeButton.addEventListener('click', close);

  // Backdrop click: the dialog element is the click target outside its inner box.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  // Escape fires 'cancel' before 'close'; pause immediately either way.
  dialog.addEventListener('cancel', pause);

  dialog.addEventListener('close', () => {
    pause();
    if (opener && typeof opener.focus === 'function') opener.focus();
  });

  // Fallback path for browsers without <dialog> support.
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();
