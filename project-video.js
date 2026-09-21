/* Project demo dialogs: each .project-video <dialog> opens from any element
   with a matching [data-video-open="<dialog-id>"] trigger. Close button,
   Escape, and backdrop click close it, pause the video, and return focus to
   the trigger that opened it. No dependencies. */
(() => {
  'use strict';

  const dialogs = document.querySelectorAll('dialog.project-video');

  dialogs.forEach((dialog) => {
    const video = dialog.querySelector('video');
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

    const openers = document.querySelectorAll('[data-video-open="' + dialog.id + '"]');
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
  });
})();
