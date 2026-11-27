/** @module Durable Klondike navigation and active-play session */

import { shuffledDeck, fingerprintDeal } from '../../cards/deck.js?v=2026-10-21-23-35';
import { openStorage } from '../../core/storage.js?v=2026-10-21-23-35';
import { readLastRoute, saveLastRoute } from '../../core/navigation-context.js?v=2026-10-21-23-35';
import { saveWithRetries } from '../../core/save-coordinator.js?v=2026-10-21-23-35';
import {
  KLONDIKE_STORE, upgradeKlondikeStore, readActiveAttempt, readAttempt, readFinishedDeals,
  createAttempt, retryAttempt, checkpointAttempt, forfeitAttempt, AttemptStateError
} from './store.js?v=2026-10-21-23-35';
import { createKlondikeBoard } from './view.js?v=2026-10-21-23-35';

const HOME_ROUTE = '#/home';
const GAME_ROUTE = '#/games/klondike';
const ATTEMPT_PREFIX = '#/games/klondike/attempts/';
const CHECKPOINT_INTERVAL = 15000;
const DISPLAY_INTERVAL = 1000;
const DEALING_VERSION = 1;

/**
 * @param {{ content: HTMLElement, title: HTMLElement, gameMenuSlot: HTMLElement, openModal: Function, createRulesContent: Function, game: Object, renderGallery: Function, closeAppMenu: Function }} options
 * @returns {Promise<Object>}
 */
export async function createKlondikeNavigation({
  content, title, gameMenuSlot, openModal, createRulesContent, game, renderGallery, closeAppMenu
}) {
  const notice = document.createElement('section');
  notice.className = 'app-notice';
  notice.setAttribute('aria-live', 'polite');
  content.before(notice);
  let database = null;
  let storageReady = false;
  let activeAttempt = null;
  let displayedAttempt = null;
  let pending = Promise.resolve();
  let clockBase = 0;
  let clockStart = null;
  let displayTimer = null;
  let checkpointTimer = null;
  let boardCleanup = null;
  let routing = 0;
  let recoveryOpen = false;

  function canWrite() {
    return storageReady && !recoveryOpen;
  }

  function logError(context, error) {
    console.error(context, error);
  }

  function clearNotice() {
    notice.replaceChildren();
    notice.removeAttribute('role');
  }

  function showMessage(message, isError = false) {
    if (recoveryOpen) return;
    notice.textContent = message;
    if (isError) notice.setAttribute('role', 'alert');
    else notice.removeAttribute('role');
  }

  function isNonRetryable(error) {
    return error instanceof AttemptStateError || error instanceof TypeError;
  }

  async function recoverWrite(error, action) {
    logError('Unable to save Solitaire data:', error);
    const invalidState = error instanceof AttemptStateError;
    recoveryOpen = true;
    return new Promise(resolve => {
      notice.replaceChildren();
      notice.setAttribute('role', 'alert');
      const message = document.createElement('p');
      message.textContent = invalidState
        ? 'The saved deal is no longer in the expected state. Load the latest save to continue.'
        : 'Saving failed. Retry or return to the last saved state.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      const revert = document.createElement('button');
      revert.type = 'button';
      revert.textContent = invalidState ? 'Load latest save' : 'Revert to last save';
      if (!invalidState) {
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          revert.disabled = true;
          try {
            const result = await saveWithRetries(action, isNonRetryable);
            recoveryOpen = false;
            clearNotice();
            resolve(result);
          } catch (nextError) {
            resolve(await recoverWrite(nextError, action));
          }
        });
      }
      revert.addEventListener('click', () => {
        recoveryOpen = false;
        clearNotice();
        resolve(null);
      });
      notice.append(message);
      if (!invalidState) notice.append(retry);
      notice.append(revert);
    });
  }

  function save(action) {
    const operation = pending.then(async () => {
      try {
        return await saveWithRetries(action, isNonRetryable);
      } catch (error) {
        return recoverWrite(error, action);
      }
    });
    pending = operation.then(() => undefined, error => {
      logError('A queued save could not be completed:', error);
    });
    return operation;
  }

  function elapsedNow() {
    return Math.max(0, Math.floor(clockBase +
      (clockStart === null ? 0 : performance.now() - clockStart)));
  }

  function formatTime(milliseconds) {
    const total = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function updateTime() {
    const value = content.querySelector('[data-klondike-time]');
    if (value) value.textContent = formatTime(elapsedNow());
  }

  function cancelClock() {
    if (clockStart !== null) clockBase = elapsedNow();
    clockStart = null;
    clearInterval(displayTimer);
    clearInterval(checkpointTimer);
    displayTimer = null;
    checkpointTimer = null;
  }

  async function checkpoint() {
    if (!displayedAttempt || !canWrite()) return;
    const attemptId = displayedAttempt.id;
    const elapsedMs = elapsedNow();
    const updated = await save(() => {
      if (!displayedAttempt || displayedAttempt.id !== attemptId) {
        throw new AttemptStateError();
      }
      return checkpointAttempt(database, { id: attemptId, elapsedMs });
    });
    if (!updated) {
      const latest = await readActiveAttempt(database);
      const wasRunning = clockStart !== null;
      if (wasRunning) cancelClock();
      activeAttempt = latest;
      displayedAttempt = latest?.id === attemptId ? latest : null;
      clockBase = displayedAttempt?.elapsedMs ?? 0;
      updateTime();
      if (wasRunning) startClock();
      return;
    }
    displayedAttempt = updated;
    activeAttempt = updated;
  }

  async function pauseClock(saveTime = true) {
    if (clockStart === null) return;
    cancelClock();
    if (saveTime && canWrite()) await checkpoint();
  }

  function startClock() {
    if (!displayedAttempt || !canWrite() || document.visibilityState !== 'visible' ||
        clockStart !== null || document.querySelector('dialog[open]')) return;
    clockStart = performance.now();
    displayTimer = setInterval(updateTime, DISPLAY_INTERVAL);
    checkpointTimer = setInterval(() => {
      checkpoint().catch(error => reportError('Unable to checkpoint the game timer:', error));
    }, CHECKPOINT_INTERVAL);
    updateTime();
  }

  function reportError(context, error) {
    logError(context, error);
    showMessage('Something went wrong. Please reload and try again.', true);
  }

  async function confirmForfeit(opener) {
    const body = document.createElement('div');
    const text = document.createElement('p');
    text.textContent = 'Forfeit the current deal? Its time and moves will be saved.';
    const actions = document.createElement('div');
    actions.className = 'klondike-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Forfeit';
    let accepted = false;
    cancel.addEventListener('click', () => cancel.closest('dialog').close());
    confirm.addEventListener('click', () => {
      accepted = true;
      confirm.closest('dialog').close();
    });
    actions.append(cancel, confirm);
    body.append(text, actions);
    await openModal({ title: 'Forfeit current deal?', content: body, opener });
    return accepted;
  }

  async function openRules(opener) {
    await pauseClock();
    try {
      await openModal({
        title: game.rules.title, content: createRulesContent(game.rules), opener
      });
    } finally {
      startClock();
    }
  }

  async function newDeal(opener) {
    if (!canWrite()) return;
    await pauseClock();
    activeAttempt = await readActiveAttempt(database);
    if (activeAttempt && !await confirmForfeit(opener)) {
      startClock();
      return;
    }
    const cards = shuffledDeck();
    const fingerprint = await fingerprintDeal(cards, DEALING_VERSION);
    const attemptId = crypto.randomUUID();
    const replace = activeAttempt
      ? { id: activeAttempt.id, elapsedMs: activeAttempt.elapsedMs }
      : null;
    const created = await save(() => createAttempt(database, {
      attemptId, cards, fingerprint, replace
    }));
    if (!created) {
      await reloadCurrent();
      return;
    }
    activeAttempt = created;
    window.location.hash = `${ATTEMPT_PREFIX}${encodeURIComponent(created.id)}`;
  }

  async function retry(opener) {
    if (!canWrite()) return;
    await pauseClock();
    let started = false;
    try {
      const deals = await readFinishedDeals(database);
      const body = document.createElement('div');
      let selectedAttemptId = null;
      if (deals.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No finished deals yet.';
        body.append(message);
      } else {
        const list = document.createElement('ul');
        list.className = 'klondike-retry-list';
        for (const { latest, attemptCount } of deals) {
          const item = document.createElement('li');
          const heading = document.createElement('h3');
          heading.textContent = `Deal #${latest.dealNumber}`;
          const details = document.createElement('p');
          const outcome = latest.outcome === 'won' ? 'Won' : 'Forfeited';
          details.textContent = `Draw ${latest.options.draw} | ${outcome} | Time: ${formatTime(latest.elapsedMs)} | ` +
            `Moves: ${latest.moves} | Score: ${latest.score} | Attempts: ${attemptCount}`;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Retry';
          button.setAttribute('aria-label', `Retry deal #${latest.dealNumber}`);
          button.addEventListener('click', () => {
            selectedAttemptId = latest.id;
            button.closest('dialog').close();
          });
          item.append(heading, details, button);
          list.append(item);
        }
        body.append(list);
      }
      await openModal({ title: 'Retry a deal', content: body, opener });
      const sourceAttemptId = selectedAttemptId;
      if (!sourceAttemptId) return;
      activeAttempt = await readActiveAttempt(database);
      if (activeAttempt && !await confirmForfeit(opener)) return;
      const replace = activeAttempt
        ? { id: activeAttempt.id, elapsedMs: activeAttempt.elapsedMs }
        : null;
      const attemptId = crypto.randomUUID();
      const created = await save(() => retryAttempt(database, {
        attemptId, sourceAttemptId, replace
      }));
      if (!created) {
        await reloadCurrent();
        return;
      }
      activeAttempt = created;
      started = true;
      window.location.hash = `${ATTEMPT_PREFIX}${encodeURIComponent(created.id)}`;
    } finally {
      if (!started) startClock();
    }
  }

  async function resume() {
    if (!storageReady) return;
    const latest = await readActiveAttempt(database);
    if (!latest) {
      showMessage('There is no unfinished Klondike deal.');
      await reloadCurrent();
      return;
    }
    activeAttempt = latest;
    window.location.hash = `${ATTEMPT_PREFIX}${encodeURIComponent(latest.id)}`;
  }

  async function titleAction(opener) {
    if (!storageReady) return;
    const latest = await readActiveAttempt(database);
    if (latest) await resume();
    else await newDeal(opener);
  }

  async function forfeit(opener) {
    if (!activeAttempt || !canWrite()) return;
    const attemptId = activeAttempt.id;
    await pauseClock();
    if (!await confirmForfeit(opener)) {
      startClock();
      return;
    }
    const current = await readActiveAttempt(database);
    if (!current || current.id !== attemptId) throw new AttemptStateError();
    const result = await save(() => forfeitAttempt(database, {
      id: current.id, elapsedMs: current.elapsedMs
    }));
    if (!result) {
      await reloadCurrent();
      return;
    }
    activeAttempt = null;
    displayedAttempt = null;
    if (window.location.hash === HOME_ROUTE || window.location.hash === '#home' ||
        !window.location.hash) {
      await renderRoute();
    } else if (window.location.hash === GAME_ROUTE) {
      await renderRoute();
    } else {
      window.location.hash = GAME_ROUTE;
    }
  }

  function actionButton(label, action, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', () => {
      action(button).catch(error => reportError(`Unable to ${label.toLowerCase()}:`, error));
    });
    return button;
  }

  function renderBoard(attempt) {
    displayedAttempt = attempt;
    clockBase = attempt?.elapsedMs ?? 0;
    const stats = document.createElement('div');
    stats.className = 'klondike-stats';
    const time = document.createElement('p');
    time.textContent = 'Time: ';
    const timeValue = document.createElement('span');
    timeValue.dataset.klondikeTime = '';
    timeValue.textContent = formatTime(clockBase);
    time.append(timeValue);
    const moves = document.createElement('p');
    moves.textContent = `Moves: ${attempt?.moves ?? 0}`;
    const score = document.createElement('p');
    score.textContent = `Score: ${attempt?.score ?? 0}`;
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'klondike-undo';
    undo.disabled = true;
    const undoIcon = document.createElement('span');
    undoIcon.setAttribute('aria-hidden', 'true');
    undoIcon.textContent = '\u21b6';
    undo.append(undoIcon, ' Undo');
    stats.append(time, moves, score, undo);
    const { element, scrollArea, hint } = createKlondikeBoard(attempt?.board ?? null);
    const menu = document.createElement('div');
    menu.className = 'klondike-game-menu game-card-menu';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'app-menu-trigger game-card-menu-trigger';
    trigger.textContent = game.name;
    trigger.setAttribute('aria-label', `${game.name} menu`);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'klondike-game-menu');
    const choices = document.createElement('div');
    choices.className = 'game-card-menu-choices';
    choices.id = 'klondike-game-menu';
    choices.hidden = true;
    const menuLabel = document.createElement('h2');
    menuLabel.className = 'klondike-game-menu-label';
    menuLabel.textContent = game.name;
    trigger.addEventListener('click', () => {
      choices.hidden = !choices.hidden;
      trigger.setAttribute('aria-expanded', String(!choices.hidden));
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !choices.hidden) {
        choices.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
        event.stopPropagation();
      }
    });
    const closeAnd = action => async () => {
      choices.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      await action(trigger);
    };
    choices.append(
      menuLabel,
      actionButton('New Deal', closeAnd(newDeal), !canWrite()),
      actionButton('Resume', closeAnd(resume), !activeAttempt),
      actionButton('Retry', closeAnd(retry), !canWrite()),
      actionButton('Forfeit', closeAnd(forfeit), !activeAttempt || !canWrite()),
      actionButton('Rules', closeAnd(openRules))
    );
    menu.append(trigger, choices);
    gameMenuSlot.replaceChildren(menu);
    content.replaceChildren(stats, element);
    if (!attempt) {
      const message = document.createElement('p');
      message.className = 'klondike-message';
      message.textContent = 'No active deal. Choose New Deal to start.';
      content.prepend(message);
    }
    const updateHint = () => {
      const bounds = element.getBoundingClientRect();
      hint.hidden = scrollArea.scrollWidth <= scrollArea.clientWidth &&
        bounds.bottom <= window.innerHeight && bounds.top >= 0;
    };
    const controller = new AbortController();
    window.addEventListener('resize', updateHint, { signal: controller.signal });
    window.addEventListener('scroll', updateHint, { signal: controller.signal });
    scrollArea.addEventListener('scroll', updateHint, { signal: controller.signal });
    boardCleanup = () => controller.abort();
    updateHint();
    startClock();
  }

  function cleanupView() {
    if (boardCleanup) boardCleanup();
    boardCleanup = null;
    displayedAttempt = null;
    gameMenuSlot.replaceChildren();
  }

  async function renderRoute({ persistRoute = true } = {}) {
    const sequence = ++routing;
    await pauseClock();
    await pending;
    if (sequence !== routing) return;
    cleanupView();
    closeAppMenu();
    const hash = window.location.hash || HOME_ROUTE;
    let route = hash === '#home' ? HOME_ROUTE : hash;
    activeAttempt = storageReady ? await readActiveAttempt(database) : null;
    let attempt = null;
    if (route.startsWith(ATTEMPT_PREFIX)) {
      let id;
      try {
        id = decodeURIComponent(route.slice(ATTEMPT_PREFIX.length));
      } catch (error) {
        if (!(error instanceof URIError)) throw error;
        logError('Invalid attempt route:', error);
      }
      attempt = storageReady && id ? await readAttempt(database, id) : null;
      if (!attempt || attempt.outcome !== 'unfinished' || activeAttempt?.id !== id) {
        route = GAME_ROUTE;
        showMessage('That saved attempt is no longer available.');
      }
    } else if (route !== HOME_ROUTE && route !== GAME_ROUTE) {
      route = HOME_ROUTE;
      showMessage('That page is not available.');
    }
    if (sequence !== routing) return;
    if (persistRoute && storageReady && canWrite()) {
      const saved = await save(async () => {
        await saveLastRoute(database, route);
        return true;
      });
      if (!saved) {
        const savedRoute = await readLastRoute(database);
        if (sequence !== routing) return;
        history.replaceState(null, '', savedRoute || HOME_ROUTE);
        await renderRoute({ persistRoute: false });
        return;
      }
    }
    if (sequence !== routing) return;
    if (route !== hash && hash !== '#home') {
      history.replaceState(null, '', route);
    }
    title.textContent = route === HOME_ROUTE ? 'Solitaire' : game.name;
    title.classList.toggle('app-title-game', route !== HOME_ROUTE);
    content.classList.toggle('game-content', route !== HOME_ROUTE);
    if (route === HOME_ROUTE) renderGallery(api);
    else renderBoard(attempt);
  }

  async function reloadCurrent() {
    if (!storageReady) return;
    activeAttempt = await readActiveAttempt(database);
    await renderRoute();
  }

  const api = {
    get activeAttempt() { return activeAttempt; },
    get storageReady() { return storageReady; },
    canWrite,
    titleAction,
    newDeal,
    retry,
    resume,
    forfeit,
    openRules,
    reportError
  };

  window.addEventListener('hashchange', () => {
    renderRoute().catch(error => reportError('Unable to navigate:', error));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseClock().catch(error => reportError('Unable to pause the game timer:', error));
    } else {
      startClock();
    }
  });
  window.addEventListener('pagehide', () => {
    pauseClock().catch(error => logError('Unable to checkpoint before closing:', error));
  });

  renderGallery(api);
  try {
    database = await openStorage({
      gameStores: [{ name: KLONDIKE_STORE, upgrade: upgradeKlondikeStore }]
    });
    storageReady = true;
    const savedRoute = await readLastRoute(database);
    if (!window.location.hash && savedRoute) history.replaceState(null, '', savedRoute);
    await renderRoute();
  } catch (error) {
    storageReady = false;
    logError('Unable to initialize durable game storage:', error);
    showMessage('Saved games are unavailable. Reload to try again; rules remain available.', true);
    renderGallery(api);
  }
  return api;
}
