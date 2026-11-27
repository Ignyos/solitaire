/** @module Accessible modal dialog lifecycle */

/**
 * @param {{ title: string, content: HTMLElement, opener: HTMLElement, canClose?: () => boolean }} options
 * @returns {Promise<{ reason: string }>}
 */
export function openModal({ title, content, opener, canClose = () => true }) {
  if (document.querySelector('dialog[open]')) {
    return Promise.reject(new Error('A modal dialog is already open.'));
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const header = document.createElement('div');
  header.className = 'modal-header';
  const heading = document.createElement('h2');
  heading.id = 'modal-title';
  heading.textContent = title;
  dialog.setAttribute('aria-labelledby', heading.id);
  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '\u00d7';
  const requestClose = () => {
    if (canClose()) dialog.close();
  };
  closeButton.addEventListener('click', requestClose);
  header.append(heading, closeButton);
  dialog.append(header, content);

  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    }
  });

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      requestClose();
    }
  });

  return new Promise((resolve, reject) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener.isConnected) opener.focus();
      resolve({ reason: 'dismissed' });
    }, { once: true });

    document.body.append(dialog);
    try {
      dialog.showModal();
      closeButton.focus();
    } catch (error) {
      dialog.remove();
      reject(error);
    }
  });
}
