import QRCode from 'qrcode';
import { LEVELS } from '../levels/levels.js';
import { HighScoreManager } from '../systems/HighScoreManager.js';

/**
 * Menu manager controlling Title screen, Native <dialog> Modals (Field Guide, Level Select, Pause, Debrief, and Trifold QR).
 * Follows modern web guidance: native <dialog>, showModal(), accessible labels, overscroll containment.
 */
export class Menus {
  constructor(callbacks) {
    this.cb = callbacks;

    // Elements
    this.titleScreen = document.getElementById('title-screen');
    this.btnPlay = document.getElementById('btn-play');
    this.btnHowToPlay = document.getElementById('btn-how-to-play');
    this.btnPauseHowToPlay = document.getElementById('btn-pause-how-to-play');
    this.btnFieldGuide = document.getElementById('btn-field-guide');
    this.btnLevelSelect = document.getElementById('btn-level-select');
    this.btnTrifoldQr = document.getElementById('btn-trifold-qr');
    this.btnDebriefQr = document.getElementById('btn-debrief-qr');

    // Dialogs
    this.dialogHowToPlay = document.getElementById('dialog-how-to-play');
    this.dialogFieldGuide = document.getElementById('dialog-field-guide');
    this.dialogLevelSelect = document.getElementById('dialog-level-select');
    this.dialogPause = document.getElementById('dialog-pause');
    this.dialogDebrief = document.getElementById('dialog-debrief');
    this.dialogTrifoldQr = document.getElementById('dialog-trifold-qr');

    // QR Elements
    this.qrSvgWrapper = document.getElementById('qr-svg-wrapper');
    this.qrUrlText = document.getElementById('qr-url-text');
    this.qrUrlInput = document.getElementById('qr-url-input');
    this.btnQrUpdate = document.getElementById('btn-qr-update');
    this.btnQrPrint = document.getElementById('btn-qr-print');
    this.btnQrCopy = document.getElementById('btn-qr-copy');

    this.bindEvents();
    this.populateLevelsList();
    this.initQr();
  }

  bindEvents() {
    this.btnPlay?.addEventListener('click', () => {
      this.hideTitle();
      this.cb.onStartLevel(1);
    });

    this.btnHowToPlay?.addEventListener('click', () => {
      this.openModal(this.dialogHowToPlay);
    });

    this.btnPauseHowToPlay?.addEventListener('click', () => {
      this.openModal(this.dialogHowToPlay);
    });

    this.btnFieldGuide?.addEventListener('click', () => {
      this.openModal(this.dialogFieldGuide);
    });

    this.btnLevelSelect?.addEventListener('click', () => {
      this.populateLevelsList();
      this.openModal(this.dialogLevelSelect);
    });

    this.btnTrifoldQr?.addEventListener('click', () => {
      this.openModal(this.dialogTrifoldQr);
    });

    this.btnDebriefQr?.addEventListener('click', () => {
      this.openModal(this.dialogTrifoldQr);
    });

    // Close buttons on dialogs
    document.querySelectorAll('.dialog-close-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const dialog = e.target.closest('dialog');
        dialog?.close();
      });
    });

    // Pause Dialog buttons
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.dialogPause?.close();
      this.cb.onResume();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.dialogPause?.close();
      this.cb.onRestartLevel();
    });

    document.getElementById('btn-quit-title')?.addEventListener('click', () => {
      this.dialogPause?.close();
      this.showTitle();
      this.cb.onQuitToTitle();
    });

    // Debrief buttons
    document.getElementById('btn-debrief-replay')?.addEventListener('click', () => {
      this.dialogDebrief?.close();
      this.cb.onRestartLevel();
    });

    document.getElementById('btn-debrief-next')?.addEventListener('click', () => {
      this.dialogDebrief?.close();
      this.cb.onNextLevel();
    });

    // QR controls
    this.btnQrUpdate?.addEventListener('click', () => {
      const url = this.qrUrlInput?.value.trim() || window.location.href;
      this.generateQr(url);
    });

    this.btnQrPrint?.addEventListener('click', () => {
      window.print();
    });

    this.btnQrCopy?.addEventListener('click', async () => {
      const url = this.qrUrlInput?.value.trim() || window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        if (this.btnQrCopy) {
          const orig = this.btnQrCopy.textContent;
          this.btnQrCopy.textContent = 'COPIED!';
          setTimeout(() => {
            this.btnQrCopy.textContent = orig;
          }, 2000);
        }
      } catch {
        alert(`Copy URL: ${url}`);
      }
    });
  }

  initQr() {
    const defaultUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'https://penguinyou88.github.io/Lake-Patrol/'
      : window.location.href;

    if (this.qrUrlInput) this.qrUrlInput.value = defaultUrl;
    this.generateQr(defaultUrl);
  }

  async generateQr(url) {
    if (!this.qrSvgWrapper) return;
    try {
      const svgString = await QRCode.toString(url, {
        type: 'svg',
        color: {
          dark: '#0369a1', // Deep ocean cyan
          light: '#ffffff',
        },
        margin: 2,
        width: 190,
      });
      this.qrSvgWrapper.innerHTML = svgString;
      if (this.qrUrlText) this.qrUrlText.textContent = url;
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  }

  openModal(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  populateLevelsList() {
    const container = document.getElementById('levels-grid');
    if (!container) return;

    container.innerHTML = '';
    for (const lvl of LEVELS) {
      const record = HighScoreManager.get(lvl.id);
      const card = document.createElement('div');
      card.className = 'level-card';

      let recordBadge = `<div class="level-best pending">STATUS: READY FOR DEPLOYMENT</div>`;
      if (record) {
        const starsText = '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars);
        recordBadge = `<div class="level-best recorded">
          <span>RECORD: <strong>${record.score} PTS</strong></span>
          <span class="stars-gold">${starsText}</span>
          <span>(${record.interceptRate}% Cleared)</span>
        </div>`;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
          <div class="level-badge">MISSION 0${lvl.id}</div>
          ${recordBadge}
        </div>
        <h3>${lvl.name}</h3>
        <p class="level-sub">${lvl.subtitle}</p>
        <p class="level-desc">${lvl.description}</p>
        <button type="button" class="btn-primary start-lvl-btn">DEPLOY AUV</button>
      `;
      card.querySelector('.start-lvl-btn').addEventListener('click', () => {
        this.dialogLevelSelect?.close();
        this.hideTitle();
        this.cb.onStartLevel(lvl.id);
      });
      container.appendChild(card);
    }
  }

  showTitle() {
    if (this.titleScreen) this.titleScreen.style.display = 'flex';
  }

  hideTitle() {
    if (this.titleScreen) this.titleScreen.style.display = 'none';
  }

  showPause() {
    this.openModal(this.dialogPause);
  }

  showDebrief(debriefData, currentLevelId) {
    if (!this.dialogDebrief) return;

    // Record high score
    const recordResult = HighScoreManager.record(
      currentLevelId,
      debriefData.finalScore,
      debriefData.stars,
      debriefData.interceptionRate
    );

    // High score badges
    const newBestElem = document.getElementById('debrief-new-best');
    const prevBestElem = document.getElementById('debrief-prev-best');

    if (newBestElem) {
      newBestElem.style.display = recordResult.isNewRecord ? 'inline-block' : 'none';
    }
    if (prevBestElem) {
      if (recordResult.isNewRecord && recordResult.previousBest > 0) {
        prevBestElem.textContent = `PREVIOUS RECORD: ${recordResult.previousBest} PTS`;
        prevBestElem.style.display = 'block';
      } else if (!recordResult.isNewRecord) {
        prevBestElem.textContent = `PERSONAL BEST: ${recordResult.currentBest} PTS`;
        prevBestElem.style.display = 'block';
      } else {
        prevBestElem.style.display = 'none';
      }
    }

    // Refresh level cards in background
    this.populateLevelsList();

    // Fill stars
    const starsElem = document.getElementById('debrief-stars');
    if (starsElem) {
      const stars = '★'.repeat(debriefData.stars) + '☆'.repeat(3 - debriefData.stars);
      starsElem.textContent = stars;
      starsElem.className = `debrief-stars rating-${debriefData.stars}`;
    }

    // Fill metrics
    document.getElementById('debrief-score').textContent = `${debriefData.finalScore} PTS`;
    document.getElementById('debrief-intercept').textContent = `${debriefData.interceptionRate}% (${debriefData.quaggasRemoved}/${debriefData.initialQuaggas})`;
    document.getElementById('debrief-native-surv').textContent = `${debriefData.nativeSurvival}%`;
    document.getElementById('debrief-fish-surv').textContent = `${debriefData.fishSurvival}%`;
    document.getElementById('debrief-battery').textContent = `${debriefData.batteryUsed}%`;
    document.getElementById('debrief-efficiency').textContent = `${debriefData.efficiency} pts/%`;

    // Fill Research takeaways
    const takeawaysList = document.getElementById('debrief-takeaways');
    if (takeawaysList) {
      takeawaysList.innerHTML = debriefData.takeaways
        .map(
          (t) => `
        <li class="takeaway-item">
          <strong>${t.title}:</strong> ${t.desc}
        </li>
      `
        )
        .join('');
    }

    const nextBtn = document.getElementById('btn-debrief-next');
    if (nextBtn) {
      nextBtn.style.display = currentLevelId >= LEVELS.length ? 'none' : 'inline-block';
    }

    this.openModal(this.dialogDebrief);
  }
}
