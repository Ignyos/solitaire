/** @module Reusable game-option controls */

/**
 * @param {{ openModal: Function, opener: HTMLElement,
 *   definitions: import('../core/game-settings.js?v=2026-10-21-23-35').GameOption[],
 *   values: Record<string, string | number>, start: boolean, replace: boolean,
 *   onOptionChange: (body: HTMLElement, optionId: string, value: string | number) => Promise<Record<string, string | number>>,
 *   onShowChange: (body: HTMLElement, showOptions: boolean) => Promise<boolean>,
 *   canClose: () => boolean, onError: (error: unknown) => void }} input
 * @returns {Promise<boolean>}
 */
export async function openGameOptions({
  openModal, opener, definitions, values, start, replace, onOptionChange, onShowChange,
  canClose, onError
}) {
  const element = document.createElement('div');
  element.className = 'game-options';
  /** @type {Array<{ input: HTMLInputElement, optionId: string, value: string | number }>} */
  const controls = [];
  let accepted = false;
  if (start && replace) {
    const warning = document.createElement('p');
    warning.textContent = 'Starting a new deal forfeits the current deal. Its time and moves will be saved.';
    element.append(warning);
  }
  function setValues(nextValues) {
    for (const control of controls) {
      control.input.checked = nextValues[control.optionId] === control.value;
    }
  }
  for (const option of definitions) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = option.label;
    fieldset.append(legend);
    for (const choice of option.choices) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `game-option-${option.id}`;
      input.checked = values[option.id] === choice.value;
      input.addEventListener('change', () => {
        if (input.checked) {
          onOptionChange(element, option.id, choice.value).then(setValues).catch(onError);
        }
      });
      label.append(input, document.createTextNode(` ${choice.label}`));
      fieldset.append(label);
      controls.push({ input, optionId: option.id, value: choice.value });
    }
    element.append(fieldset);
  }
  if (start) {
    const label = document.createElement('label');
    label.className = 'game-options-preference';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      onShowChange(element, !input.checked).then(showOptions => {
        input.checked = !showOptions;
      }).catch(onError);
    });
    label.append(input, document.createTextNode(" Don't show this again"));
    const note = document.createElement('p');
    note.textContent = 'You can change this in game Settings.';
    const actions = document.createElement('div');
    actions.className = 'game-options-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      if (canClose()) cancel.closest('dialog').close();
    });
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = replace ? 'Forfeit & Start' : 'Start';
    confirm.addEventListener('click', () => {
      if (!canClose()) return;
      accepted = true;
      confirm.closest('dialog').close();
    });
    actions.append(cancel, confirm);
    element.append(label, note, actions);
  }
  await openModal({ title: start ? 'New Deal' : 'Game Options', content: element, opener, canClose });
  return accepted;
}
