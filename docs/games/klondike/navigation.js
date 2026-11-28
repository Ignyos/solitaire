/** @module Durable Klondike navigation and active-play session */

import { shuffledDeck, fingerprintDeal } from '../../cards/deck.js?v=2026-11-28-00-39';
import { openStorage } from '../../core/storage.js?v=2026-11-28-00-39';
import { readLastRoute, saveLastRoute } from '../../core/navigation-context.js?v=2026-11-28-00-39';
import { saveWithRetries } from '../../core/save-coordinator.js?v=2026-11-28-00-39';
import { readGameSettings, saveGameOption, saveOptionsDisplay } from '../../core/game-settings.js?v=2026-11-28-00-39';
import { openGameOptions } from '../../shared-ui/game-options.js?v=2026-11-28-00-39';
import {
  KLONDIKE_STORE, upgradeKlondikeStore, readActiveAttempt, readAttempt, readFinishedDeals,
  createAttempt, retryAttempt, checkpointAttempt, readLastUndo, applyAttemptAction,
  undoAttemptAction, forfeitAttempt, AttemptStateError
} from './store.js?v=2026-11-28-00-39';
import { createKlondikeBoard } from './view.js?v=2026-11-28-00-39';
import { applyKlondikeAction, findAutomaticMove, IllegalMoveError } from './moves.js?v=2026-11-28-00-39';

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
  let settingsBusy = false;

  function canWrite() {
    return storageReady && !recoveryOpen;
  }

  function logError(context, error) {
    console.error(context, error);
  }

  function clearNotice() {
    notice.replaceChildren();
    notice.removeAttribute('role');
    content.before(notice);
  }

  function placeNotice() {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog || notice.parentElement === dialog) return;
    dialog.append(notice);
    dialog.addEventListener('close', () => {
      if (notice.parentElement === dialog) content.before(notice);
    }, { once: true });
  }

  function showMessage(message, isError = false) {
    if (recoveryOpen) return;
    placeNotice();
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
      placeNotice();
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
      (invalidState ? revert : retry).focus();
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
    text.textContent = 'Forfeit the current deal?';
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

  async function updateSetting(body, action) {
    if (settingsBusy) throw new Error('A game setting is already being saved.');
    const dialog = body.closest('dialog');
    if (!dialog) throw new Error('The game settings dialog is not open.');
    settingsBusy = true;
    const controls = [...dialog.querySelectorAll('button'), ...dialog.querySelectorAll('input')]
      .filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    try {
      await save(async () => {
        await action();
        return true;
      });
      return await readGameSettings(database, game);
    } finally {
      controls.forEach(control => { control.disabled = false; });
      settingsBusy = false;
    }
  }

  async function showGameOptions(opener, settings, start, replace) {
    return openGameOptions({
      openModal, opener, gameName: game.name, definitions: game.options, values: settings.options, start, replace,
      canClose: () => !settingsBusy,
      onOptionChange: async (body, optionId, value) =>
        (await updateSetting(body, () => saveGameOption(database, game, optionId, value))).options,
      onShowChange: async (body, showOptions) =>
        (await updateSetting(body, () => saveOptionsDisplay(database, game.id, showOptions))).showOptions,
      onError: error => reportError('Unable to update game settings:', error)
    });
  }

  async function openSettings(opener) {
    if (!canWrite()) return;
    await pauseClock();
    try {
      const settings = await readGameSettings(database, game);
      const body = document.createElement('div');
      body.className = 'game-settings';
      const options = document.createElement('button');
      options.type = 'button';
      options.textContent = 'Game Options';
      let openOptions = false;
      options.addEventListener('click', () => {
        if (settingsBusy) return;
        openOptions = true;
        options.closest('dialog').close();
      });
      const label = document.createElement('label');
      const display = document.createElement('input');
      display.type = 'checkbox';
      display.checked = settings.showOptions;
      display.addEventListener('change', () => {
        updateSetting(body, () => saveOptionsDisplay(database, game.id, display.checked))
          .then(updated => { display.checked = updated.showOptions; })
          .catch(error => reportError('Unable to update game settings:', error));
      });
      label.append(display, document.createTextNode(' Display Options Before New Games'));
      body.append(options, label);
      await openModal({ title: `${game.name} Settings`, content: body, opener,
        canClose: () => !settingsBusy });
      if (openOptions) await showGameOptions(opener, await readGameSettings(database, game), false, false);
    } finally {
      startClock();
    }
  }

  async function newDeal(opener) {
    if (!canWrite()) return;
    await pauseClock();
    let started = false;
    try {
      activeAttempt = await readActiveAttempt(database);
      const settings = await readGameSettings(database, game);
      if (settings.showOptions) {
        if (!await showGameOptions(opener, settings, true, Boolean(activeAttempt))) return;
      } else if (activeAttempt && !await confirmForfeit(opener)) {
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
      started = true;
      window.location.hash = `${ATTEMPT_PREFIX}${encodeURIComponent(created.id)}`;
    } finally {
      if (!started) startClock();
    }
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

  function renderBoard(attempt, initialUndo) {
    displayedAttempt = attempt;
    clockBase = attempt?.elapsedMs ?? 0;
    let lastUndo = initialUndo;
    let boardBusy = false;
    let scrollArea = null;
    let boardElement = null;
    let hint = null;
    let cleanupBoard = null;
    const stats = document.createElement('div');
    stats.className = 'klondike-stats';
    const time = document.createElement('p');
    time.textContent = 'Time: ';
    const timeValue = document.createElement('span');
    timeValue.dataset.klondikeTime = '';
    timeValue.textContent = formatTime(clockBase);
    time.append(timeValue);
    const moves = document.createElement('p');
    const score = document.createElement('p');
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'klondike-undo';
    const undoIcon = document.createElement('span');
    undoIcon.setAttribute('aria-hidden', 'true');
    undoIcon.textContent = '\u21b6';
    undo.append(undoIcon, ' Undo');
    stats.append(time, moves, score, undo);
    const boardHost = document.createElement('div');
    const controller = new AbortController();
    const updateHint = () => {
      if (!boardElement || !scrollArea || !hint) return;
      const bounds = boardElement.getBoundingClientRect();
      hint.hidden = scrollArea.scrollWidth <= scrollArea.clientWidth &&
        bounds.bottom <= window.innerHeight && bounds.top >= 0;
    };

    function renderPosition(current) {
      const previousScroll = scrollArea?.scrollLeft ?? 0;
      moves.textContent = `Moves: ${current?.moves ?? 0}`;
      score.textContent = `Score: ${current?.score ?? 0}`;
      undo.disabled = !current || current.outcome !== 'unfinished' || !lastUndo || boardBusy || !canWrite();
      const result = createKlondikeBoard(current?.board ?? null, {
        draw: current?.options.draw ?? 1,
        disabled: !current || current.outcome !== 'unfinished' || boardBusy || !canWrite(),
        onDraw: () => {
          performAction({ type: 'draw' }).catch(error => reportError('Unable to draw cards:', error));
        },
        onMove: (from, to) => {
          performAction({ type: 'move', from, to }).catch(error => reportError('Unable to move cards:', error));
        },
        onAutomaticMove: from => {
          if (!displayedAttempt || boardBusy || !canWrite()) return;
          const action = findAutomaticMove(displayedAttempt.board, displayedAttempt.options.draw, from);
          if (action) performAction(action).catch(error => reportError('Unable to move cards:', error));
        }
      });
      boardElement = result.element;
      scrollArea = result.scrollArea;
      hint = result.hint;
      if (cleanupBoard) cleanupBoard();
      cleanupBoard = result.cleanup;
      boardHost.replaceChildren(boardElement);
      scrollArea.scrollLeft = previousScroll;
      scrollArea.addEventListener('scroll', updateHint);
      updateHint();
    }

    async function performAction(action) {
      const isUndo = action === null;
      if (boardBusy || !displayedAttempt || !canWrite() || (isUndo && !lastUndo)) return;
      boardBusy = true;
      const id = displayedAttempt.id;
      const restoreBoardFocus = boardHost.contains(document.activeElement);
      try {
        await pending;
        if (!boardHost.isConnected || displayedAttempt?.id !== id ||
            window.location.hash !== `${ATTEMPT_PREFIX}${encodeURIComponent(id)}` || !canWrite()) return;
        const current = displayedAttempt;
        const elapsedMs = elapsedNow();
        let won = false;
        const preview = isUndo
          ? { ...current, board: lastUndo.board, score: current.score - lastUndo.scoreDelta - 1,
            moves: current.moves + 1 }
          : (() => {
            const result = applyKlondikeAction(current.board, current.options.draw, action);
            won = result.won;
            return { ...current, board: result.board, score: current.score + result.scoreDelta,
              moves: current.moves + 1 };
          })();
        if (won) cancelClock();
        displayedAttempt = preview;
        renderPosition(preview);
        const saved = await save(() => isUndo
          ? undoAttemptAction(database, { id, elapsedMs })
          : applyAttemptAction(database, { id, elapsedMs, action }));
        const latest = saved ?? await readActiveAttempt(database);
        if (!boardHost.isConnected || window.location.hash !== `${ATTEMPT_PREFIX}${encodeURIComponent(id)}`) return;
        if (saved?.outcome === 'won') {
          activeAttempt = null;
          displayedAttempt = null;
          lastUndo = null;
          clockBase = saved.elapsedMs;
          boardBusy = false;
          history.replaceState(null, '', GAME_ROUTE);
          resumeButton.disabled = true;
          forfeitButton.disabled = true;
          renderPosition(saved);
          updateTime();
          showMessage('You won this deal!');
          return;
        }
        if (!saved) {
          cancelClock();
          clockBase = latest?.elapsedMs ?? 0;
        }
        activeAttempt = latest;
        displayedAttempt = latest?.id === id ? latest : null;
        lastUndo = displayedAttempt ? await readLastUndo(database, id) : null;
        if (!saved) startClock();
      } catch (error) {
        if (!(error instanceof IllegalMoveError)) throw error;
        logError('Illegal Klondike move:', error);
      } finally {
        boardBusy = false;
        if (boardHost.isConnected && window.location.hash === `${ATTEMPT_PREFIX}${encodeURIComponent(id)}`) {
          renderPosition(displayedAttempt);
          updateTime();
          let focusTarget = isUndo ? undo : boardHost.querySelector('.klondike-stock');
          if (action?.type === 'move' && restoreBoardFocus) {
            const destination = [...boardHost.querySelectorAll('[data-destination]')]
              .find(element => element.dataset.destination === JSON.stringify(action.to));
            focusTarget = destination?.querySelector('[data-source]:last-child') ?? focusTarget;
          }
          if (focusTarget && !focusTarget.disabled && (isUndo || restoreBoardFocus) &&
              (document.activeElement === document.body || document.activeElement === undo)) {
            focusTarget.focus();
          }
        }
      }
    }
    undo.addEventListener('click', () => {
      performAction(null).catch(error => reportError('Unable to undo the move:', error));
    });
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
    const resumeButton = actionButton('Resume', closeAnd(resume), !activeAttempt);
    const forfeitButton = actionButton('Forfeit', closeAnd(forfeit), !activeAttempt || !canWrite());
    choices.append(
      menuLabel,
      actionButton('New Deal', closeAnd(newDeal), !canWrite()),
      resumeButton,
      actionButton('Retry', closeAnd(retry), !canWrite()),
      forfeitButton,
      actionButton('Settings', closeAnd(openSettings), !canWrite()),
      actionButton('Rules', closeAnd(openRules))
    );
    menu.append(trigger, choices);
    gameMenuSlot.replaceChildren(menu);
    content.replaceChildren(stats, boardHost);
    if (!attempt) {
      const message = document.createElement('p');
      message.className = 'klondike-message';
      message.textContent = 'No active deal. Choose New Deal to start.';
      content.prepend(message);
    }
    window.addEventListener('resize', updateHint, { signal: controller.signal });
    window.addEventListener('scroll', updateHint, { signal: controller.signal });
    boardCleanup = () => {
      controller.abort();
      if (cleanupBoard) cleanupBoard();
    };
    renderPosition(attempt);
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
    else {
      const lastUndo = attempt ? await readLastUndo(database, attempt.id) : null;
      if (sequence !== routing) return;
      renderBoard(attempt, lastUndo);
    }
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
    openSettings,
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
